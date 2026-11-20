'use strict';
const pages = [
    { id: 'accueil', label: 'Accueil', icon: 'nav-accueil.png' },
    { id: 'agenda', label: 'Agenda', icon: 'nav-agenda.png' },
    { id: 'organiser', label: 'Organiser', icon: 'nav-organiser.png' },
    { id: 'partage', label: 'Partage', icon: 'nav-partage.png' },
    { id: 'groupe', label: 'Profil', icon: 'nav-profil.png' }
];
const storageKey = 'entre-nous-prototype-v1';
const initial = { events: [], polls: [], notes: [], tasks: [], ideas: [], expenses: [], birthdays: [], albums: [] };
let state;
try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    state = Object.fromEntries(Object.keys(initial).map(key => [key, Array.isArray(saved[key]) ? saved[key] : []]));
}
catch (error) {
    state = structuredClone(initial);
}
let page = 'accueil';
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const uid = () => crypto.randomUUID();
const save = () => localStorage.setItem(storageKey, JSON.stringify(state));
const dateLabel = value => value ? new Date(`${value}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
const item = (title, detail, actions = '') => `<div class="item row"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(detail)}</small></div>${actions}</div>`;
const empty = label => `<div class="empty">${escapeHtml(label)}</div>`;
const card = (title, body, wide = false) => `<section class="card${wide ? ' wide' : ''}"><h3>${title}</h3>${body}</section>`;
const input = (label, name, type = 'text', required = true) => `<label>${label}<input name="${name}" type="${type}" ${required ? 'required' : ''}></label>`;
const form = (kind, fields, label = 'Ajouter') => `<form class="form" data-form="${kind}">${fields}<button class="btn" type="submit">${label}</button></form>`;
const removeButton = (kind, id) => `<button class="btn danger" data-remove="${kind}" data-id="${id}" aria-label="Supprimer">Supprimer</button>`;
const upcoming = () => [...state.events].filter(event => event.date >= new Date().toLocaleDateString('en-CA')).sort((a, b) => a.date.localeCompare(b.date));
function home() {
    const next = upcoming().slice(0, 3);
    const openPolls = state.polls.filter(poll => !poll.closed);
    return `<div class="grid">${card('📅 Prochains événements', next.length ? next.map(event => item(event.title, dateLabel(event.date))).join('') : empty('Aucun événement à venir'))}${card('🗳️ Sondages ouverts', openPolls.length ? openPolls.map(poll => item(poll.title, `${poll.options.length} propositions`)).join('') : empty('Aucun sondage en cours'))}${card('📝 Pense-bêtes', state.notes.slice(-3).reverse().map(note => item(note.title, note.text)).join('') || empty('Aucune note'))}${card('✅ Tâches à faire', state.tasks.filter(task => !task.done).slice(0, 5).map(task => item(task.title, 'À réaliser')).join('') || empty('Tout est à jour !'))}</div>`;
}
function calendar() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const first = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const heads = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(day => `<div class="day head">${day}</div>`).join('');
    const blanks = Array.from({ length: first }, () => '<div class="day blank"></div>').join('');
    const days = Array.from({ length: count }, (_, index) => {
        const day = index + 1;
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const events = state.events.filter(event => event.date === iso);
        return `<div class="day ${events.length ? 'has' : ''}" title="${escapeHtml(events.map(event => event.title).join(', '))}">${day}${events.length ? ' •' : ''}</div>`;
    }).join('');
    return card(`🗓️ ${now.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`, `<div class="calendar">${heads}${blanks}${days}</div>`, true);
}
function agenda() {
    const events = [...state.events].sort((a, b) => a.date.localeCompare(b.date));
    return `<div class="grid">${calendar()}${card('Ajouter un événement', form('events', input('Titre', 'title') + input('Date', 'date', 'date') + input('Heure', 'time', 'time', false) + input('Lieu', 'place', 'text', false)))}${card('Tous les événements', events.map(event => item(event.title, `${dateLabel(event.date)}${event.time ? ' à ' + event.time : ''}${event.place ? ' · ' + event.place : ''}`, removeButton('events', event.id))).join('') || empty('Créez votre premier événement'))}</div>`;
}
function polls() {
    const fields = input('Question', 'title') + `<label>Choix proposés (un par ligne)<textarea name="options" required placeholder="Vendredi soir\nSamedi midi\nDimanche"></textarea></label>`;
    const listing = state.polls.map(poll => {
        const options = poll.options.map((option, index) => {
            const selected = poll.vote === index;
            return `<button class="vote${selected ? ' selected' : ''}" data-vote="${poll.id}" data-choice="${index}" ${poll.closed ? 'disabled' : ''}>${escapeHtml(option)}${selected ? ' ✓' : ''}</button>`;
        }).join('');
        return `<div class="item"><div class="row"><strong>${escapeHtml(poll.title)}</strong>${removeButton('polls', poll.id)}</div><div class="votes">${options}</div><p class="sub">${poll.closed ? 'Sondage clôturé' : 'Vote local de démonstration : une réponse par appareil'}</p><button class="btn secondary" data-close="${poll.id}" ${poll.closed ? 'disabled' : ''}>Clôturer</button></div>`;
    }).join('');
    return `<div class="grid">${card('Créer un sondage', form('polls', fields, 'Créer le sondage'))}${card('Sondages', listing || empty('Aucun sondage créé'))}</div>`;
}
function sharing() {
    const notes = card('📝 Pense-bêtes', form('notes', input('Titre', 'title') + `<label>Contenu<textarea name="text" required></textarea></label>`) + state.notes.map(note => item(note.title, note.text, removeButton('notes', note.id))).join(''));
    const tasks = card('✅ Listes et tâches', form('tasks', input('Tâche', 'title')) + state.tasks.map(task => `<div class="item row"><label class="check"><input type="checkbox" data-task="${task.id}" ${task.done ? 'checked' : ''}><span>${escapeHtml(task.title)}</span></label>${removeButton('tasks', task.id)}</div>`).join(''));
    const ideas = card('💡 Boîte à idées', form('ideas', input('Idée de sortie', 'title')) + state.ideas.map(idea => item(idea.title, 'Idée proposée', removeButton('ideas', idea.id))).join(''));
    const expenses = card('💶 Dépenses', form('expenses', input('Description', 'title') + input('Montant (€)', 'amount', 'number') + input('Payé par', 'payer') + input('Nombre de participants', 'participants', 'number')) + state.expenses.map(expense => item(expense.title, `${Number(expense.amount).toFixed(2)} € payés par ${expense.payer} · ${(Number(expense.amount) / Number(expense.participants)).toFixed(2)} € / personne`, removeButton('expenses', expense.id))).join(''));
    const albums = card('📷 Albums photos', form('albums', input('Nom de l’album', 'title')) + state.albums.map(album => item(album.title, 'Album créé (ajout de photos prévu avec Supabase)', removeButton('albums', album.id))).join(''));
    return `<div class="grid">${notes}${tasks}${ideas}${expenses}${albums}</div>`;
}
function group() {
    const birthdays = card('🎂 Anniversaires', form('birthdays', input('Prénom', 'title') + input('Date de naissance', 'date', 'date')) + state.birthdays.map(person => item(person.title, dateLabel(person.date), removeButton('birthdays', person.id))).join(''));
    return `<div class="grid">${card('👥 Notre groupe', '<p>6 à 10 membres prévus.</p><p>Les comptes, les invitations et les rôles sont gérés par Supabase dans la section « Membres et accès » sous les modules.</p>')}${birthdays}${card('🔔 Notifications', '<p>Préférences et notifications push prévues dans la version connectée.</p>')}${card('🔒 Confidentialité', '<p>Cette démonstration conserve ses données dans le navigateur actuel. Ne saisissez pas d’informations sensibles.</p>')}</div>`;
}
function render() {
    $('pageTitle').textContent = pages.find(entry => entry.id === page).label;
    $('desktopNav').innerHTML = pages.map(entry => `<button data-page="${entry.id}" class="${page === entry.id ? 'active' : ''}"><img class="nav-icon" src="./${entry.icon}" alt="" aria-hidden="true" width="21" height="21"><span>${entry.label}</span></button>`).join('');
    $('mobileNav').innerHTML = pages.map(entry => `<button data-page="${entry.id}" class="${page === entry.id ? 'active' : ''}"><span class="nav-icon-wrap"><img class="nav-icon" src="./${entry.icon}" alt="" aria-hidden="true" width="21" height="21"></span>${entry.label}</button>`).join('');
    $('content').innerHTML = page === 'groupe' ? '' : ({ accueil: home, agenda, organiser: polls, partage: sharing })[page]();
    // Affichage explicite de la rubrique active : ne dépend pas de l'ordre
    // de chargement des scripts et rétablit les contenus après chaque clic.
    const profilePage = $('profilePage');
    const content = $('content');
    const notice = document.querySelector('.shell main > .notice');
    const isProfile = page === 'groupe';

    content.hidden = isProfile;

    if (profilePage) {
        profilePage.hidden = !isProfile;
    }

    if (notice) {
        notice.hidden = isProfile;
    }
}
document.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button)
    return;
    if (button.dataset.page) {
        page = button.dataset.page;
        render();
        return;
    }
    if (button.dataset.remove) {
        const { remove, id } = button.dataset;
        state[remove] = state[remove].filter(entry => entry.id !== id);
        save();
        render();
        return;
    }
    if (button.dataset.vote) {
        const poll = state.polls.find(entry => entry.id === button.dataset.vote);
        if (poll && !poll.closed) {
            poll.vote = Number(button.dataset.choice);
            save();
            render();
        }
        return;
    }
    if (button.dataset.close) {
        const poll = state.polls.find(entry => entry.id === button.dataset.close);
        if (poll) {
            poll.closed = true;
            save();
            render();
        }
    }
});
document.addEventListener('change', event => {
    const taskId = event.target.dataset.task;
    if (!taskId)
    return;
    const task = state.tasks.find(entry => entry.id === taskId);
    if (task) {
        task.done = event.target.checked;
        save();
        render();
    }
});
document.addEventListener('input', event => { if (event.target.setCustomValidity)
    event.target.setCustomValidity(''); });
document.addEventListener('submit', event => {
    const formElement = event.target.closest('form[data-form]');
    if (!formElement)
    return;
    event.preventDefault();
    const kind = formElement.dataset.form;
    const data = Object.fromEntries(new FormData(formElement).entries());
    if (kind === 'polls') {
        data.options = data.options.split('\n').map(option => option.trim()).filter(Boolean);
        if (data.options.length < 2) {
            formElement.querySelector('textarea').setCustomValidity('Ajoutez au moins deux propositions.');
            formElement.reportValidity();
            return;
        }
        data.vote = null;
        data.closed = false;
    }
    if (kind === 'tasks')
    data.done = false;
    if (kind === 'expenses' && (Number(data.amount) <= 0 || Number(data.participants) < 1 || !Number.isInteger(Number(data.participants)))) {
        formElement.querySelector('[name=participants]').setCustomValidity('Saisissez un montant positif et un nombre entier de participants.');
        formElement.reportValidity();
        return;
    }
    state[kind].push({ id: uid(), ...data });
    save();
    render();
});
render();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
}
