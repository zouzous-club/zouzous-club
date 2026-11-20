import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = (id) => document.getElementById(id);
const shell = document.querySelector('.shell');
const authScreen = $('authScreen');
const mobile = $('mobileNav');
const query = new URLSearchParams(window.location.search);
const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const callbackType = fragment.get('type') || query.get('type');
const recoveryRequested = query.get('recovery') === '1' || callbackType === 'recovery';
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const configured = SUPABASE_URL.startsWith('https://')
    && !SUPABASE_URL.includes('VOTRE-PROJET')
    && !SUPABASE_ANON_KEY.includes('VOTRE_CLE');

let supabase = null;
let currentUser = null;
let groupId = null;
let role = null;
let processing = false;
let passwordFlow = callbackType === 'invite' || recoveryRequested;

function message(value, isError = false) {
    $('authMessage').textContent = value;
    $('authMessage').style.color = isError ? '#a72e43' : '#4b359e';
}

function show(id) {
    for (const element of document.querySelectorAll('[data-auth-view]')) {
        element.hidden = element.id !== id;
    }
}

function setAccess(allowed) {
    shell.hidden = !allowed;
    mobile.hidden = !allowed;
    authScreen.hidden = allowed;
}

function textElement(tag, value) {
    const element = document.createElement(tag);
    element.textContent = value;
    return element;
}

async function loadMembers() {
    if (!groupId) {
        return;
    }

    const list = $('membersList');
    list.replaceChildren();

    const { data, error } = await supabase
        .from('membres_groupes')
        .select('utilisateur_id,role,statut')
        .eq('groupe_id', groupId)
        .eq('statut', 'actif');

    if (error) {
        list.textContent = 'Impossible de charger les membres.';
        return;
    }

    const { data: profiles } = await supabase
        .from('profils')
        .select('id,prenom');

    const names = new Map(
        (profiles || []).map((profile) => [profile.id, profile.prenom])
    );

    for (const member of data || []) {
        const row = document.createElement('div');
        row.className = 'item row';
        row.append(
            textElement(
                'span',
                `${names.get(member.utilisateur_id) || 'Membre'} — ${member.role}`
            )
        );
        list.append(row);
    }
}

async function loadMembership() {
    const { data, error } = await supabase
        .from('membres_groupes')
        .select('groupe_id,role,statut,groupes(nom)')
        .eq('statut', 'actif')
        .limit(20);

    if (error) {
        throw error;
    }

    if (!data?.length) {
        groupId = null;
        setAccess(false);
        show('authPending');
        message('Votre compte ne dispose pas encore d’un accès actif.');
        return;
    }

    const membership = data[0];
    groupId = membership.groupe_id;
    role = membership.role;

    $('memberStatus').textContent =
        `${membership.groupes?.nom || 'Zouzous Club'} · ${currentUser.email}`;
    $('memberRole').textContent = role === 'administrateur'
        ? 'Administrateur'
        : 'Membre';
    $('invitePanel').hidden = role !== 'administrateur';
    $('memberPanel').hidden = false;

    setAccess(true);
    await loadMembers();
}

async function refresh() {
    if (processing || !supabase) {
        return;
    }

    processing = true;

    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        currentUser = error ? null : user;

        if (!currentUser) {
            setAccess(false);

            if (passwordFlow) {
                show('authPending');
                message('Vérification du lien de récupération en cours…');
            } else {
                show('authLogin');
            }

            return;
        }

        if (passwordFlow) {
            setAccess(false);
            show('authPassword');
            message('Choisissez votre nouveau mot de passe (12 caractères minimum).');
            return;
        }

        await loadMembership();
    } catch {
        setAccess(false);
        show('authPending');
        message('Impossible de vérifier les droits. Réessayez.', true);
    } finally {
        processing = false;
    }
}

$('loginForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!supabase) {
        return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    const form = new FormData(event.currentTarget);
    button.disabled = true;

    try {
        const { error } = await supabase.auth.signInWithPassword({
            email: String(form.get('email')).trim(),
            password: String(form.get('password'))
        });

        if (error) {
            message('Connexion impossible. Vérifiez vos identifiants.', true);
            return;
        }

        await refresh();
    } finally {
        button.disabled = false;
    }
});

$('passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!supabase) {
        return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    const password = String(new FormData(event.currentTarget).get('password'));

    if (password.length < 12) {
        message('Utilisez au moins 12 caractères.', true);
        return;
    }

    button.disabled = true;

    try {
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            throw error;
        }

        if (callbackType === 'invite') {
            const invitationGroup = query.get('groupe')
                || currentUser?.user_metadata?.groupe_id;

            if (!uuidPattern.test(invitationGroup || '')) {
                throw new Error('Identifiant du groupe absent du lien d’invitation.');
            }

            const { error: activationError } = await supabase.rpc(
                'activer_mon_invitation',
                { p_groupe_id: invitationGroup }
            );

            if (activationError) {
                throw activationError;
            }
        }

        passwordFlow = false;
        window.history.replaceState(null, '', window.location.pathname);
        message('Votre mot de passe a été enregistré.');
        await refresh();
    } catch (error) {
        message(
            `Activation impossible : ${error.message || 'lien invalide ou expiré'}`,
            true
        );
    } finally {
        button.disabled = false;
    }
});

$('resetForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!supabase) {
        return;
    }

    const email = String(new FormData(event.currentTarget).get('email')).trim();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}?recovery=1`
    });

    if (error) {
        const code = error.code || `HTTP ${error.status || 'inconnu'}`;
        message(`Demande impossible (${code}) : ${error.message || 'Erreur Supabase'}`, true);
        return;
    }

    message('Si le compte existe, un e-mail a été envoyé.');
});

$('forgotButton').addEventListener('click', () => {
    show('authReset');
    message('');
});

$('backButton').addEventListener('click', () => {
    show('authLogin');
    message('');
});

$('logoutButton').addEventListener('click', async () => {
    if (!supabase) {
        return;
    }

    await supabase.auth.signOut();
    setAccess(false);
    show('authLogin');
});

$('inviteForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!supabase || !groupId || role !== 'administrateur') {
        return;
    }

    const button = event.currentTarget.querySelector('button[type="submit"]');
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    button.disabled = true;

    try {
        const { data, error } = await supabase.functions.invoke('inviter-membre', {
            body: {
                groupe_id: groupId,
                email
            }
        });

        if (error || !data?.ok) {
            throw error || new Error(data?.erreur || 'INVITATION_REFUSEE');
        }

        $('inviteMessage').textContent =
            'Invitation envoyée. Le lien de connexion peut expirer avant les 7 jours de l’invitation.';
        event.currentTarget.reset();
    } catch {
        $('inviteMessage').textContent =
            'Invitation impossible : vérifiez la configuration ou le compte invité.';
    } finally {
        button.disabled = false;
    }
});

setAccess(false);

if (!configured) {
    show('authPending');
    message('Complétez config.js avec l’URL et la clé publique Supabase.', true);
} else {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            detectSessionInUrl: true,
            persistSession: true,
            autoRefreshToken: true
        }
    });

    supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
            passwordFlow = true;
        }

        if (event === 'SIGNED_OUT' && passwordFlow) {
            passwordFlow = false;
        }

        window.setTimeout(() => {
            void refresh();
        }, 0);
    });

    void refresh();
}
