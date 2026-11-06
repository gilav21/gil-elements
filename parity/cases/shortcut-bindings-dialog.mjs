// shadcn-angular shortcut-bindings-dialog.component.html with ui-dialog, ui-scroll-area, ui-accordion, ui-badge and ui-button inside.
// The case wrapper has will-change: transform, so the fixed overlay fills the wrapper instead of the viewport.
import { ref as button } from '../lib/button-ref.mjs';
import { BASE as BADGE_BASE, VARIANTS as BADGE } from './badge.mjs';

export const isolated = true;

const PANEL = 'fixed z-50 grid w-full max-w-[calc(100vw-2rem)] sm:max-w-4xl border bg-background shadow-lg duration-200 sm:rounded-lg p-0 overflow-hidden';
const CLOSE = 'absolute end-4 top-4 inline-flex items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none pointer-coarse:end-0.5 pointer-coarse:top-0.5 pointer-coarse:size-11';
const X = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';
const INPUT = 'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';
const CHEVRON = (open) => `<svg class="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200${open ? ' rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>`;
const ROOT = 'relative overflow-hidden';
const VIEWPORT = 'size-full rounded-[inherit] overflow-auto scrollbar-none focus-visible:ring-ring/50 transition-[color,box-shadow] outline-none focus-visible:ring-[3px]';
const TRIGGER = 'flex flex-1 items-center justify-between text-sm font-medium transition-all [&[data-state=open]>svg]:rotate-180 py-2.5 text-left hover:no-underline';
const TRIGGER_ACTION = 'flex flex-1 items-center justify-between text-sm font-medium transition-all [&[data-state=open]>svg]:rotate-180 py-2.5 hover:no-underline';
const badge = (variant, text) => `<ui-badge data-slot="badge" class="${BADGE_BASE} ${BADGE[variant]}">${text}</ui-badge>`;
const state = (open) => (open ? 'open' : 'closed');

// The action trigger holds buttons; innerHTML would close the outer button at the first inner one, so it is a div here.
const item = (hostClass, trigger, triggerClass, label, content, contentClass, open, tag = 'button') =>
    `<ui-accordion-item class="${hostClass} contents"><div class="${hostClass.replace('rounded-lg border bg-card/60 px-3', 'rounded-lg border bg-card/60 px-3').trim()}" data-slot="accordion-item"><ui-accordion-trigger class="${triggerClass.split(' ').slice(0, 3).join(' ')} contents"><h3 class="flex"><${tag} ${tag === 'button' ? 'type="button"' : 'role="button"'} class="${trigger}" aria-expanded="${open}" data-state="${state(open)}" data-slot="accordion-trigger">${label}${CHEVRON(open)}</${tag}></h3></ui-accordion-trigger><ui-accordion-content class="${contentClass} contents">${open ? `<div class="overflow-hidden text-sm ${contentClass}" data-state="open" data-slot="accordion-content"><div class="pb-4 pt-0">${content}</div></div>` : ''}</ui-accordion-content></div></ui-accordion-item>`;
const accordion = (inner) => `<ui-accordion class="flex flex-col gap-2 contents"><div class="w-full flex flex-col gap-2" data-slot="accordion">${inner}</div></ui-accordion>`;

const reset = (label, disabled) => button('ghost', 'sm', label, { extra: 'h-8 px-2 text-[11px]', disabled }).replace(' text-xs ', ' ');
const capture = (label, aria, armed = false) => `<button type="button" class="inline-flex h-8 items-center rounded-md border px-2.5 text-xs font-medium transition-colors hover:bg-accent${armed ? ' border-primary' : ''}" aria-label="${aria}">${label}</button>`;
const instance = (name, def, effective, aria, overridden) => `<div class="rounded-md border border-dashed p-2.5"><div class="flex items-center justify-between gap-3"><div class="min-w-0"><p class="text-xs font-medium">${name}</p><p class="text-[11px] text-muted-foreground">Default: ${def}</p></div><div class="flex items-center gap-1.5">${capture(effective, aria)}${reset('Reset', !overridden)}</div></div></div>`;

