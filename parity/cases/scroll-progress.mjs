// shadcn-angular scroll-progress.component: a `fixed left-0 right-0 z-50 transition-none` track (top-0 or bottom-0) holding a bar whose width is the
// scrolled percentage, `height` px tall in `color`. The harness wraps each case in a transformed box, which becomes the fixed containing block on both
// sides. Each case tracks its own small scroller (the page itself scrolls while the harness measures): at rest (0%) and, with `data-scroll-end`, at 100%.
const ref = (id, end, pos, height, colour, width) => `<div id="${id}" ${end ? 'data-scroll-end' : ''} style="height:80px;overflow:auto;width:200px;border:1px solid var(--border)"><div style="height:240px;padding:8px">Content</div></div><ui-scroll-progress class="contents"><div class="fixed left-0 right-0 z-50 transition-none ${pos}" data-slot="scroll-progress"><div style="width:${width}%;height:${height}px;background-color:${colour}"></div></div></ui-scroll-progress>`;
const el = (id, end, attrs = '') => `<div id="${id}" ${end ? 'data-scroll-end' : ''} style="height:80px;overflow:auto;width:200px;border:1px solid var(--border)"><div style="height:240px;padding:8px">Content</div></div><ge-scroll-progress container="#${id}" ${attrs}></ge-scroll-progress>`;
const W = 'height:140px;width:300px;';
export default {
    name: 'scroll-progress',
    items: [
        { id: 'top-rest', wrap: W, ref: ref('sp-a', false, 'top-0', 3, 'var(--primary)', 0), el: el('sp-a', false) },
        { id: 'bottom-tall-red', wrap: W, ref: ref('sp-b', false, 'bottom-0', 8, 'red', 0), el: el('sp-b', false, 'position="bottom" color="red" height="8"') },
        { id: 'top-end', wrap: W, ref: ref('sp-c', true, 'top-0', 3, 'var(--primary)', 100), el: el('sp-c', true) },
        { id: 'bottom-end-thin', wrap: W, ref: ref('sp-d', true, 'bottom-0', 1, 'rgb(34, 197, 94)', 100), el: el('sp-d', true, 'position="bottom" height="1" color="rgb(34, 197, 94)"') },
    ],
};
