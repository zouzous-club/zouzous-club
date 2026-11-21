'use strict';
const pages = [
    { id: 'accueil', label: 'Accueil', icon: 'nav-accueil.png' },
    { id: 'agenda', label: 'Agenda', icon: 'nav-agenda.png' },
    { id: 'organiser', label: 'Organiser', icon: 'nav-organiser.png' },
    { id: 'partage', label: 'Partage', icon: 'nav-partage.png' },
    { id: 'groupe', label: 'Mon cercle', icon: 'nav-profil.png' }
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
let agendaView = 'mois';
let selectedDate = new Date().toLocaleDateString('en-CA');
const themeKey = 'zouzous-club-theme';
const themeChoices = ['auto', 'clair', 'sombre'];
let themePreference = localStorage.getItem(themeKey) || 'auto';

function applyTheme() {
    const dark = themePreference === 'sombre' || (
        themePreference === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches
    );

    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';

    const control = document.getElementById('themePreference');
    if (control) control.value = themePreference;
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
document.getElementById('themePreference')?.addEventListener('change', event => {
    themePreference = event.target.value;
    localStorage.setItem(themeKey, themePreference);
    applyTheme();
});
applyTheme();

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
const upcoming = () => [...state.events].filter(event => event.date >= dateISO(new Date())).sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
function home() {
    const today = dateISO(new Date());
    const lastDay = addDays(today, 30);
    const next = upcoming().filter(event => event.date <= lastDay);
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
        .map(day => `<div class="day head" aria-hidden="true">${day}</div>`)
        .join('');
    const blanks = Array.from({ length: first }, (_, index) => {
        const previousDate = new Date(year, month, index - first + 1);
        const previousDay = previousDate.getDate();
        return `<div class="day calendar-outside" aria-hidden="true"><span class="day-number">${previousDay}</span></div>`;
    }).join('');
    const days = Array.from({ length: count }, (_, index) => {
        const day = index + 1;
        const iso = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const events = state.events.filter(entry => entry.date === iso);
        const eventCount = events.length;
        const accessibleLabel = `${dateLabel(iso)} : ${eventCount} événement${eventCount > 1 ? 's' : ''}`;

        return `<button type="button" class="day calendar-date weekday-${(first + index) % 7} ${eventCount ? 'has' : ''} ${iso === dateISO(new Date()) ? 'is-today' : ''}"
            data-calendar-date="${iso}" aria-label="${escapeHtml(accessibleLabel)}"
            title="${escapeHtml(accessibleLabel)}">${'<span class="day-number">' + day + '</span>'}${eventCount ? `<span class="day-event-icons" aria-hidden="true">${events.slice(0, 2).map(entry => `<span>${eventIcon(entry)}</span>`).join('')}${eventCount > 2 ? `<span class="calendar-more">+${eventCount - 2}</span>` : ''}</span>` : ''}</button>`;
    }).join('');
    const trailing = Array.from({ length: 42 - first - count }, (_, index) => {
        const nextDay = index + 1;
        return `<div class="day calendar-outside" aria-hidden="true"><span class="day-number">${nextDay}</span></div>`;
    }).join('');

    return `<section class="card wide">
        <div class="calendar-heading">
            <h3>🗓️ ${escapeHtml(monthLabel)}</h3>
            ${addButton('events', 'un événement')}
            <div class="calendar-navigation">
                <button type="button" data-month-change="-1" aria-label="Mois précédent">‹</button>
                <button type="button" data-month-change="1" aria-label="Mois suivant">›</button>
            </div>
        </div>
        <div class="calendar">${headings}${blanks}${days}${trailing}</div>
    </section>`;
}

function dateISO(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function addDays(iso, offset) {
    const date = new Date(`${iso}T12:00:00`);
    date.setDate(date.getDate() + offset);
    return dateISO(date);
}

function minutes(value) {
    if (!value) return null;
    const [hours, mins] = value.split(':').map(Number);
    return hours * 60 + mins;
}

function eventBounds(entry) {
    const start = minutes(entry.time);
    if (start === null) return null;
    const requestedEnd = minutes(entry.endTime);
    const end = requestedEnd !== null && requestedEnd > start ? requestedEnd : start + 60;
    return { start, end: Math.min(1440, end) };
}

function eventEditorButton(entry, label = 'Modifier') {
    return `<button type="button" class="event-edit" data-edit-event="${escapeHtml(entry.id)}" aria-label="Modifier ${escapeHtml(entry.title)}">${label}</button>`;
}

function timelineEvent(entry) {
    const bounds = eventBounds(entry);
    const timeLabel = bounds ? `${entry.time} – ${String(Math.floor(bounds.end / 60)).padStart(2, '0')}:${String(bounds.end % 60).padStart(2, '0')}` : 'Toute la journée';
    return `<article class="timeline-event">
        <div class="timeline-event-heading"><span aria-hidden="true">${eventIcon(entry)}</span><strong>${escapeHtml(entry.title)}</strong>${eventEditorButton(entry)}</div>
        <span class="timeline-event-time">${escapeHtml(timeLabel)}</span>
        ${entry.place ? `<a class="event-location" href="${mapsLink(entry.place)}" target="_blank" rel="noopener noreferrer">📍 ${escapeHtml(entry.place)} · Maps</a>` : ''}
    </article>`;
}

function timeGrid(iso) {
    const entries = state.events.filter(entry => entry.date === iso);
    const timed = entries.filter(entry => eventBounds(entry));
    const allDay = entries.filter(entry => !eventBounds(entry));
    const ordered = timed.map(entry => ({ entry, ...eventBounds(entry) }))
        .sort((a, b) => a.start - b.start || b.end - a.end);
    const clusters = [];
    let cluster = [];
    let clusterEnd = -1;
    for (const event of ordered) {
        if (cluster.length && event.start >= clusterEnd) {
            clusters.push(cluster);
            cluster = [];
            clusterEnd = -1;
        }
        cluster.push(event);
        clusterEnd = Math.max(clusterEnd, event.end);
    }
    if (cluster.length) clusters.push(cluster);
    for (const group of clusters) {
        const active = [];
        let maxColumns = 0;
        for (const event of group) {
            for (let i = 0; i < active.length; i++) {
                if (active[i] <= event.start) active[i] = -1;
            }
            let column = active.findIndex(end => end < 0);
            if (column === -1) column = active.length;
            active[column] = event.end;
            event.column = column;
            maxColumns = Math.max(maxColumns, column + 1);
        }
        group.forEach(event => { event.columns = maxColumns; });
    }
    const hours = Array.from({ length: 24 }, (_, hour) => `<div class="hour-line" style="top:${hour * 72}px"><span>${String(hour).padStart(2, '0')}:00</span></div>`).join('');
    const blocks = ordered.map(event => {
        const top = event.start * 72 / 60;
        const height = Math.max(24, (event.end - event.start) * 72 / 60 - 3);
        const left = event.column * 100 / event.columns;
        const width = 100 / event.columns;
        return `<article class="hour-event" style="top:${top}px;height:${height}px;left:calc(${left}% + 3px);width:calc(${width}% - 6px)" data-event-card="${escapeHtml(event.entry.id)}">
            <strong>${eventIcon(event.entry)} ${escapeHtml(event.entry.title)}</strong>
            <small>${escapeHtml(event.entry.time)}${event.entry.endTime ? '–' + escapeHtml(event.entry.endTime) : ''}</small>
            ${event.entry.place ? `<a href="${mapsLink(event.entry.place)}" target="_blank" rel="noopener noreferrer" class="hour-place">📍 ${escapeHtml(event.entry.place)}</a>` : ''}
        </article>`;
    }).join('');
    return `<div class="day-column" data-day="${iso}">
        <div class="day-column-title">${new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
        ${allDay.length ? `<div class="all-day-events">${allDay.map(timelineEvent).join('')}</div>` : ''}
        <div class="hour-grid"><div class="hour-grid-lines">${hours}</div><div class="hour-grid-events">${blocks}</div></div>
    </div>`;
}

function dayView(twoDays = false) {
    const dates = twoDays ? [selectedDate, addDays(selectedDate, 1)] : [selectedDate];
    return `<section class="card wide agenda-timed-card">
        <div class="calendar-heading"><h3>${twoDays ? 'Deux jours' : 'Journée'} · ${dateLabel(selectedDate)}</h3>${addButton('events', 'un événement')}
            <div class="calendar-navigation"><button data-shift-day="-${twoDays ? 2 : 1}" aria-label="Précédent">‹</button><button data-shift-day="${twoDays ? 2 : 1}" aria-label="Suivant">›</button></div>
        </div>
        <div class="timed-scroll"><div class="day-columns ${twoDays ? 'two-days' : ''}">${dates.map(timeGrid).join('')}</div></div>
    </section>`;
}

function listView() {
    const events = [...state.events].sort((a, b) => a.date.localeCompare(b.date) || (a.time || '').localeCompare(b.time || ''));
    const grouped = new Map();

    for (const entry of events) {
        if (!grouped.has(entry.date)) {
            grouped.set(entry.date, []);
        }

        grouped.get(entry.date).push(entry);
    }

    const days = [...grouped.entries()].map(([date, entries]) => {
        const heading = new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });

        const items = entries.map(entry => `<article class="agenda-list-event" data-event-card="${escapeHtml(entry.id)}" tabindex="0" role="button" aria-label="Modifier ${escapeHtml(entry.title)}">
            <span class="agenda-list-accent" aria-hidden="true"></span>
            <div class="agenda-list-details">
                <strong>${eventIcon(entry)} ${escapeHtml(entry.title)}</strong>
                ${entry.place ? `<a href="${mapsLink(entry.place)}" target="_blank" rel="noopener noreferrer">📍 ${escapeHtml(entry.place)}</a>` : ''}
            </div>
            <div class="agenda-list-hours">${entry.time ? `<span>${escapeHtml(entry.time)}</span><small>${escapeHtml(entry.endTime || '')}</small>` : '<span>Journée</span>'}</div>
        </article>`).join('');

        return `<section class="agenda-list-day"><h3>${escapeHtml(heading)}</h3>${items}</section>`;
    }).join('');

    return `<section class="card wide agenda-list-card">
        <div class="calendar-heading"><h3>Liste des événements</h3>${addButton('events', 'un événement')}</div>
        <div class="agenda-list-scroll" tabindex="0" aria-label="Événements, liste défilante">
            ${days || empty('Pas d’événement')}
        </div>
    </section>`;
}

function focusFirstEvent() {
    const scroll = document.querySelector('.timed-scroll');
    if (!scroll) return;
    const dayEvents = state.events.filter(entry => entry.date === selectedDate && eventBounds(entry));
    if (!dayEvents.length) {
        scroll.scrollTop = 8 * 72;
        return;
    }
    const firstMinute = Math.min(...dayEvents.map(entry => eventBounds(entry).start));
    scroll.scrollTop = Math.max(0, (firstMinute / 60 - 1) * 72);
}

function openDay(iso) {
    selectedDate = iso;
    agendaView = 'jour';
    render();
    focusFirstEvent();
}

const addButton = (kind, title) => `<button type="button" class="add-button" data-add="${kind}" aria-label="Ajouter : ${escapeHtml(title)}" title="Ajouter"><img src="./plus.png" alt="" aria-hidden="true" width="16" height="16"></button>`;
const section = (title, kind, body) => `<section class="card"><div class="section-heading"><h3>${title}</h3>${addButton(kind, title)}</div>${body}</section>`;
const editorDefinitions = {
    events: { title: 'Nouvel événement', fields: input('Titre', 'title') + eventCategories() + input('Date', 'date', 'date') + input('Heure de début', 'time', 'time', false) + input('Heure de fin (facultative)', 'endTime', 'time', false) + input('Adresse ou lieu (ouvrable dans Maps)', 'place', 'text', false) },
    polls: { title: 'Nouveau sondage', fields: input('Question', 'title') + `<label>Choix proposés (un par ligne)<textarea name="options" required placeholder="Vendredi soir\nSamedi midi\nDimanche"></textarea></label>` },
    notes: { title: 'Nouveau pense-bête', fields: input('Titre', 'title') + `<label>Contenu<textarea name="text" required></textarea></label>` },
    tasks: { title: 'Nouvelle tâche', fields: input('Tâche', 'title') },
    ideas: { title: 'Nouvelle idée', fields: input('Idée de sortie', 'title') },
    expenses: { title: 'Nouvelle dépense', fields: input('Description', 'title') + input('Montant (€)', 'amount', 'number') + input('Payé par', 'payer') + input('Nombre de participants', 'participants', 'number') },
    albums: { title: 'Nouvel album', fields: input('Nom de l’album', 'title') },
    posts: { title: 'Nouvelle publication', fields: `<label>Votre message<textarea name="text" required placeholder="Quoi de neuf chez les zouzous ?"></textarea></label>` }
};
function openEditor(kind, editId = null) {
    const definition = editorDefinitions[kind];
    if (!definition) return;
    const existing = kind === 'events' && editId ? state.events.find(entry => entry.id === editId) : null;
    $('editorTitle').textContent = existing ? 'Modifier l’événement' : definition.title;
    $('editorBody').innerHTML = form(kind, definition.fields, existing ? 'Enregistrer les modifications' : (kind === 'posts' ? 'Publier' : 'Ajouter'));
    if (existing) {
        const editorForm = $('editorBody').querySelector('form');
        editorForm.dataset.editId = existing.id;
        for (const [key, value] of Object.entries(existing)) {
            const field = editorForm.elements.namedItem(key);
            if (field && typeof value === 'string') field.value = value;
        }
    }
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
    const views = [
        ['mois', 'Mois'],
        ['jour', '1 jour'],
        ['liste', 'Liste']
    ];
    const selector = `<div class="agenda-view-selector" role="group" aria-label="Affichage de l’agenda">${views.map(([id, label]) => `<button type="button" data-agenda-view="${id}" class="${agendaView === id ? 'selected' : ''}" aria-pressed="${agendaView === id}">${label}</button>`).join('')}</div>`;
    const content = agendaView === 'mois' ? monthScroll() : agendaView === 'jour' ? dayView() : listView();
    return `<div class="grid agenda-page agenda-fit ${agendaView === 'mois' ? 'month-fit' : agendaView === 'jour' ? 'day-fit' : 'list-fit'}">${selector}${content}</div>`;
}

function monthScroll() {
    return `<div class="month-scroll">${calendar()}</div>`;
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
    $('pageTitle').textContent = page === 'compte' ? 'Mon profil' : pages.find(entry => entry.id === page).label;
    $('desktopNav').innerHTML = pages.map(entry => `<button data-page="${entry.id}" class="${page === entry.id ? 'active' : ''}"><img class="nav-icon" src="./${entry.icon}" alt="" aria-hidden="true" width="21" height="21"><span>${entry.label}</span></button>`).join('');
    $('mobileNav').innerHTML = pages.map(entry => `<button data-page="${entry.id}" class="${page === entry.id ? 'active' : ''}"><span class="nav-icon-wrap"><img class="nav-icon" src="./${entry.icon}" alt="" aria-hidden="true" width="21" height="21"></span>${entry.label}</button>`).join('');
    $('content').innerHTML = (page === 'groupe' || page === 'compte')
        ? ''
        : ({ accueil: home, agenda, organiser, partage: sharing })[page]();
    // Affichage explicite de la rubrique active : ne dépend pas de l'ordre
    // de chargement des scripts et rétablit les contenus après chaque clic.
    const profilePage = $('profilePage');
    const content = $('content');
    const notice = document.querySelector('.shell main > .notice');
    const isCircle = page === 'groupe';
    const isAccount = page === 'compte';
    const accountPage = $('accountPage');
    content.hidden = isCircle || isAccount;
    if (profilePage) profilePage.hidden = !isCircle;
    if (accountPage) accountPage.hidden = !isAccount;
    if (notice) notice.hidden = isCircle || isAccount;
    applyTheme();
}
document.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') {
        return;
    }

    const card = event.target.closest('.agenda-list-event[data-event-card]');

    if (card && event.target === card) {
        event.preventDefault();
        openEditor('events', card.dataset.eventCard);
    }
});