const FIXTURE = [
    { component: 'editor', actions: [{ actionId: 'editor.bold', description: 'Bold', defaultShortcut: 'Mod+B', category: 'Format' }, { actionId: 'editor.save', description: 'Save', defaultShortcut: 'Mod+S', category: 'File' }] },
    { component: 'editor', actions: [{ actionId: 'editor.bold', description: 'Bold', defaultShortcut: 'Mod+B', category: 'Format' }, { actionId: 'editor.save', description: 'Save', defaultShortcut: 'Mod+S', category: 'File' }] },
    { component: 'data table', actions: [{ actionId: 'table.sort', description: 'Sort column', defaultShortcut: 'Alt+S', category: 'Table' }] },
    { component: 'kanban', definition: true, actions: [{ actionId: 'kanban.undo', description: 'Undo last action', defaultShortcut: 'Mod+Z', category: 'Kanban' }] },
];

const BINDINGS = {
    editor: [
        { id: 'editor.save', name: 'Save', category: 'File', shortcut: 'Ctrl+S', instances: ['editor #1', 'editor #2'] },
        { id: 'editor.bold', name: 'Bold', category: 'Format', shortcut: 'Ctrl+B', instances: ['editor #1', 'editor #2'] },
    ],
    'data-table': [{ id: 'table.sort', name: 'Sort column', category: 'Table', shortcut: 'Alt+S', instances: ['data-table #1'] }],
    kanban: [{ id: 'kanban.undo', name: 'Undo last action', category: 'Kanban', shortcut: 'Ctrl+Z', instances: [] }],
};
const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const actionItem = (group, b, open) => {
    const inner = b.instances.length
        ? `<div class="space-y-2">${b.instances.map((name) => instance(name, b.shortcut, b.shortcut, `Rebind instance ${name} for ${b.name}`, false)).join('')}</div>`
        : '<div class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">No active instances. Use the "All" control to define the shared shortcut for future instances.</div>';
    const label = `<div class="flex w-full items-start justify-between gap-3"><div class="min-w-0 space-y-1 text-left"><div class="flex items-center gap-2"><p class="text-sm font-medium leading-5">${b.name}</p>${badge('secondary', b.category)}</div><p class="text-xs text-muted-foreground leading-4"><span class="font-medium">Action:</span> ${b.id}</p><p class="text-xs text-muted-foreground leading-4">${count(b.instances.length, 'active instance')}</p></div><div class="flex items-center gap-1.5" tabindex="-1">${capture(`All: ${b.shortcut}`, `Rebind all instances of ${b.name}`)}${reset('Reset all', true)}</div></div>`;
    return item('rounded-md border bg-background px-3', TRIGGER_ACTION, 'py-2.5 hover:no-underline', label, inner, 'pt-1 pb-3', open, 'div');
};
const groupItem = (name, openAction, groupOpen, only) => {
    const list = BINDINGS[name].filter((b) => !only || only.includes(b.id));
    const active = list.filter((b) => b.instances.length).length;
    const label = `<div class="min-w-0 space-y-0.5"><h3 class="text-sm font-semibold tracking-tight capitalize">${name}</h3><p class="text-xs text-muted-foreground">${count(active, 'active action')} / ${list.length} total</p></div>`;
    const inner = accordion(list.map((b) => actionItem(name, b, openAction === b.id)).join(''));
    return item('rounded-lg border bg-card/60 px-3', TRIGGER, 'py-2.5 text-left hover:no-underline', label, inner, 'pt-1 pb-3', groupOpen);
};
const refDialog = ({ groups, openGroup = null, openAction = null, query = '', only = null, save = false, placeholder = 'Search actions, categories, components, or keys...', empty = false, dir = '' }) => {
    const header = `<ui-dialog-header class="flex flex-col text-center sm:text-left px-5 pt-5 pb-4 border-b" data-slot="dialog-header"><ui-dialog-title class="text-lg font-semibold leading-none tracking-tight flex justify-start" data-slot="dialog-title">Keyboard Shortcuts</ui-dialog-title><ui-dialog-description class="text-sm text-muted-foreground flex justify-start" data-slot="dialog-description">Browse available shortcuts and rebind actions for this app.</ui-dialog-description><div class="pt-3"><input type="text" class="${INPUT}${dir ? ' ring-1 ring-ring' : ''}" placeholder="${placeholder}" value="${query}"></div>${save ? `<div class="pt-3 flex justify-end">${button('secondary', 'sm', 'Save Changes')}</div>` : ''}</ui-dialog-header>`;
    const body = `<div class="space-y-3 pr-3">${accordion(groups.map((g) => groupItem(g, g === openGroup ? openAction : null, g === openGroup, only)).join(''))}${empty ? '<div class="rounded-md border border-dashed p-6 text-sm text-muted-foreground text-center">No shortcuts matched your search.</div>' : ''}</div>`;
    const scroll = `<ui-scroll-area class="h-[60vh] sm:h-[70vh] px-3 sm:px-5 py-3 sm:py-4 contents"><div class="${ROOT} h-[60vh] sm:h-[70vh] px-3 sm:px-5 py-3 sm:py-4" data-slot="scroll-area"><div class="${VIEWPORT}" data-slot="scroll-area-viewport" tabindex="0">${body}</div></div></ui-scroll-area>`;
    const panel = `<ui-dialog class="contents" data-slot="dialog"><ui-dialog-content class="contents"><div class="fixed inset-0 z-50 flex items-center justify-center"><button type="button" class="fixed inset-0 bg-black/80 animate-in fade-in-0" data-slot="dialog-overlay" aria-label="Close"></button><div class="${PANEL}" role="dialog" aria-modal="true" ${dir ? `dir="${dir}"` : ''} data-slot="dialog-content" tabindex="-1">${header}${scroll}<button type="button" class="${CLOSE}" aria-label="Close">${X}<span class="sr-only">Close</span></button></div></div></ui-dialog-content></ui-dialog>`;
    return `<ui-shortcut-bindings-dialog class="contents" data-slot="shortcut-bindings-dialog">${panel}</ui-shortcut-bindings-dialog>`;
};

