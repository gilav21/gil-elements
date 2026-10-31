// Reference markup for shadcn-angular's button, shared by the button and button-group cases.
// The class strings are what class-variance-authority plus tailwind-merge produce: where a variant or
// size repeats a base utility of the same kind (rounded, text size, border or ring colour) the later one wins.
const BASE = ['focus-visible:border-ring', 'focus-visible:ring-ring/50', 'aria-invalid:ring-destructive/20', 'dark:aria-invalid:ring-destructive/40', 'aria-invalid:border-destructive', 'rounded-lg', 'border', 'border-transparent', 'text-sm', 'font-medium', 'focus-visible:ring-[3px]', 'aria-invalid:ring-[3px]', 'inline-flex', 'items-center', 'justify-center', 'whitespace-nowrap', 'transition-all', 'disabled:pointer-events-none', 'disabled:opacity-50', 'shrink-0', 'outline-none', 'select-none', 'cursor-pointer'];
export const VARIANT = {
    default: 'bg-primary text-primary-foreground hover:bg-primary/90',
    destructive: 'bg-destructive/10 hover:bg-destructive/20 text-destructive focus-visible:ring-destructive/20',
    outline: 'border-input bg-background hover:bg-muted hover:text-foreground',
    secondary: 'border-border bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'hover:bg-muted hover:text-foreground',
    link: 'text-primary underline-offset-4 hover:underline',
};
const SIZE = { default: 'py-2', sm: 'rounded-md text-xs', lg: 'rounded-md', icon: '', 'icon-sm': '', 'icon-lg': '' };
const REPLACES = { 'rounded-md': 'rounded-lg', 'text-xs': 'text-sm', 'border-input': 'border-transparent', 'border-border': 'border-transparent', 'focus-visible:ring-destructive/20': 'focus-visible:ring-ring/50' };
const classes = (variant, size, extra = '') => {
    const added = `${VARIANT[variant]} ${SIZE[size]} ${extra}`.split(' ').filter(Boolean);
    const dropped = new Set(added.map((c) => REPLACES[c]).filter(Boolean));
    return [...BASE.filter((c) => !dropped.has(c)), ...added].join(' ');
};
export const ref = (variant, size, content, { extra = '', disabled = false, host = '' } = {}) =>
    `<ui-button class="contents" data-size="${size}" ${host}><button class="${classes(variant, size, extra)}" type="button" data-slot="button"${disabled ? ' disabled' : ''}>${content}</button></ui-button>`;
