import { BASE as BADGE, VARIANTS } from './badge.mjs';
import { ref as buttonRef } from '../lib/button-ref.mjs';
// shadcn-angular kanban.component.ts, sub/kanban-column.component.ts and sub/kanban-card.component.ts: the class strings,
// copied. The Angular hosts are `contents`, so the box is the first element inside; here the host is the box.
// Drag, drop, menus, dialogs and undo are in kanban.browser.test.ts.
const PLUS = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>';
const CHEVRON = (collapsed) => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform${collapsed ? ' rotate-180' : ''}"><path d="m18 15-6-6-6 6"/></svg>`;
const TOOL = 'h-6 w-6 pointer-coarse:size-11 flex items-center justify-center rounded hover:bg-accent';
const COLUMN = 'bg-muted/50 rounded-lg border flex flex-col w-[260px] sm:w-[300px] min-w-[240px] sm:min-w-[280px] sm:max-w-[350px] shrink-0 transition-colors duration-200';
const CARD = 'bg-card text-card-foreground rounded-lg border shadow-sm cursor-grab active:cursor-grabbing transition-all duration-200 hover:shadow-md';
const PRIORITY = { low: 'border-s-green-500', medium: 'border-s-yellow-500', high: 'border-s-orange-500', urgent: 'border-s-red-500' };
const SCROLL_ROOT = 'relative overflow-hidden flex-1 min-h-0';
const SCROLL_VIEWPORT = 'size-full rounded-[inherit] overflow-auto scrollbar-none focus-visible:ring-ring/50 transition-[color,box-shadow] outline-none focus-visible:ring-[3px]';
const badge = (text, variant = 'secondary', extra = '', style = '') => `<ui-badge data-slot="badge" class="${BADGE} ${VARIANTS[variant]} ${extra}"${style ? ` style="${style}"` : ''}>${text}</ui-badge>`;
const indicator = (active, top) =>
    `<div class="absolute left-2 right-2 pointer-events-none transition-all duration-200 ease-out ${active ? 'opacity-100' : 'opacity-0'}" style="top:${top}px" data-slot="kanban-drop-indicator"><div class="flex items-center"><div class="h-2 w-2 rounded-full bg-primary shrink-0"></div><div class="h-[3px] bg-primary rounded-full flex-1"></div><div class="h-2 w-2 rounded-full bg-primary shrink-0"></div></div></div>`;

const cardRef = (c, { dragging = false } = {}) => {
    const cls = [CARD, c.priority ? 'border-s-[3px]' : '', c.priority ? PRIORITY[c.priority] : '', dragging ? 'opacity-50 scale-[0.98] shadow-lg ring-2 ring-primary/20' : ''].filter(Boolean).join(' ');
    const labels = c.labels?.length ? `<div class="flex flex-wrap gap-1">${c.labels.map((l) => badge(l.text, 'default', 'text-[10px] px-1.5 py-0', `background-color:${l.color};color:${l.fg}`)).join('')}</div>` : '';
    const title = c.title ? `<p class="text-sm font-medium leading-snug">${c.title}</p>` : '';
    const description = c.description ? `<p class="text-xs text-muted-foreground line-clamp-2">${c.description}</p>` : '';
    const people = c.assignees?.length ? `<div class="flex items-center -space-x-1 pt-1">${c.assignees.map((a) => `<ui-avatar data-slot="avatar" class="relative flex shrink-0 overflow-hidden rounded-full h-6 w-6 border-2 border-background"><div class="flex h-full w-full items-center justify-center rounded-full bg-muted" data-slot="avatar-fallback">${a.name[0].toUpperCase()}</div></ui-avatar>`).join('')}</div>` : '';
    return `<ui-kanban-card class="contents"><div class="${cls}" data-slot="kanban-card" data-card-id="${c.id}" draggable="true"><div class="p-3 space-y-2">${labels}${title}${description}${people}</div></div></ui-kanban-card>`;
};