document.addEventListener('click', event => {
    const eventCard = event.target.closest('[data-event-card]');
    if (eventCard && !event.target.closest('a')) {
        openEditor('events', eventCard.dataset.eventCard);
        return;
    }
    const button = event.target.closest('button');
    if (!button)
    return;
    if (button.id === 'privateSpaceButton') {
        page = 'compte';
        render();
        document.querySelector('.shell > main')?.scrollTo(0, 0);
        return;
    }
    if (button.dataset.page) {
        page = button.dataset.page;
        render();
        document.querySelector('.shell > main')?.scrollTo(0, 0);
        return;
    }
    if (button.dataset.agendaView) {
        agendaView = button.dataset.agendaView;
        render();
        if (agendaView === 'jour') focusFirstEvent();
        return;
    }
    if (button.dataset.shiftDay) {
        selectedDate = addDays(selectedDate, Number(button.dataset.shiftDay));
        displayedMonth = new Date(`${selectedDate}T12:00:00`);
        render();
        focusFirstEvent();
        return;
    }
    if (button.dataset.editEvent) {
        openEditor('events', button.dataset.editEvent);
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
    if (kind === 'events' && data.endTime && !data.time) {
        formElement.elements.namedItem('time').setCustomValidity('Indiquez une heure de début.');
        formElement.reportValidity();
        return;
    }
    if (kind === 'events' && data.endTime && minutes(data.endTime) <= minutes(data.time)) {
        formElement.elements.namedItem('endTime').setCustomValidity('L’heure de fin doit être après le début.');
        formElement.reportValidity();
        return;
    }
    const editId = formElement.dataset.editId;
    if (kind === 'events' && editId) {
        const existing = state.events.find(entry => entry.id === editId);
        if (existing) Object.assign(existing, data);
    }
    else {
        state[kind].push({ id: uid(), ...data, ...(kind === 'posts' ? { createdAt: new Date().toLocaleString('fr-FR') } : {}) });
    }
    save();
    if (kind === 'events' && data.date) {
        displayedMonth = new Date(`${data.date}T12:00:00`);
        selectedDate = data.date;
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
