// shadcn-angular command.component.ts and sub/*.component.ts (+ command-item density css).
const SHELL = 'flex h-full w-full flex-col overflow-hidden rounded-md bg-popover text-popover-foreground';
const SEARCH = '<svg class="h-4 w-4 shrink-0 opacity-50 ltr:mr-2 rtl:ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>';
const ITEM = 'relative flex cursor-pointer select-none items-center rounded-sm text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50';

const ROWS = [
    ['calendar', 'Calendar'], ['search-emoji', 'Search emoji'], ['launch', 'Launch', { disabled: true }],
    'sep',
    ['profile', 'Profile', { shortcut: '⌘P' }], ['mail', 'Mail', { shortcut: '⌘B' }],
];
const GROUPS = [['Suggestions', 0, 3], ['Settings', 4, 6]];

const rItem = ([value, text, opts = {}], active) =>
    `<ui-command-item class="contents"><div class="${ITEM}${active ? ' bg-accent text-accent-foreground' : ''}" data-slot="command-item" ${opts.disabled ? 'data-disabled="true"' : ''} aria-selected="false" role="option" tabindex="0">${text}${opts.shortcut ? `<span class="ms-auto text-xs tracking-widest text-muted-foreground">${opts.shortcut}</span>` : ''}</div></ui-command-item>`;
const matches = (row, q) => !q || row[0].includes(q);
const rList = (q, active) => {
    const groups = GROUPS.map(([heading, from, to], i) => {
        const rows = ROWS.slice(from, to).filter((r) => matches(r, q));
        return rows.length === 0 ? (i === 0 ? '@SEP@' : '') : `<ui-command-group class="contents"><div class="overflow-hidden p-1 text-foreground" data-slot="command-group" role="group"><div class="px-2 py-1.5 text-xs font-medium text-muted-foreground">${heading}</div>${rows.map((r) => rItem(r, r[0] === active)).join('')}</div></ui-command-group>${i === 0 ? '@SEP@' : ''}`;
    });
    const visible = ROWS.filter((r) => r !== 'sep' && matches(r, q)).length;
    const sep = '<ui-command-separator class="contents"><div class="-mx-1 h-px bg-border" data-slot="command-separator"></div></ui-command-separator>';
    const body = groups.join('').replace('@SEP@', sep);
    const empty = visible === 0 ? '<ui-command-empty class="contents"><div class="py-6 text-center text-sm text-muted-foreground" data-slot="command-empty">No results.</div></ui-command-empty>' : '';
    return `<ui-command-list class="contents"><div class="max-h-[200px] sm:max-h-[300px] overflow-y-auto overflow-x-hidden" data-slot="command-list" ${visible > 0 ? 'role="listbox"' : ''}>${empty}${body}</div></ui-command-list>`;
};
const rInput = (q, dir = 'ltr') =>
    `<ui-command-input class="contents"><div class="flex items-center border-b px-3" data-slot="command-input" dir="${dir}">${SEARCH}<input class="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50" placeholder="Type a command" value="${q}" aria-label="Search"></div></ui-command-input>`;
const rPalette = (q = '', active = '', dir) =>
    `<ui-command class="contents"><div class="${SHELL} max-w-md border shadow-md" data-slot="command">${rInput(q, dir)}${rList(q, active)}</div></ui-command>`;

const eRow = ([value, text, opts = {}], highlight) =>
    `<ge-command-item value="${value}" ${opts.disabled ? 'disabled' : ''} ${opts.shortcut ? `shortcut="${opts.shortcut}"` : ''} ${highlight ? 'data-highlight' : ''}>${text}</ge-command-item>`;
const ePalette = (q = '', active = '') =>
    `<ge-command ${q ? `search="${q}"` : ''} style="max-width:28rem;border:1px solid var(--border);box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1)"><ge-command-input placeholder="Type a command"></ge-command-input><ge-command-list><ge-command-empty>No results.</ge-command-empty>${GROUPS.map(([heading, from, to], i) => `<ge-command-group heading="${heading}">${ROWS.slice(from, to).map((r) => eRow(r, r[0] === active)).join('')}</ge-command-group>${i === 0 ? '<ge-command-separator></ge-command-separator>' : ''}`).join('')}</ge-command-list></ge-command>`;

