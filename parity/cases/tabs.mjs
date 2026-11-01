// shadcn-angular tabs.component.ts (simple mode), sub/tabs-list.component.ts, sub/tabs-trigger.component.ts, sub/tabs-content.component.ts
const LIST = 'inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground';
const TRIGGER = 'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50';
const trigger = (active, extra = '') => `${TRIGGER} ${active ? 'bg-background text-foreground shadow' : 'hover:bg-background/50'} ${extra}`.trim();
const CONTENT = 'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';

const TABS = [
    { value: 'account', label: 'Account', text: 'Make changes to your account here.' },
    { value: 'password', label: 'Password', text: 'Change your password here.' },
    { value: 'team', label: 'Team', text: 'Invite your team.' },
];
const button = (t, active, cls, attrs = '') =>
    `<button type="button" role="tab" aria-selected="${active}" data-state="${active ? 'active' : 'inactive'}" tabindex="${active ? 0 : -1}" class="${cls}" ${attrs}>${t.label}</button>`;

const refCustom = (active) =>
    `<ui-tabs class="contents"><div class="w-full" data-slot="tabs"><ui-tabs-list class="contents"><div role="tablist" class="${LIST}" data-slot="tabs-list">${TABS.map((t) => `<ui-tabs-trigger class="contents">${button(t, t.value === active, trigger(t.value === active)).replace('<button', '<button data-slot="tabs-trigger"')}</ui-tabs-trigger>`).join('')}</div></ui-tabs-list>${TABS.map((t) => `<ui-tabs-content class="contents">${t.value === active ? `<div role="tabpanel" tabindex="0" class="${CONTENT}" data-slot="tabs-content">${t.text}</div>` : ''}</ui-tabs-content>`).join('')}</div></ui-tabs>`;
const elCustom = (active) =>
    `<ge-tabs value="${active}"><ge-tabs-list>${TABS.map((t) => `<ge-tabs-trigger value="${t.value}">${t.label}</ge-tabs-trigger>`).join('')}</ge-tabs-list>${TABS.map((t) => `<ge-tabs-content value="${t.value}">${t.text}</ge-tabs-content>`).join('')}</ge-tabs>`;

// The real simple mode puts px-3 py-1 on each button, and those utilities beat the density rule (shadcn-angular#222).
// Its density-1.5 reference drops them: at density 1 the rule gives the same 0.75rem / 0.25rem.
const refSimple = (active, { disabled = [], padding = true } = {}) =>
    `<ui-tabs class="contents"><div class="w-full" data-slot="tabs"><div class="${LIST}" role="tablist">${TABS.map((t) => button(t, t.value === active, trigger(t.value === active, padding ? 'px-3 py-1' : ''), `${disabled.includes(t.value) ? 'disabled' : ''} ${padding ? '' : DENSITY}`)).join('')}</div>${TABS.filter((t) => t.value === active).map((t) => `<div role="tabpanel" class="mt-2 ring-offset-background focus-visible:outline-none">${t.text}</div>`).join('')}</div></ui-tabs>`;
const elSimple = (id, active, disabled = []) => {
    const rows = TABS.map((t) => ({ value: t.value, label: t.label, content: t.text, disabled: disabled.includes(t.value) }));
    return `<ge-tabs id="${id}" value="${active}"></ge-tabs><script>document.getElementById('${id}').tabs = ${JSON.stringify(rows)}</script>`;
};

const D = 'var(--density-tabs, var(--density, 1))';
const DENSITY = `style="padding-inline:calc(0.75rem * ${D});padding-block:calc(0.25rem * ${D})"`;
const WIDTH = 'display:block;width:360px;';
const skeleton = `<ui-tabs class="contents"><div class="w-full" data-slot="tabs"><ui-tabs-list class="contents"><div class="${LIST} gap-1" data-slot="tabs-list">${'<ui-skeleton class="h-7 w-20 rounded-md animate-pulse bg-primary/10"></ui-skeleton>'.repeat(3)}</div></ui-tabs-list></div></ui-tabs>`;
export default {
    name: 'tabs',
    items: [
        { id: 'first-active', wrap: WIDTH, ref: refCustom('account'), el: elCustom('account') },
        { id: 'second-active', wrap: WIDTH, ref: refCustom('password'), el: elCustom('password') },
        { id: 'simple', wrap: WIDTH, ref: refSimple('account'), el: elSimple('s1', 'account') },
        { id: 'simple-disabled', wrap: WIDTH, ref: refSimple('account', { disabled: ['team'] }), el: elSimple('s2', 'account', ['team']) },
        { id: 'skeleton', wrap: WIDTH, ref: skeleton, el: '<ge-tabs><ge-tabs-list skeleton></ge-tabs-list></ge-tabs>' },
        { id: 'focus-trigger', wrap: WIDTH, focus: { ref: 'button[aria-selected=true]', el: 'ge-tabs-trigger[value=account]' }, ref: refCustom('account'), el: elCustom('account') },
        { id: 'focus-panel', wrap: WIDTH, focus: { ref: '[role=tabpanel]', el: 'ge-tabs-content[value=account]' }, ref: refCustom('account'), el: elCustom('account') },
        { id: 'rtl', wrap: WIDTH, ref: `<div dir="rtl">${refCustom('password')}</div>`, el: `<div dir="rtl">${elCustom('password')}</div>` },
        { id: 'density-1.5', wrap: `${WIDTH}--density:1.5;`, ref: refCustom('account'), el: elCustom('account') },
        { id: 'simple-density-1.5', wrap: `${WIDTH}--density:1.5;`, ref: refSimple('account', { padding: false }), el: elSimple('s3', 'account') },
    ],
};
