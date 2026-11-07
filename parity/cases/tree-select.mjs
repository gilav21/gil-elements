// shadcn-angular tree-select.component.html and .css (closed): the open panel is promoted to the top layer, which static
// markup cannot show; tree.mjs covers the tree and tree-select.browser.test.ts the panel, the pick and the form value.
// The component stylesheet sits in @layer components, so the density-driven box is written inline here.
const CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 opacity-50"><path d="m6 9 6 6 6-6"/></svg>';
const BUTTON = 'flex w-full items-center justify-between rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const BOX = 'height:calc(2.5rem * var(--density, 1));padding-inline:calc(0.75rem * var(--density, 1));padding-block:calc(0.5rem * var(--density, 1))';

const ref = ({ label = '', placeholder = 'Select...', disabled = false, dir = 'ltr' } = {}) =>
    `<ui-tree-select class="block"><ui-popover class="relative inline-block" data-slot="popover" dir="${dir}" style="width:100%"><ui-popover-trigger class="w-full"><span class="w-full" data-slot="popover-trigger">` +
    `<button type="button" role="combobox" class="${BUTTON}" style="${BOX}" data-slot="tree-select-trigger" ${disabled ? 'disabled' : ''} aria-expanded="false" aria-label="${placeholder}" aria-controls="tree-select-popup" aria-haspopup="tree">` +
    `<span class="flex-1 truncate text-start">${label || `<span class="text-muted-foreground">${placeholder}</span>`}</span>${CHEVRON}</button></span></ui-popover-trigger></ui-popover></ui-tree-select>`;

const NODES = JSON.stringify([
    { key: 'docs', label: 'Documents', children: [{ key: 'intro', label: 'Introduction' }, { key: 'guide', label: 'A guide with a title that is much too long to fit in a narrow control' }] },
    { key: 'src', label: 'Source' },
]).replaceAll("'", '&#39;');
const el = (attrs = '') => `<ge-tree-select data-nodes='${NODES}' ${attrs}></ge-tree-select>`;
const W = 'width:16rem;';

export default {
    name: 'tree-select',
    items: [
        { id: 'placeholder', wrap: W, ref: ref(), el: el() },
        { id: 'custom-placeholder', wrap: W, ref: ref({ placeholder: 'Pick a folder' }), el: el('placeholder="Pick a folder"') },
        { id: 'value', wrap: W, ref: ref({ label: 'Introduction' }), el: el('value="intro"') },
        { id: 'value-top-level', wrap: W, ref: ref({ label: 'Source' }), el: el('value="src"') },
        { id: 'long-label', wrap: 'width:12rem;', ref: ref({ label: 'A guide with a title that is much too long to fit in a narrow control' }), el: el('value="guide"') },
        { id: 'disabled', wrap: W, ref: ref({ disabled: true }), el: el('disabled') },
        { id: 'density-1.5', wrap: `${W}--density:1.5;`, ref: ref(), el: el() },
        { id: 'focus', wrap: W, focus: { ref: 'button', el: 'button' }, ref: ref(), el: el() },
        { id: 'rtl', wrap: `${W}direction:rtl;`, ref: ref({ placeholder: '...בחר', dir: 'rtl' }), el: el('locale="he"') },
    ],
};