// Dialog: the panel of shadcn-angular's dialog-content with `overflow-hidden p-0 shadow-lg`, around two nested shells.
const PANEL = 'fixed z-50 grid w-full max-w-[calc(100vw-2rem)] sm:max-w-lg border bg-background shadow-lg duration-200 sm:rounded-lg overflow-hidden p-0';
const CLOSE = 'absolute end-4 top-4 inline-flex items-center justify-center rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none pointer-coarse:end-0.5 pointer-coarse:top-0.5 pointer-coarse:size-11';
const X = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>';
const DIALOG_OVERRIDES = '**:data-[slot=command-group]:px-2 **:data-[slot=command-group]:font-medium **:data-[slot=command-group]:text-muted-foreground **:data-[slot=command-item]:px-2 **:data-[slot=command-item]:py-3 [&_[data-slot=command-item]_svg]:h-5 [&_[data-slot=command-item]_svg]:w-5';
const rDialog = (q = '', active = '') =>
    `<ui-command-dialog class="contents" data-slot="command-dialog"><ui-dialog class="contents" data-slot="dialog"><ui-dialog-content class="contents"><div class="fixed inset-0 z-50 flex items-center justify-center"><button type="button" class="fixed inset-0 bg-black/80 animate-in fade-in-0" data-slot="dialog-overlay" aria-label="Close"></button><div class="${PANEL}" role="dialog" aria-modal="true" data-slot="dialog-content" tabindex="-1"><ui-command class="contents"><div class="${SHELL} ${DIALOG_OVERRIDES}" data-slot="command"><ui-command class="contents"><div class="${SHELL}" data-slot="command">${rInput(q)}${rList(q, active)}</div></ui-command></div></ui-command><button type="button" class="${CLOSE}" aria-label="Close">${X}<span class="sr-only">Close</span></button></div></div></ui-dialog-content></ui-dialog></ui-command-dialog>`;
const eDialog = (q = '', active = '') =>
    `<ge-command-dialog open no-shortcut><ge-command ${q ? `search="${q}"` : ''}><ge-command-input placeholder="Type a command"></ge-command-input><ge-command-list><ge-command-empty>No results.</ge-command-empty>${GROUPS.map(([heading, from, to], i) => `<ge-command-group heading="${heading}">${ROWS.slice(from, to).map((r) => eRow(r, r[0] === active)).join('')}</ge-command-group>${i === 0 ? '<ge-command-separator></ge-command-separator>' : ''}`).join('')}</ge-command-list></ge-command></ge-command-dialog>`;

const W = (extra = '') => `width:460px;height:340px;box-sizing:content-box;${extra}`;
const D = 'width:640px;height:420px;';
const rtl = (html) => `<div dir="rtl">${html}</div>`;
const items = [
    { id: 'default', wrap: W(), ref: rPalette(), el: ePalette() },
    { id: 'highlight', wrap: W(), ref: rPalette('', 'search-emoji'), el: ePalette('', 'search-emoji') },
    { id: 'highlight-disabled', wrap: W(), ref: rPalette('', 'launch'), el: ePalette('', 'launch') },
    { id: 'filtered', wrap: W(), ref: rPalette('p'), el: ePalette('p') },
    { id: 'filtered-one-group', wrap: W(), ref: rPalette('mail'), el: ePalette('mail') },
    { id: 'empty', wrap: W(), ref: rPalette('zzz'), el: ePalette('zzz') },
    { id: 'density-1.5', wrap: W('--density:1.5;'), ref: rPalette('', 'mail'), el: ePalette('', 'mail') },
    { id: 'rtl', wrap: W(), ref: rtl(rPalette('', 'mail', 'rtl')), el: rtl(ePalette('', 'mail')) },
    { id: 'dialog', wrap: D, ref: rDialog(), el: eDialog() },
    { id: 'dialog-filtered', wrap: D, ref: rDialog('p', 'profile'), el: eDialog('p', 'profile') },
];
export default { name: 'command', isolated: true, items };