const columnRef = ({ id, title, wipLimit, cards = [], collapsible = true, collapsed = false, dragOver = false, dragged = '' }) => {
    const over = wipLimit != null && cards.length > wipLimit;
    const cls = [COLUMN, over ? 'border-destructive/50' : '', dragOver ? 'border-primary/50 bg-accent/30 ring-1 ring-primary/20' : ''].filter(Boolean).join(' ');
    const header =
        `<div class="flex items-center justify-between p-3" data-slot="kanban-column-header"><div class="flex items-center gap-2"><h3 class="text-sm font-semibold">${title}</h3>${badge(cards.length, over ? 'destructive' : 'secondary', 'text-xs')}${wipLimit ? `<span class="text-xs text-muted-foreground">/ ${wipLimit}</span>` : ''}</div>` +
        `<div class="flex items-center gap-1"><button type="button" class="${TOOL}" aria-label="Add card" data-slot="kanban-add-card-button">${PLUS}</button>${collapsible ? `<button type="button" class="${TOOL}" aria-label="${collapsed ? 'Expand column' : 'Collapse column'}" aria-expanded="${!collapsed}">${CHEVRON(collapsed)}</button>` : ''}</div></div>`;
    const empty = `<div class="flex flex-col items-center justify-center py-8 text-center" data-slot="kanban-empty-state"><p class="text-sm text-muted-foreground mb-2">No cards yet</p>${buttonRef('ghost', 'sm', 'Add a card')}</div>`;
    const body = collapsed
        ? ''
        : `<ui-scroll-area class="${SCROLL_ROOT.replace('relative overflow-hidden ', '')}"><div class="${SCROLL_ROOT}" data-slot="scroll-area"><div class="${SCROLL_VIEWPORT}" data-slot="scroll-area-viewport" tabindex="0"><div class="p-3 flex flex-col gap-3 min-h-[40px] relative">${indicator(dragOver, dragOver ? 6 : -1)}${cards.length ? cards.map((c) => cardRef(c, { dragging: c.id === dragged })).join('') : empty}</div></div></div></ui-scroll-area>`;
    return `<ui-kanban-column class="contents"><div class="${cls}" data-slot="kanban-column" data-column-id="${id}">${header}<ui-separator role="separator" aria-orientation="horizontal" class="block bg-border shrink-0 h-[1px] w-full"></ui-separator>${body}</div></ui-kanban-column>`;
};

const strip = (columns) => `<div class="flex gap-3 sm:gap-4 overflow-x-auto p-2 sm:p-4" data-slot="kanban">${columns}</div>`;
const boardRef = (inner) => `<ui-kanban class="block"><div dir="ltr">${inner}</div></ui-kanban>`;
const geBoard = (columns, cards, attrs = '') => `<ge-kanban data-columns='${JSON.stringify(columns)}' data-cards='${JSON.stringify(cards).replaceAll("'", '&#39;')}' ${attrs}></ge-kanban>`;

const WHITE = '#000000'; // readableForeground('#6366f1'): black has the higher contrast on indigo
const CARDS = [
    { id: 'c1', columnId: 'todo', title: 'Set up CI/CD pipeline', description: 'Configure GitHub Actions for automated testing and deployment of every release.', priority: 'high', labels: [{ text: 'DevOps', color: '#6366f1', fg: WHITE }], assignees: [{ name: 'Alice Chen' }, { name: 'bob' }], order: 0 },
    { id: 'c2', columnId: 'todo', title: 'Design token refresh', priority: 'medium', order: 1 },
    { id: 'c3', columnId: 'todo', title: 'Accessibility audit', priority: 'low', order: 2 },
    { id: 'c4', columnId: 'doing', title: 'Implement the board', priority: 'urgent', order: 0 },
];
const strip2 = (cols) => cols;
const COLUMNS = [
    { id: 'todo', title: 'To do', order: 0, wipLimit: 2 },
    { id: 'doing', title: 'In progress', order: 1 },
    { id: 'done', title: 'Done', order: 2 },
];
const one = (id, over = {}) => ({ ...COLUMNS.find((c) => c.id === id), ...over });
const colsOf = (id, ref) => CARDS.filter((c) => c.columnId === id);
const cardsFor = (...ids) => CARDS.filter((c) => ids.includes(c.columnId));
// A card's label foreground is what readableForeground gives for its colour: white on indigo.
const stripOf = (columns) => strip(columns.map((c) => columnRef({ ...c, cards: colsOf(c.id) })).join(''));
const geCards = (...ids) => cardsFor(...ids).map(({ labels, ...c }) => ({ ...c, labels: labels?.map(({ fg, ...l }) => l) }));

