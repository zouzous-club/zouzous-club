// Consultation des fiches des membres actifs du cercle — V46.
// Ne permet aucune modification du profil d'un autre membre.
const panel = document.getElementById('circleMemberProfile');
let db = null;
let groupId = null;
let ownId = null;

function formatDate(value) {
    if (!value) return 'Non renseigné';
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? 'Non renseigné' : date.toLocaleDateString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric'
    });
}

function createText(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
}

function detail(list, label, value) {
    const row = document.createElement('div');
    row.append(createText('dt', label), createText('dd', value));
    list.append(row);
}

async function openMember(id) {
    if (!db || !groupId || !id || !panel) return;
    panel.replaceChildren(createText('p', 'Chargement du profil…'));
    panel.hidden = false;
    try {
        // Vérification explicite de l'appartenance active au groupe courant.
        const { data: membership, error: memberError } = await db.from('membres_groupes')
            .select('utilisateur_id').eq('groupe_id', groupId)
            .eq('utilisateur_id', id).eq('statut', 'actif').maybeSingle();
        if (memberError) throw memberError;
        if (!membership) throw new Error('Ce membre ne fait plus partie du cercle.');
        const { data: profile, error } = await db.from('profils')
            .select('pseudo,prenom,anniversaire,ville,bio,centres_interet,avatar_url')
            .eq('id', id).maybeSingle();
        if (error) throw error;
        if (!profile) throw new Error('Profil indisponible.');
        panel.replaceChildren();
        const back = createText('button', '← Retour aux amis', 'btn secondary');
        back.type = 'button';
        back.addEventListener('click', () => { panel.hidden = true; panel.replaceChildren(); });
        panel.append(back);
        const heading = document.createElement('div');
        heading.className = 'profile-heading';
        const avatar = document.createElement('img');
        avatar.className = 'profile-avatar';
        avatar.alt = 'Photo de profil';
        avatar.src = './icon-192.png';
        if (profile.avatar_url) {
            const { data: signed } = await db.storage.from('avatars-zouzous')
                .createSignedUrl(profile.avatar_url, 3600);
            if (signed?.signedUrl) avatar.src = signed.signedUrl;
        }
        const title = createText('h3', (profile.pseudo || profile.prenom || 'Membre') + (id === ownId ? ' (moi)' : ''));
        heading.append(avatar, title);
        panel.append(heading);
        const dl = document.createElement('dl');
        detail(dl, 'Anniversaire', formatDate(profile.anniversaire));
        detail(dl, 'Ville', profile.ville || 'Non renseignée');
        detail(dl, 'Présentation', profile.bio || 'Aucune présentation pour le moment.');
        detail(dl, 'Centres d’intérêt', profile.centres_interet || 'Non renseignés');
        panel.append(dl);
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
        panel.replaceChildren(createText('p', 'Profil indisponible : ' + error.message));
    }
}

document.getElementById('membersList')?.addEventListener('click', event => {
    const button = event.target.closest('button[data-member-id]');
    if (button) openMember(button.dataset.memberId);
});

window.addEventListener('zouzous:membership', async event => {
    db = event.detail?.client || null;
    groupId = event.detail?.groupId || null;
    panel.hidden = true;
    panel.replaceChildren();
    if (!db) { ownId = null; return; }
    const { data: { user } } = await db.auth.getUser();
    ownId = user?.id || null;
});
