// shadcn-angular textarea.component.html and .ts (textareaVariants).
const BASE = 'flex w-full border-input bg-transparent text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm';
const VARIANT = {
    outline: 'rounded-md border shadow-sm focus-visible:ring-1 focus-visible:ring-ring',
    underline: 'rounded-none border-b focus-visible:border-ring px-0 shadow-none resize-none',
    ghost: 'border-none shadow-none focus-visible:ring-0 resize-none px-0',
};
const W = 'width:16rem;';

const attrs = ({ placeholder = '', rows = 3, disabled = false } = {}) => `placeholder="${placeholder}" rows="${rows}" ${disabled ? 'disabled' : ''}`;
const ref = (variant, p = {}, value = '') => `<ui-textarea class="contents"><textarea class="${BASE} ${VARIANT[variant]}" ${attrs(p)} data-slot="textarea">${value}</textarea></ui-textarea>`;
const el = (variant, p = {}, value = '') =>
    `<ge-textarea${variant === 'outline' ? '' : ` variant="${variant}"`}${p.placeholder ? ` placeholder="${p.placeholder}"` : ''}${p.rows ? ` rows="${p.rows}"` : ''}${p.disabled ? ' disabled' : ''}${value ? ` value="${value}"` : ''}></ge-textarea>`;

const items = [];
for (const variant of ['outline', 'underline', 'ghost']) {
    items.push(
        { id: `${variant}-placeholder`, wrap: W, ref: ref(variant, { placeholder: 'Tell us more' }), el: el(variant, { placeholder: 'Tell us more' }) },
        { id: `${variant}-value`, wrap: W, ref: ref(variant, {}, 'First line\nSecond line'), el: el(variant, {}, 'First line&#10;Second line') },
        { id: `${variant}-disabled`, wrap: W, ref: ref(variant, { disabled: true }, 'Locked'), el: el(variant, { disabled: true }, 'Locked') },
        { id: `${variant}-focus`, wrap: W, focus: { ref: 'textarea', el: 'textarea' }, ref: ref(variant, { placeholder: 'Tell us more' }), el: el(variant, { placeholder: 'Tell us more' }) },
    );
}
items.push(
    { id: 'rows-6', wrap: W, ref: ref('outline', { rows: 6, placeholder: 'Six lines' }), el: el('outline', { rows: 6, placeholder: 'Six lines' }) },
    { id: 'rows-1', wrap: W, ref: ref('outline', { rows: 1, placeholder: 'One line' }), el: el('outline', { rows: 1, placeholder: 'One line' }) },
    { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: ref('outline', { placeholder: 'Tell us more' }), el: el('outline', { placeholder: 'Tell us more' }) },
    { id: 'density-0.75', wrap: `${W}--density:0.75;`, ref: ref('outline', { placeholder: 'Tell us more' }), el: el('outline', { placeholder: 'Tell us more' }) },
    { id: 'skeleton', at: 700, wrap: `${W}display:flex`, ref: '<ui-textarea class="contents"><ui-skeleton class="rounded-md animate-pulse bg-primary/10 block min-h-12 sm:min-h-[3.75rem] w-full rounded-md"></ui-skeleton></ui-textarea>', el: '<ge-textarea skeleton></ge-textarea>' },
);
export default { name: 'textarea', items };
