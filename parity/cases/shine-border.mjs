// shadcn-angular shine-border.component.html: a `relative inline-block` wrapper (its class sets the width) painted with a conic gradient,
// padded by the border width and rounded; inside it `bg-background h-full w-full rounded-[inherit]`. The gradient turns on a frame loop, so the
// cases use a duration of a hundred thousand seconds, which keeps it at 0deg.
const COLOURS = ['#A07CFE', '#FE8FB5', '#FFBE7B'];
const ref = (cls = 'w-64', colours = COLOURS, width = 2, radius = 8, inner = '<p class="p-4">Shine</p>') =>
    `<ui-shine-border class="contents"><div class="relative inline-block ${cls}" data-slot="shine-border" style="background:conic-gradient(from 0deg, ${colours.join(', ')});padding:${width}px;border-radius:${radius}px"><div class="bg-background h-full w-full rounded-[inherit]">${inner}</div></div></ui-shine-border>`;
const el = (style = 'width:16rem', props = {}, attrs = '', inner = '<p style="margin:0;padding:1rem">Shine</p>') =>
    `<ge-shine-border duration="100000" ${attrs} style="${style}" data-props='${JSON.stringify(props)}'>${inner}</ge-shine-border>`;
export default {
    name: 'shine-border',
    items: [
        { id: 'default', ref: ref(), el: el() },
        { id: 'colours', ref: ref('w-64', ['red', 'blue']), el: el('width:16rem', { colors: ['red', 'blue'] }) },
        { id: 'thick-round', ref: ref('w-64', COLOURS, 6, 24), el: el('width:16rem', {}, 'border-width="6" border-radius="24"') },
        { id: 'square', ref: ref('w-64', COLOURS, 1, 0), el: el('width:16rem', {}, 'border-width="1" border-radius="0"') },
        { id: 'shrink-wrapped', ref: ref('', COLOURS, 2, 8, '<p class="p-4">Short</p>'), el: el('', {}, '', '<p style="margin:0;padding:1rem">Short</p>') },
    ],
};