const ALL = ['data-table', 'editor', 'kanban'];
const W = 'width:900px;height:900px;';
const first = (attrs) => `${attrs} data-shortcuts='${JSON.stringify(FIXTURE)}'`;
const el = (attrs = '', props = '') => `<ge-shortcut-bindings-dialog open ${attrs}${props ? ` data-props='${props}'` : ''}></ge-shortcut-bindings-dialog>`;

export default {
    name: 'shortcut-bindings-dialog',
    items: [
        { id: 'closed-groups', wrap: W, ref: refDialog({ groups: ALL }), el: `<ge-shortcut-bindings-dialog open ${first('')}></ge-shortcut-bindings-dialog>` },
        { id: 'search-bold', wrap: W, ref: refDialog({ groups: ['editor'], openGroup: 'editor', openAction: 'editor.bold', query: 'bold', only: ['editor.bold'] }), el: el('', '{"search":"bold"}') },
        { id: 'search-kanban', wrap: W, ref: refDialog({ groups: ['kanban'], openGroup: 'kanban', openAction: 'kanban.undo', query: 'kanban' }), el: el('', '{"search":"kanban"}') },
        { id: 'no-match', wrap: W, ref: refDialog({ groups: [], query: 'zzz', empty: true }), el: el('', '{"search":"zzz"}') },
        { id: 'save-button', wrap: W, ref: refDialog({ groups: ALL, save: true }), el: el('allow-save-mapping') },
        { id: 'hebrew', wrap: W, focus: { el: 'ge-shortcut-bindings-dialog >> .search' }, ref: refDialog({ groups: ALL, placeholder: '...חיפוש פעולות, קטגוריות, רכיבים או מקשים', dir: 'rtl' }), el: el('locale="he"') },
    ],
};