const states = (value) => `data-column-states='${JSON.stringify(value)}'`;
const solo = (id, state, over = {}) => ({
    ref: boardRef(strip(columnRef({ ...one(id, over), cards: colsOf(id), ...state.ref }))),
    el: geBoard([one(id, over)], geCards(id), states({ [id]: state.el })),
});

const LANE = 'flex w-full flex-wrap items-center gap-2 px-2 sm:px-4 py-2 text-start hover:bg-accent/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const laneRef = (label, cards, collapsed) => {
    const chevron = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="transition-transform shrink-0${collapsed ? ' -rotate-90' : ''}"><path d="m6 9 6 6 6-6"/></svg>`;
    const header = `<button type="button" class="${LANE}" data-slot="kanban-swimlane-header" aria-expanded="${!collapsed}">${chevron}<span class="text-sm font-semibold truncate max-w-[160px] sm:max-w-[280px]">${label}</span>${badge(cards.length, 'secondary', 'text-xs')}</button>`;
    const body = collapsed ? '' : strip(['todo', 'doing'].map((id) => columnRef({ ...one(id, { wipLimit: undefined }), cards: colsOf(id) })).join(''));
    return boardRef(`<div class="flex flex-col" data-slot="kanban-swimlanes"><section class="border-b last:border-b-0" data-slot="kanban-swimlane" data-swimlane-id="${label}"${collapsed ? ' data-collapsed="true"' : ''}>${header}${body}</section></div>`);
};
const laneCards = geCards('todo', 'doing').map((c) => ({ ...c, team: 'Platform' }));
const laneColumns = [one('todo', { wipLimit: undefined }), one('doing')];

export default {
    name: 'kanban',
    items: [
        { id: 'board', wrap: 'width:60rem;', ref: boardRef(stripOf(COLUMNS)), el: geBoard(COLUMNS, geCards('todo', 'doing', 'done')) },
        { id: 'column-collapsed', wrap: 'width:24rem;', ...solo('doing', { ref: { collapsed: true }, el: { collapsed: true } }) },
        { id: 'column-empty', wrap: 'width:24rem;', ref: boardRef(strip(columnRef({ ...one('done'), cards: [] }))), el: geBoard([one('done')], []) },
        { id: 'column-over-limit', wrap: 'width:24rem;', ...solo('todo', { ref: {}, el: {} }) },
        { id: 'column-drag-over', wrap: 'width:24rem;', ...solo('doing', { ref: { dragOver: true }, el: { dragOver: true } }) },
        { id: 'column-not-collapsible', wrap: 'width:24rem;', ...solo('doing', { ref: { collapsible: false }, el: { collapsible: false } }) },
        { id: 'card-dragging', wrap: 'width:24rem;', ref: boardRef(strip(columnRef({ ...one('doing'), cards: colsOf('doing'), dragged: 'c4' }))), el: geBoard([one('doing')], geCards('doing'), 'data-dragged="c4"') },
        { id: 'swimlane', wrap: 'width:60rem;', ref: laneRef('Platform', cardsFor('todo', 'doing'), false), el: geBoard(laneColumns, laneCards, 'swimlane-by="team"') },
        { id: 'swimlane-collapsed', wrap: 'width:60rem;', ref: laneRef('Platform', cardsFor('todo', 'doing'), true), el: geBoard(laneColumns, laneCards, `swimlane-by="team" data-collapsed-lanes='["Platform"]'`) },
    ],
};
