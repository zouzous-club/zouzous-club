'use strict';
const pages = [
    { id: 'accueil', label: 'Accueil', icon: 'nav-accueil.png' },
    { id: 'agenda', label: 'Agenda', icon: 'nav-agenda.png' },
    { id: 'organiser', label: 'Organiser', icon: 'nav-organiser.png' },
    { id: 'partage', label: 'Partage', icon: 'nav-partage.png' },
    { id: 'groupe', label: 'Profil', icon: 'nav-profil.png' }
];
const storageKey = 'entre-nous-prototype-v1';
const initial = { events: [], polls: [], notes: [], tasks: [], ideas: [], expenses: [], birthdays: [], albums: [], posts: [] };
let state;
try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
    state = Object.fromEntries(Object.keys(initial).map(key => [key, Array.isArray(saved[key]) ? saved[key] : []]));
}
catch (error) {
    state = structuredClone(initial);
}
let page = 'accueil';
let displayedMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
const $ = id => document.getElementById(id);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const uid = () => crypto.randomUUID();
const eventTypes = {
    restaurant: { label: 'Restaurant', icon: '🍽️' },
    cinema: { label: 'Cinéma', icon: '🎬' },
    sport: { label: 'Sport', icon: '⚽' },
    concert: { label: 'Concert', icon: '🎵' },
    fete: { label: 'Fête', icon: '🎉' },
    voyage: { label: 'Voyage', icon: '✈️' },
    cafe: { label: 'Café', icon: '☕' },
    autre: { label: 'Autre', icon: '📅' }
};
const eventIcon = event => eventTypes[event.category]?.icon || eventTypes.autre.icon;
const mapsLink = address => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
const eventCategories = () => `<label>Type d’événement
    <select name="category" required>
        ${Object.entries(eventTypes).map(([value, entry]) => `<option value="${value}">${entry.icon} ${entry.label}</option>`).join('')}
    </select>
</label>`;

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
    const year = displayedMonth.getFullYear();
    const month = displayedMonth.getMonth();
    const first = (new Date(year, month, 1).getDay() + 6) % 7;
    const count = new Date(year, month + 1, 0).getDate();
    const monthLabel = displayedMonth.toLocaleDateString('fr-FR', {
        month: 'long',
        year: 'numeric'
    });

    const headings = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
        .map(day => `<div class="day head">${day}</div>`)
        .join('');
    const blanks = Array.from({ length: first }, () => '<div class="day blank"></div>').join('');
    const days = Array.from({ length: count }, (_, index) => {
        const day = index + 1;
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const events = state.events.filter(entry => entry.date === iso);
        const eventCount = events.length;
        const accessibleLabel = `${dateLabel(iso)} : ${eventCount} événement${eventCount > 1 ? 's' : ''}`;

        return `<button type="button" class="day calendar-date ${eventCount ? 'has' : ''}"
            data-calendar-date="${iso}" aria-label="${escapeHtml(accessibleLabel)}"
            title="${escapeHtml(accessibleLabel)}">${'<span class="day-number">' + day + '</span>'}${eventCount ? `<span class="day-event-icons" aria-hidden="true">${[...new Set(events.map(eventIcon))].slice(0, 3).map(icon => `<span>${icon}</span>`).join('')}${new Set(events.map(eventIcon)).size > 3 ? '<span>+</span>' : ''}</span>` : ''}</button>`;
    }).join('');

    return `<section class="card wide">
        <div class="calendar-heading">
            <h3>🗓️ ${escapeHtml(monthLabel)}</h3>
            <div class="calendar-navigation">
                <button type="button" data-month-change="-1" aria-label="Mois précédent">‹</button>
                <button type="button" data-month-change="1" aria-label="Mois suivant">›</button>
            </div>
        </div>
        <div class="calendar">${headings}${blanks}${days}</div>
    </section>`;
}

function openDay(iso) {
    const events = state.events
        .filter(entry => entry.date === iso)
        .sort((left, right) => (left.time || '00:00').localeCompare(right.time || '00:00'));
    const date = new Date(`${iso}T12:00:00`);
    const heading = date.toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
    const startHour = 0;
    const endHour = 24;
    const slots = Array.from({ length: endHour - startHour }, (_, index) => {
        const hour = index + startHour;
        const eventsAtHour = events.filter(entry => {
            return entry.time && Number(entry.time.split(':')[0]) === hour;
        });
        return `<div class="timeline-row">
            <span class="timeline-hour">${String(hour).padStart(2, '0')}:00</span>
            <div class="timeline-slot">${eventsAtHour.map(timelineEvent).join('')}</div>
        </div>`;
    }).join('');
    const noTime = events.filter(entry => !entry.time);
    $('editorTitle').textContent = heading.charAt(0).toUpperCase() + heading.slice(1);
    $('editorBody').innerHTML = `<div class="day-details">
        <div class="day-timeline-header">
            <strong>${events.length} événement${events.length > 1 ? 's' : ''}</strong>
            <button type="button" class="btn day-add-button" data-add-on-date="${iso}">+ Ajouter</button>
        </div>
        ${noTime.length ? `<div class="all-day-events"><strong>Sans horaire</strong>${noTime.map(timelineEvent).join('')}</div>` : ''}
        <div class="day-timeline">${slots}</div>
    </div>`;
    $('editorOverlay').hidden = false;
    $('editorOverlay').scrollTop = 0;
    document.body.classList.add('editor-open');
}

