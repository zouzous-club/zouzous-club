// Administration du cercle : rôles et invitations — V51.
// Les autorisations sont vérifiées côté Supabase, jamais uniquement dans l'interface.
let circleAdminContext = null;

function circleAdminNode(tag, content, className = '') {
    const element = document.createElement(tag);
    element.textContent = content;
    if (className) {
        element.className = className;
    }
    return element;
}

function circleAdminStatus(id, message) {
    const element = document.getElementById(id);
    if (element) {
        element.textContent = message;
    }
}

async function circleAdminLoadInvitations() {
    const card = document.getElementById('circlePendingCard');
    const list = document.getElementById('circlePendingList');
    if (!card || !list || !circleAdminContext || circleAdminContext.role !== 'administrateur') {
        if (card) card.hidden = true;
        return;
    }
    card.hidden = false;
    list.replaceChildren(circleAdminNode('p', 'Chargement des invitations…'));
    const { data, error } = await circleAdminContext.client.rpc('lister_invitations_cercle_v51', {
        p_groupe_id: circleAdminContext.groupId
    });
    if (error) {
        list.replaceChildren(circleAdminNode('p', 'Impossible de consulter les invitations. Vérifie que SQL V51 est installé.'));
        return;
    }
    list.replaceChildren();
    if (!data?.length) {
        list.append(circleAdminNode('p', 'Aucune invitation en attente.'));
        return;
    }
    for (const invitation of data) {
        const row = circleAdminNode('div', '', 'circle-admin-row');
        const details = circleAdminNode('div', '', 'circle-admin-details');
        details.append(circleAdminNode('strong', invitation.email));
        const expired = invitation.expire_le && new Date(invitation.expire_le) < new Date();
        details.append(circleAdminNode('small', `${invitation.role_attribue === 'administrateur' ? 'Administrateur' : invitation.role_attribue === 'moderateur' ? 'Modérateur' : 'Membre'} · ${expired ? 'Expirée' : 'En attente'}`));
        const button = circleAdminNode('button', 'Annuler', 'btn secondary');
        button.type = 'button';
        button.addEventListener('click', () => circleAdminConfirmCancel(invitation, row));
        row.append(details, button);
        list.append(row);
    }
}

function circleAdminConfirmCancel(invitation, row) {
    const existing = row.querySelector('.circle-admin-confirm');
    if (existing) {
        existing.remove();
        return;
    }
    const confirm = circleAdminNode('div', '', 'circle-admin-confirm');
    confirm.append(circleAdminNode('p', `Annuler l'invitation envoyée à ${invitation.email} ?`));
    const yes = circleAdminNode('button', 'Confirmer l’annulation', 'btn');
    const no = circleAdminNode('button', 'Retour', 'btn secondary');
    yes.type = 'button';
    no.type = 'button';
    no.addEventListener('click', () => confirm.remove());
    yes.addEventListener('click', async () => {
        yes.disabled = true;
        const { error } = await circleAdminContext.client.rpc('annuler_invitation_cercle_v51', {
            p_groupe_id: circleAdminContext.groupId,
            p_invitation_id: invitation.id
        });
        circleAdminStatus('circlePendingMessage', error ? `Annulation impossible : ${error.message}` : 'Invitation annulée.');
        await circleAdminLoadInvitations();
    });
    confirm.append(yes, no);
    row.append(confirm);
}

function circleAdminRenderRoles() {
    const list = document.getElementById('circleRoleActions');
    if (!list) return;
    list.replaceChildren();
    if (!circleAdminContext || circleAdminContext.role !== 'administrateur') {
        list.hidden = true;
        return;
    }
    list.hidden = false;
    const members = circleAdminContext.members || [];
    const admins = members.filter(member => member.role === 'administrateur').length;
    for (const member of members) {
        const row = circleAdminNode('div', '', 'circle-admin-row');
        const label = circleAdminNode('label', member.name, 'circle-admin-details');
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Rôle de ${member.name}`);
        for (const value of ['membre', 'moderateur', 'administrateur']) {
            const option = circleAdminNode('option', value === 'membre' ? 'Membre' : value === 'moderateur' ? 'Modérateur' : 'Administrateur');
            option.value = value;
            select.append(option);
        }
        select.value = member.role;
        if (member.role === 'administrateur' && admins <= 1) {
            select.disabled = true;
            select.title = 'Le dernier administrateur ne peut pas être rétrogradé.';
        }
        select.addEventListener('change', () => circleAdminConfirmRole(member, select, row));
        row.append(label, select);
        list.append(row);
    }
}

function circleAdminConfirmRole(member, select, row) {
    row.querySelector('.circle-admin-confirm')?.remove();
    const desired = select.value;
    if (desired === member.role) return;
    const confirm = circleAdminNode('div', '', 'circle-admin-confirm');
    confirm.append(circleAdminNode('p', `Attribuer le rôle « ${desired} » à ${member.name} ?`));
    const yes = circleAdminNode('button', 'Enregistrer le rôle', 'btn');
    const no = circleAdminNode('button', 'Annuler', 'btn secondary');
    yes.type = 'button';
    no.type = 'button';
    no.addEventListener('click', () => {
        select.value = member.role;
        confirm.remove();
    });
    yes.addEventListener('click', async () => {
        yes.disabled = true;
        const { error } = await circleAdminContext.client.rpc('modifier_role_membre_cercle_v52', {
            p_groupe_id: circleAdminContext.groupId,
            p_utilisateur_id: member.id,
            p_nouveau_role: desired
        });
        if (error) {
            circleAdminStatus('circleRoleMessage', `Modification impossible : ${error.message}`);
            select.value = member.role;
            confirm.remove();
            return;
        }
        member.role = desired;
        circleAdminStatus('circleRoleMessage', 'Rôle enregistré. Recharge la page pour actualiser les droits et la liste des amis.');
        circleAdminRenderRoles();
    });
    confirm.append(yes, no);
    row.append(confirm);
}

window.addEventListener('zouzous:membership', event => {
    if (!event.detail) {
        circleAdminContext = null;
        document.getElementById('circlePendingCard')?.setAttribute('hidden', '');
        document.getElementById('circleRoleActions')?.setAttribute('hidden', '');
    }
});

window.addEventListener('zouzous:members-loaded', event => {
    circleAdminContext = event.detail;
    circleAdminRenderRoles();
    circleAdminLoadInvitations();
});

window.addEventListener('zouzous:invitations-changed', () => {
    circleAdminLoadInvitations();
});
