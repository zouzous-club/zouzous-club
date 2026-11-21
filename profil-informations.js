// Zouzous Club V44 — profil personnel connecté à Supabase.
// Les préférences de thème et de notifications restent gérées par app.js.
const $ = id => document.getElementById(id);
let client = null;
let activeGroupId = null;
let activeUser = null;
let avatarPath = null;
let editing = false;

function formatBirthday(value) {
    if (!value) return 'Non renseigné';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? 'Non renseigné' : date.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function refreshPublicProfile() {
    const name = $('profilePseudo').value.trim() || 'Mon profil';
    $('profilePublicName').textContent = name;
    $('profilePublicBirthday').textContent = formatBirthday($('profileBirthday').value);
    $('profilePublicCity').textContent = $('profileCity').value.trim() || 'Non renseignée';
    $('profilePublicBio').textContent = $('profileBio').value.trim() || 'Aucune présentation pour le moment.';
    $('profilePublicInterests').textContent = $('profileInterests').value.trim() || 'Non renseignés';
}

function setProfileEdit(next) {
    editing = Boolean(next);
    $('profilePublicView').hidden = editing;
    $('profileEditView').hidden = !editing;
    const button = $('privateSpaceButton');
    if (button && !$('accountPage').hidden) button.textContent = editing ? 'Retour' : 'Modifier';
    if (!editing) refreshPublicProfile();
    document.querySelector('.shell > main')?.scrollTo(0, 0);
}

window.zouzousProfileSetEdit = setProfileEdit;
window.zouzousProfileToggleEdit = () => setProfileEdit(!editing);
window.zouzousProfileIsEditing = () => editing;


function setStatus(id, message, error = false) {
    const element = $(id);
    element.textContent = message;
    element.style.color = error ? '#b42342' : '';
}

function safeFileName(file) {
    const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
    return `${crypto.randomUUID()}.${extension}`;
}

async function showAvatar(path) {
    const image = $('profileAvatarPreview');
    image.src = './icon-192.png';
    $('profilePublicAvatar').src = image.src;
    if (!path || !client) return;
    const { data, error } = await client.storage.from('avatars-zouzous').createSignedUrl(path, 3600);
    if (!error && data?.signedUrl) image.src = data.signedUrl;
    const publicImage = $('profilePublicAvatar');
    if (publicImage) publicImage.src = image.src;
}

async function loadProfile() {
    if (!client || !activeUser) return;
    const { data, error } = await client.from('profils')
        .select('prenom,pseudo,anniversaire,avatar_url,bio,ville,centres_interet')
        .eq('id', activeUser.id)
        .maybeSingle();
    if (error) {
        setStatus('profileV44Status', `Chargement impossible : ${error.message}`, true);
        return;
    }
    $('profilePseudo').value = data?.pseudo || (data?.prenom !== 'Membre' ? data?.prenom || '' : '');
    $('profileBirthday').value = data?.anniversaire || '';
    $('profileBio').value = data?.bio || '';
    $('profileCity').value = data?.ville || '';
    $('profileInterests').value = data?.centres_interet || '';
    $('profileDisplayName').textContent = data?.pseudo || 'Mon profil';
    $('profileAccountEmail').textContent = activeUser.email || '';
    avatarPath = data?.avatar_url || null;
    await showAvatar(avatarPath);
    refreshPublicProfile();
    setStatus('profileV44Status', '');
}

window.addEventListener('zouzous:membership', async event => {
    if (!event.detail?.client || !event.detail?.groupId) {
        client = null;
        activeGroupId = null;
        activeUser = null;
        return;
    }
    client = event.detail.client;
    activeGroupId = event.detail.groupId;
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return;
    activeUser = user;
    await loadProfile();
});

$('profileV44Form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!client || !activeUser || !activeGroupId) return;
    const button = event.currentTarget.querySelector('button[type="submit"]');
    const pseudo = $('profilePseudo').value.trim();
    const birthday = $('profileBirthday').value || null;
    if (!pseudo || pseudo.length > 60) {
        setStatus('profileV44Status', 'Le pseudonyme doit comporter entre 1 et 60 caractères.', true);
        return;
    }
    if (birthday && (birthday > new Date().toISOString().slice(0, 10) || birthday < '1900-01-01')) {
        setStatus('profileV44Status', 'Vérifiez la date de naissance.', true);
        return;
    }
    button.disabled = true;
    try {
        const { data, error } = await client.from('profils').update({
            pseudo,
            // Maintient la compatibilité avec les écrans existants qui lisent « prenom ».
            prenom: pseudo,
            anniversaire: birthday,
            bio: $('profileBio').value.trim() || null,
            ville: $('profileCity').value.trim() || null,
            centres_interet: $('profileInterests').value.trim() || null
        }).eq('id', activeUser.id).select('id');
        if (error) throw error;
        if (!data?.length) throw new Error('Enregistrement refusé par Supabase.');
        $('profileDisplayName').textContent = pseudo;
        refreshPublicProfile();
        setProfileEdit(false);
        setStatus('profileV44Status', 'Profil enregistré avec succès.');
    } catch (error) {
        setStatus('profileV44Status', `Enregistrement impossible : ${error.message}`, true);
    } finally {
        button.disabled = false;
    }
});

$('profilePhotoSave').addEventListener('click', async () => {
    const file = $('profilePhoto').files?.[0];
    if (!client || !activeUser || !activeGroupId) return;
    if (!file) {
        setStatus('profilePhotoStatus', 'Choisissez une photo.', true);
        return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
        setStatus('profilePhotoStatus', 'Choisissez une image JPG, PNG ou WebP de 3 Mo maximum.', true);
        return;
    }
    const button = $('profilePhotoSave');
    button.disabled = true;
    const path = `${activeUser.id}/${safeFileName(file)}`;
    try {
        const { error: uploadError } = await client.storage.from('avatars-zouzous').upload(path, file, {
            contentType: file.type,
            upsert: false
        });
        if (uploadError) throw uploadError;
        const { error: updateError } = await client.from('profils')
            .update({ avatar_url: path }).eq('id', activeUser.id);
        if (updateError) throw updateError;
        avatarPath = path;
        await showAvatar(path);
        $('profilePhoto').value = '';
        setStatus('profilePhotoStatus', 'Photo de profil enregistrée.');
    } catch (error) {
        setStatus('profilePhotoStatus', `Photo non enregistrée : ${error.message}`, true);
    } finally {
        button.disabled = false;
    }
});

$('profilePasswordReset').addEventListener('click', async () => {
    if (!client || !activeUser?.email) return;
    const button = $('profilePasswordReset');
    button.disabled = true;
    try {
        const { error } = await client.auth.resetPasswordForEmail(activeUser.email, {
            redirectTo: new URL('./', location.href).href
        });
        if (error) throw error;
        setStatus('profilePasswordStatus', 'Un lien de changement de mot de passe a été demandé par e-mail.');
    } catch (error) {
        setStatus('profilePasswordStatus', `Demande impossible : ${error.message}`, true);
    } finally {
        button.disabled = false;
    }
});
