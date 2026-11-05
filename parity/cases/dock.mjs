// shadcn-angular dock.component.html/.ts and sub/*: the class strings Angular renders, copied. The reference adds `group`
// to each item, which is the proposed fix for the label never showing: Angular only reveals it under a `group` ancestor
// and the dock never adds one.
const BAR = 'mx-auto w-max max-w-[calc(100vw-2rem)] overflow-x-auto mt-4 sm:mt-8 h-[50px] sm:h-[58px] p-1.5 sm:p-2 flex gap-1.5 sm:gap-2 rounded-2xl border supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 backdrop-blur-md';
const POSITION = { bottom: 'items-end', top: 'items-start', left: 'items-start flex-col', right: 'items-start flex-col' };
const ITEM = 'rounded-full cursor-pointer transition-[width,height,margin] duration-100 ease-out relative group';
const LABEL = 'absolute -top-10 left-1/2 -translate-x-1/2 hidden px-2 py-0.5 rounded-md border bg-popover text-popover-foreground text-xs shadow-md group-hover:block';

const refItem = ({ label, icon, active, extra = '', control = '' }) =>
    `<ui-dock-item class="${ITEM}${extra}" style="width: 40px;"><div data-slot="dock-item" class="aspect-square w-full h-full flex items-center justify-center relative">${label ? `<ui-dock-label class="contents"><div class="${LABEL}" data-slot="dock-label">${label}</div></ui-dock-label>` : ''}${icon ? `<ui-dock-icon class="contents"><div class="size-full flex items-center justify-center" data-slot="dock-icon">${icon}</div></ui-dock-icon>` : ''}${control}${active ? '<div class="absolute -bottom-1 w-1 h-1 rounded-full bg-foreground/50"></div>' : ''}</div></ui-dock-item>`;
const elItem = ({ label, icon, active, attrs = '' }) =>
    `<ge-dock-item${active ? ' active' : ''}${attrs}>${label ? `<ge-dock-label>${label}</ge-dock-label>` : ''}${icon ? `<ge-dock-icon>${icon}</ge-dock-icon>` : ''}</ge-dock-item>`;

const ITEMS = [{ label: 'Home', icon: '🏠', active: true }, { label: 'Files', icon: '📁' }, { label: 'Search', icon: '🔍' }, { label: 'Trash', icon: '🗑️', active: true }];
// A column (left/right) is laid out with its length free: the proposed fix for the horizontal bar's fixed height clipping all but one item.
const VERTICAL = BAR.replace('overflow-x-auto mt-4 sm:mt-8 h-[50px] sm:h-[58px]', 'overflow-y-auto overflow-x-hidden mt-0 h-max max-h-[calc(100vh-2rem)]');
// tailwind-merge by hand: a height class passed in replaces the bar's own.
const barFor = (position, tall) => (tall ? BAR.replace('h-[50px] sm:h-[58px]', tall) : position === 'left' || position === 'right' ? VERTICAL : BAR);
const refDock = (position, items = ITEMS, tall = '') => `<ui-dock class="contents"><div class="${barFor(position, tall)} ${POSITION[position]}" data-slot="dock" tabindex="0">${items.map(refItem).join('')}</div></ui-dock>`;
const elDock = (position, items = ITEMS, attrs = '') => `<ge-dock position="${position}"${attrs}>${items.map(elItem).join('')}</ge-dock>`;
const ICON_STYLE = '<style>.rich::part(base){background:linear-gradient(to bottom in oklab,oklch(74.6% 0.16 232.661),oklch(58.8% 0.158 241.966));border:1px solid color-mix(in oklab,oklch(74.6% 0.16 232.661) 30%,transparent);color:white;border-radius:calc(var(--radius) + 4px)}</style>';
const RICH = 'bg-gradient-to-b from-sky-400 to-sky-600 border border-sky-400/30 text-white rounded-xl';

const link = '<a class="absolute inset-0 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" data-slot="dock-item-link" href="#x" aria-label="Home"></a>';
const button = '<button type="button" class="absolute inset-0 rounded-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" data-slot="dock-item-button" aria-label="Search"></button>';

export default {
    name: 'dock',
    items: [
        ...['bottom', 'top', 'left', 'right'].map((position) => ({ id: position, wrap: 'height:160px;', ref: refDock(position), el: elDock(position) })),
        { id: 'tall-bar', wrap: 'height:160px;', ref: refDock('bottom', ITEMS, 'h-24 sm:h-24'), el: `<style>.tall::part(base){height:6rem}</style>${elDock('bottom', ITEMS, ' class="tall"')}` },
        {
            id: 'simple-mode',
            wrap: 'height:120px;',
            ref: `<ui-dock class="contents"><div class="${BAR} items-end" data-slot="dock" tabindex="0">${refItem({ label: 'Home', icon: '🏠', active: true, control: link })}${refItem({ label: 'Search', icon: '🔍', control: button })}${refItem({ icon: '⚙️' })}</div></ui-dock>`,
            el: '<ge-dock data-items=\'[{"label":"Home","icon":"🏠","active":true,"href":"#x"},{"label":"Search","icon":"🔍","button":true},{"icon":"⚙️"}]\'></ge-dock>',
        },
        {
            id: 'rich-icons',
            wrap: 'height:120px;',
            ref: `<ui-dock class="contents"><div class="${BAR} items-end" data-slot="dock" tabindex="0">${refItem({ label: 'Finder', active: true }).replace('</div></ui-dock-item>', `<ui-dock-icon class="contents"><div class="size-full flex items-center justify-center ${RICH}" data-slot="dock-icon">F</div></ui-dock-icon></div></ui-dock-item>`)}${refItem({ icon: 'M' })}</div></ui-dock>`,
            el: `${ICON_STYLE}<ge-dock><ge-dock-item active><ge-dock-label>Finder</ge-dock-label><ge-dock-icon class="rich">F</ge-dock-icon></ge-dock-item><ge-dock-item><ge-dock-icon>M</ge-dock-icon></ge-dock-item></ge-dock>`,
        },
        { id: 'many-items-scroll', wrap: 'width:260px;height:120px;', ref: refDock('bottom', Array.from({ length: 9 }, (_, i) => ({ icon: String(i) }))), el: elDock('bottom', Array.from({ length: 9 }, (_, i) => ({ icon: String(i) }))) },
        { id: 'focus', focus: { ref: '[data-slot=dock]', el: '[data-slot=dock]' }, wrap: 'height:120px;', ref: refDock('bottom'), el: elDock('bottom') },
    ],
};
