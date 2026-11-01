// shadcn-angular toggle-group.component.ts (classes) and sub/toggle-group-item.component.ts (toggleVariants + overrides).
const BASE = 'inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] whitespace-nowrap';
const VARIANT = { default: 'bg-transparent', outline: 'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground' };
// tailwind-merge drops min-w-9 for min-w-0 and shadow-xs for shadow-none; this reference has no merge, so they are left out here.
const ITEM = 'w-auto min-w-0 shrink-0 shadow-none focus:z-10 focus-visible:z-10';
const JOIN = 'group/toggle-group flex w-fit items-center rounded-md [&>*:not(:first-child)]:rounded-s-none [&>.contents:not(:first-child)>*]:rounded-s-none [&>*:not(:last-child)]:rounded-e-none [&>.contents:not(:last-child)>*]:rounded-e-none';
const OUTLINE =
    'shadow-xs [&>*:not(:first-child)]:border-s-0 [&>.contents:not(:first-child)>*]:border-s-0 [&>*:not(:last-child)[data-state=on]]:border-e-foreground/20 [&>*:not(:last-child):has(+[data-state=on])]:border-e-foreground/20 [&>.contents:not(:last-child)>[data-state=on]]:border-e-foreground/20 [&>.contents:not(:last-child):has(+.contents>[data-state=on])>*]:border-e-foreground/20';

const BOLD = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></svg>';
const ITALIC = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>';
const LABELS = ['Bold', 'Italic', 'Underline'];

const ref = ({ variant = 'default', size = 'default', on = [], disabled = [], labels = LABELS }) => {
    const items = labels
        .map((label, i) => {
            const pressed = on.includes(i);
            return `<ui-toggle-group-item class="contents"><button type="button" class="${BASE} ${VARIANT[variant]} ${ITEM}" ${disabled.includes(i) ? 'disabled' : ''} aria-pressed="${pressed}" data-state="${pressed ? 'on' : 'off'}" data-slot="toggle-group-item" data-size="${size}">${label}</button></ui-toggle-group-item>`;
        })
        .join('');
    return `<ui-toggle-group class="contents"><fieldset class="${JOIN} ${variant === 'outline' ? OUTLINE : ''} min-w-0" data-slot="toggle-group" data-variant="${variant}" data-size="${size}">${items}</fieldset></ui-toggle-group>`;
};
const el = ({ variant = 'default', size = 'default', on = [], disabled = [], labels = LABELS, groupDisabled = false }) => {
    const values = labels.map((_, i) => `item-${i}`);
    const attrs = `${variant === 'default' ? '' : ` variant="${variant}"`}${size === 'default' ? '' : ` size="${size}"`}${on.length ? ` type="multiple" value="${on.map((i) => values[i]).join(',')}"` : ''}${groupDisabled ? ' disabled' : ''}`;
    const items = labels.map((label, i) => `<ge-toggle-group-item value="${values[i]}"${disabled.includes(i) ? ' disabled' : ''}>${label}</ge-toggle-group-item>`).join('');
    return `<ge-toggle-group${attrs}>${items}</ge-toggle-group>`;
};

const items = [];
for (const variant of ['default', 'outline']) {
    items.push(
        { id: `${variant}-none`, ref: ref({ variant }), el: el({ variant }) },
        { id: `${variant}-first-on`, ref: ref({ variant, on: [0] }), el: el({ variant, on: [0] }) },
        { id: `${variant}-middle-on`, ref: ref({ variant, on: [1] }), el: el({ variant, on: [1] }) },
        { id: `${variant}-last-on`, ref: ref({ variant, on: [2] }), el: el({ variant, on: [2] }) },
        { id: `${variant}-several-on`, ref: ref({ variant, on: [0, 2] }), el: el({ variant, on: [0, 2] }) },
        { id: `${variant}-item-disabled`, ref: ref({ variant, on: [0], disabled: [1] }), el: el({ variant, on: [0], disabled: [1] }) },
        { id: `${variant}-icons`, ref: ref({ variant, on: [1], labels: [BOLD, ITALIC] }), el: el({ variant, on: [1], labels: [BOLD, ITALIC] }) },
        { id: `${variant}-focus`, focus: { ref: 'ui-toggle-group-item:nth-child(2) button', el: 'ge-toggle-group-item:nth-child(2)' }, ref: ref({ variant, on: [0] }), el: el({ variant, on: [0] }) },
    );
}
for (const size of ['sm', 'lg']) items.push({ id: `size-${size}`, ref: ref({ variant: 'outline', size, on: [1] }), el: el({ variant: 'outline', size, on: [1] }) });
items.push(
    { id: 'rtl', ref: `<div dir="rtl">${ref({ variant: 'outline', on: [0] })}</div>`, el: `<div dir="rtl">${el({ variant: 'outline', on: [0] })}</div>` },
    { id: 'density-1.5', wrap: '--density:1.5;', ref: ref({ variant: 'outline', on: [1] }), el: el({ variant: 'outline', on: [1] }) },
);
export default { name: 'toggle-group', items };
