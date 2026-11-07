// shadcn-angular masonry.component: a `relative block w-full` host; every item is taken out of flow at its column width and placed, in source order,
// under the currently shortest column; the host takes the tallest column's height. The reference hand-computes the same placement from the heights.
// The harness pads each case by 12px a side, so wrappers are 24px wider than the wall they hold.
const palette = ['#e2e8f0', '#fecaca', '#bbf7d0', '#bfdbfe', '#fde68a', '#ddd6fe', '#fbcfe8', '#a5f3fc'];
const card = (n, h) => `<div style="height:${h}px;box-sizing:border-box;background:${palette[n % palette.length]};border:1px solid var(--border);border-radius:calc(var(--radius) - 2px);display:flex;align-items:center;justify-content:center;font-size:.875rem">${n + 1}</div>`;
const place = (heights, columns, gap, width) => {
    const colWidth = (width - gap * (columns - 1)) / columns;
    const bottoms = new Array(columns).fill(0);
    const items = heights.map((h, n) => {
        let c = 0;
        for (let i = 1; i < columns; i++) if (bottoms[i] < bottoms[c]) c = i;
        const top = bottoms[c];
        bottoms[c] = top + h + gap;
        const style = `position:absolute;width:${colWidth}px;top:${top}px;inset-inline-start:${c * (colWidth + gap)}px`;
        return card(n, h).replace('style="', `style="${style};`);
    });
    return `<ui-masonry class="relative block w-full" data-slot="masonry" style="height:${Math.max(...bottoms) - gap}px">${items.join('')}</ui-masonry>`;
};
const HEIGHTS = [110, 70, 90, 60, 130, 50, 100, 80, 120];
const el = (heights, attrs) => `<ge-masonry ${attrs}>${heights.map((h, n) => card(n, h)).join('')}</ge-masonry>`;
export default {
    name: 'masonry',
    items: [
        { id: 'three-columns', wrap: 'width:644px;', ref: place(HEIGHTS, 3, 10, 620), el: el(HEIGHTS, 'columns="3" gap="10"') },
        { id: 'default-gap', wrap: 'width:664px;', ref: place(HEIGHTS, 2, 16, 640), el: el(HEIGHTS, 'columns=\'{"base":1,"sm":2,"lg":3}\'') },
        { id: 'one-column', wrap: 'width:224px;', ref: place(HEIGHTS.slice(0, 4), 1, 8, 200), el: el(HEIGHTS.slice(0, 4), 'columns="1" gap="8"') },
        { id: 'no-gap', wrap: 'width:504px;', ref: place(HEIGHTS, 4, 0, 480), el: el(HEIGHTS, 'columns="4" gap="0"') },
        { id: 'fewer-items-than-columns', wrap: 'width:504px;', ref: place(HEIGHTS.slice(0, 2), 4, 12, 480), el: el(HEIGHTS.slice(0, 2), 'columns="4" gap="12"') },
    ],
};
