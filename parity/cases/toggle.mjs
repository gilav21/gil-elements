// shadcn-angular toggle.component.html and .ts (toggleVariants).
const BASE = 'inline-flex items-center justify-center rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] whitespace-nowrap';
const VARIANT = { default: 'bg-transparent', outline: 'border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground' };
const BOLD = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 12h9a4 4 0 0 1 0 8H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h7a4 4 0 0 1 0 8" /></svg>';

const ref = ({ variant = 'default', size = 'default', pressed = false, disabled = false, content = 'Bold' }) =>
    `<ui-toggle class="contents"><button type="button" class="${BASE} ${VARIANT[variant]}" ${disabled ? 'disabled' : ''} aria-pressed="${pressed}" data-state="${pressed ? 'on' : 'off'}" data-slot="toggle" data-size="${size}">${content}</button></ui-toggle>`;
const el = ({ variant = 'default', size = 'default', pressed = false, disabled = false, content = 'Bold' }) =>
    `<ge-toggle${variant === 'default' ? '' : ` variant="${variant}"`}${size === 'default' ? '' : ` size="${size}"`}${pressed ? ' pressed' : ''}${disabled ? ' disabled' : ''}>${content}</ge-toggle>`;

const items = [];
for (const variant of ['default', 'outline']) {
    for (const [state, props] of Object.entries({ off: {}, on: { pressed: true }, disabled: { disabled: true }, 'disabled-on': { disabled: true, pressed: true } })) {
        items.push({ id: `${variant}-${state}`, ref: ref({ variant, ...props }), el: el({ variant, ...props }) });
    }
    items.push(
        { id: `${variant}-icon`, ref: ref({ variant, content: BOLD }), el: el({ variant, content: BOLD }) },
        { id: `${variant}-icon-text-on`, ref: ref({ variant, pressed: true, content: `${BOLD} Bold` }), el: el({ variant, pressed: true, content: `${BOLD} Bold` }) },
        { id: `${variant}-focus`, focus: { ref: 'button', el: 'button' }, ref: ref({ variant }), el: el({ variant }) },
    );
}
for (const size of ['sm', 'lg']) {
    items.push({ id: `size-${size}`, ref: ref({ size, variant: 'outline' }), el: el({ size, variant: 'outline' }) }, { id: `size-${size}-icon`, ref: ref({ size, content: BOLD }), el: el({ size, content: BOLD }) });
}
items.push({ id: 'density-1.5', wrap: '--density:1.5;', ref: ref({ variant: 'outline', pressed: true }), el: el({ variant: 'outline', pressed: true }) });
export default { name: 'toggle', items };
