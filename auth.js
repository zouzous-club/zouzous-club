import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const $ = (id) => document.getElementById(id);
const shell = document.querySelector('.shell');
const authScreen = $('authScreen');
const mobile = $('mobileNav');
const query = new URLSearchParams(window.location.search);
const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ''));
const callbackType = fragment.get('type') || query.get('type');
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const configured = SUPABASE_URL.startsWith('https://')
    && !SUPABASE_URL.includes('VOTRE-PROJET')
    && !SUPABASE_ANON_KEY.includes('VOTRE_CLE');

let supabase = null;
let currentUser = null;
let groupId = null;
let role = null;
let processing = false;
let passwordFlow = callbackType === 'invite' || callbackType === 'recovery';

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
        .select('groupe_id,role,statut')
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

    $('memberStatus').textContent = `Zouzous Club · ${currentUser.email}`;
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
            show('authLogin');
            return;
        }

        if (passwordFlow) {
            setAccess(false);
            show('authPassword');
            message('Définissez votre mot de passe pour terminer l’activation.');
            return;
        }

        await loadMembership();
    } catch (error) {
        console.error('Zouzous Club : erreur de vérification des droits', error);
        setAccess(false);
        show('authLogin');
        const code = error?.code || 'SANS_CODE';
        const description = error?.message || 'Erreur inconnue';
        const precision = error?.details ? ` — ${error.details}` : '';
        const conseil = error?.hint ? ` — ${error.hint}` : '';
        message(`Vérification des droits impossible [${code}] : ${description}${precision}${conseil}`, true);
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
        message('Compte activé.');
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

    const invitationForm = new FormData(event.currentTarget);
    const email = String(invitationForm.get('email')).trim();
    const roleInvite = String(invitationForm.get('role') || 'membre');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${window.location.pathname}`
    });

    message(
        error ? 'Demande impossible.' : 'Si le compte existe, un e-mail a été envoyé.',
        Boolean(error)
    );
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
    const invitationForm = new FormData(event.currentTarget);
    const email = String(invitationForm.get('email')).trim();
    const roleInvite = String(invitationForm.get('role') || 'membre');
    button.disabled = true;

    try {
        const { data, error } = await supabase.functions.invoke('inviter-membre', {
            body: {
                groupe_id: groupId,
                role: roleInvite,
                email
            }
        });

        if (error || !data?.ok) {
            let detail = data?.erreur || data?.message || error?.message || 'ERREUR_INCONNUE';
            let httpStatus = error?.context?.status || '';

            if (error?.context && typeof error.context.json === 'function') {
                try {
                    const responseBody = await error.context.json();
                    detail = responseBody?.erreur || responseBody?.message || detail;
                } catch {
                    // La réponse n'est pas nécessairement au format JSON.
                }
            }

            const code = httpStatus ? ` (HTTP ${httpStatus})` : '';
            $('inviteMessage').textContent = `Invitation impossible${code} : ${detail}`;
            return;
        }

        $('inviteMessage').textContent =
            'Invitation envoyée. Le lien de connexion peut expirer avant les 7 jours de l’invitation.';
        event.currentTarget.reset();
    } catch (error) {
        $('inviteMessage').textContent =
            `Invitation impossible : ${error instanceof Error ? error.message : 'ERREUR_INCONNUE'}`;
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

        window.setTimeout(() => {
            void refresh();
        }, 0);
    });

    void refresh();
}