function timelineEvent(entry) {
    return `<article class="timeline-event">
        <div class="timeline-event-heading"><span aria-hidden="true">${eventIcon(entry)}</span><strong>${escapeHtml(entry.title)}</strong></div>
        ${entry.time ? `<span class="timeline-event-time">${escapeHtml(entry.time)}</span>` : ''}
        ${entry.place ? `<a class="event-location" href="${mapsLink(entry.place)}" target="_blank" rel="noopener noreferrer">📍 ${escapeHtml(entry.place)} · Ouvrir Maps</a>` : ''}
    </article>`;
}

const addButton = (kind, title) => `<button type="button" class="add-button" data-add="${kind}" aria-label="Ajouter : ${escapeHtml(title)}" title="Ajouter"><img src="./plus.png" alt="" aria-hidden="true" width="16" height="16"></button>`;
const section = (title, kind, body) => `<section class="card"><div class="section-heading"><h3>${title}</h3>${addButton(kind, title)}</div>${body}</section>`;
const editorDefinitions = {
    events: { title: 'Nouvel événement', fields: input('Titre', 'title') + eventCategories() + input('Date', 'date', 'date') + input('Heure', 'time', 'time', false) + input('Adresse ou lieu (ouvrable dans Maps)', 'place', 'text', false) },
    polls: { title: 'Nouveau sondage', fields: input('Question', 'title') + `<label>Choix proposés (un par ligne)<textarea name="options" required placeholder="Vendredi soir\nSamedi midi\nDimanche"></textarea></label>` },
    notes: { title: 'Nouveau pense-bête', fields: input('Titre', 'title') + `<label>Contenu<textarea name="text" required></textarea></label>` },
    tasks: { title: 'Nouvelle tâche', fields: input('Tâche', 'title') },
    ideas: { title: 'Nouvelle idée', fields: input('Idée de sortie', 'title') },
    expenses: { title: 'Nouvelle dépense', fields: input('Description', 'title') + input('Montant (€)', 'amount', 'number') + input('Payé par', 'payer') + input('Nombre de participants', 'participants', 'number') },
    albums: { title: 'Nouvel album', fields: input('Nom de l’album', 'title') },
    posts: { title: 'Nouvelle publication', fields: `<label>Votre message<textarea name="text" required placeholder="Quoi de neuf chez les zouzous ?"></textarea></label>` }
};
function openEditor(kind) {
    const definition = editorDefinitions[kind];
    if (!definition) return;
    $('editorTitle').textContent = definition.title;
    $('editorBody').innerHTML = form(kind, definition.fields, kind === 'posts' ? 'Publier' : 'Ajouter');
    $('editorOverlay').hidden = false;
    $('editorOverlay').scrollTop = 0;
    document.body.classList.add('editor-open');
    // Ne pas ouvrir le clavier avant que l'utilisateur touche un champ.
}
function closeEditor() {
    $('editorOverlay').hidden = true;
    document.body.classList.remove('editor-open');
    $('editorBody').replaceChildren();
}
function agenda() {
    const events = [...state.events].sort((a, b) => a.date.localeCompare(b.date));
    return `<div class="grid">${calendar()}${section('Tous les événements', 'events', events.map(event => item(`${eventIcon(event)} ${event.title}`, `${dateLabel(event.date)}${event.time ? ' à ' + event.time : ''}${event.place ? ' · ' + event.place : ''}`, removeButton('events', event.id))).join('') || empty('Créez votre premier événement'))}</div>`;
}
function organiser() {
    const posts = [...state.posts].reverse();
    return `<div class="feed-heading"><div><h3>Le fil des zouzous</h3><p class="sub">Messages et nouvelles du groupe</p></div>${addButton('posts', 'une publication')}</div><div class="feed">${posts.map(post => `<article class="card post"><div class="row"><strong>Publication</strong>${removeButton('posts', post.id)}</div><p class="post-text">${escapeHtml(post.text)}</p><small>${escapeHtml(post.createdAt || '')}</small></article>`).join('') || empty('Aucune publication pour le moment. Touchez + pour écrire un message.')}</div><p class="sub">L’ajout de photos et la synchronisation entre membres seront disponibles avec la connexion des publications à Supabase.</p>`;
}
function pollListing() {
    return state.polls.map(poll => {
        const options = poll.options.map((option, index) => {
            const selected = poll.vote === index;
            return `<button class="vote${selected ? ' selected' : ''}" data-vote="${poll.id}" data-choice="${index}" ${poll.closed ? 'disabled' : ''}>${escapeHtml(option)}${selected ? ' ✓' : ''}</button>`;
        }).join('');
        return `<div class="item"><div class="row"><strong>${escapeHtml(poll.title)}</strong>${removeButton('polls', poll.id)}</div><div class="votes">${options}</div><p class="sub">${poll.closed ? 'Sondage clôturé' : 'Vote local de démonstration'}</p><button class="btn secondary" data-close="${poll.id}" ${poll.closed ? 'disabled' : ''}>Clôturer</button></div>`;
    }).join('');
}
function sharing() {
    const notes = section('📝 Pense-bêtes', 'notes', state.notes.map(note => item(note.title, note.text, removeButton('notes', note.id))).join('') || empty('Aucune note'));
    const tasks = section('✅ Listes et tâches', 'tasks', state.tasks.map(task => `<div class="item row"><label class="check"><input type="checkbox" data-task="${task.id}" ${task.done ? 'checked' : ''}><span>${escapeHtml(task.title)}</span></label>${removeButton('tasks', task.id)}</div>`).join('') || empty('Aucune tâche'));
    const ideas = section('💡 Boîte à idées', 'ideas', state.ideas.map(idea => item(idea.title, 'Idée proposée', removeButton('ideas', idea.id))).join('') || empty('Aucune idée'));
    const expenses = section('💶 Dépenses', 'expenses', state.expenses.map(expense => item(expense.title, `${Number(expense.amount).toFixed(2)} € payés par ${expense.payer} · ${(Number(expense.amount) / Number(expense.participants)).toFixed(2)} € / personne`, removeButton('expenses', expense.id))).join('') || empty('Aucune dépense'));
    const albums = section('📷 Albums photos', 'albums', state.albums.map(album => item(album.title, 'Album créé · Photos à venir', removeButton('albums', album.id))).join('') || empty('Aucun album'));
    return `<div class="grid">${section('🗳️ Sondages', 'polls', pollListing() || empty('Aucun sondage'))}${notes}${tasks}${ideas}${expenses}${albums}</div>`;
}
function group() {
    const birthdays = card('🎂 Anniversaires', form('birthdays', input('Prénom', 'title') + input('Date de naissance', 'date', 'date')) + state.birthdays.map(person => item(person.title, dateLabel(person.date), removeButton('birthdays', person.id))).join(''));
    return `<div class="grid">${card('👥 Notre groupe', '<p>6 à 10 membres prévus.</p><p>Les comptes, les invitations et les rôles sont gérés par Supabase dans la section « Membres et accès » sous les modules.</p>')}${birthdays}${card('🔔 Notifications', '<p>Préférences et notifications push prévues dans la version connectée.</p>')}${card('🔒 Confidentialité', '<p>Cette démonstration conserve ses données dans le navigateur actuel. Ne saisissez pas d’informations sensibles.</p>')}</div>`;
}
function render() {
    $('pageTitle').textContent = pages.find(entry => entry.id === page).label;
    $('desktopNav').innerHTML = pages.map(entry => `<button data-page="${entry.id}" class="${page === entry.id ? 'active' : ''}"><img class="nav-icon" src="./${entry.icon}" alt="" aria-hidden="true" width="21" height="21"><span>${entry.label}</span></button>`).join('');
    $('mobileNav').innerHTML = pages.map(entry => `<button data-page="${entry.id}" class="${page === entry.id ? 'active' : ''}"><span class="nav-icon-wrap"><img class="nav-icon" src="./${entry.icon}" alt="" aria-hidden="true" width="21" height="21"></span>${entry.label}</button>`).join('');
    $('content').innerHTML = page === 'groupe' ? '' : ({ accueil: home, agenda, organiser, partage: sharing })[page]();
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
        document.querySelector('.shell > main')?.scrollTo(0, 0);
        return;
    }
    if (button.dataset.monthChange) {
        displayedMonth = new Date(
            displayedMonth.getFullYear(),
            displayedMonth.getMonth() + Number(button.dataset.monthChange),
            1
        );
        render();
        return;
    }
    if (button.dataset.calendarDate) {
        openDay(button.dataset.calendarDate);
        return;
    }
    if (button.dataset.addOnDate) {
        const selectedDate = button.dataset.addOnDate;
        openEditor('events');
        const dateInput = $('editorBody').querySelector('input[name="date"]');
        if (dateInput) {
            dateInput.value = selectedDate;
        }
        return;
    }
    if (button.dataset.add) {
        openEditor(button.dataset.add);
        return;
    }
    if (button.id === 'editorClose') {
        closeEditor();
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
    state[kind].push({ id: uid(), ...data, ...(kind === 'posts' ? { createdAt: new Date().toLocaleString('fr-FR') } : {}) });
    save();
    if (kind === 'events' && data.date) {
        displayedMonth = new Date(`${data.date}T12:00:00`);
    }
    closeEditor();
    render();
});
$('editorOverlay').addEventListener('click', event => {
    if (event.target === $('editorOverlay')) closeEditor();
});
document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !$('editorOverlay').hidden) closeEditor();
});
render();
if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('./sw.js').catch(() => { });
}
