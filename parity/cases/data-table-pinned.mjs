// Pinned columns (cmp 2408-2467, 3220-3235): sticky cells with stacked offsets, over a viewport that scrolls sideways.
// The reference gives a pinned header z-index 30 (the intent of `_applyPinStyle`; its second assignment makes it 20, so the
// scrolled headers of the middle columns would paint over the pinned ones).
import { COLUMNS, ROWS, cellStyle, elTable, refTable } from './data-table.mjs';

const WIDE = [
    { accessorKey: 'id', header: 'ID', width: '100px' },
    { accessorKey: 'name', header: 'Name', width: '200px' },
    { accessorKey: 'role', header: 'Role', width: '300px' },
    { accessorKey: 'age', header: 'Age', width: '150px' },
];
const refStyle = (pins) => (c, header) => {
    const pin = pins[c.accessorKey];
    const base = cellStyle(c.width);
    if (pin) return `${base} position: sticky; ${pin.side}: ${pin.offset}px; z-index: ${header ? 30 : 10};${header ? ' top: 0px;' : ''}`;
    return header ? `${base} position: sticky; top: 0px; z-index: 20;` : base;
};
const withPins = (pins) => WIDE.map((c) => ({ ...c, ...(pins[c.accessorKey] ? { pin: pins[c.accessorKey].side } : {}) }));

const item = (id, pins, { scroll = 0, attrs = '', colBorders = true } = {}) => ({
    id,
    wrap: 'width:100%;',
    ref: refTable({ columns: WIDE, rows: ROWS, style: refStyle(pins), scrollLeft: scroll, colBorders }),
    el: elTable({ columns: withPins(pins), rows: ROWS, attrs: `${attrs} data-scroll-left="${scroll}"` }),
});

const LEFT1 = { id: { side: 'left', offset: 0 } };
const LEFT2 = { id: { side: 'left', offset: 0 }, name: { side: 'left', offset: 100 } };
const RIGHT = { age: { side: 'right', offset: 0 } };

export default {
    name: 'data-table-pinned',
    isolated: true,
    width: 460,
    items: [
        item('left-1', LEFT1),
        item('left-1-scrolled', LEFT1, { scroll: 120 }),
        item('left-2-scrolled', LEFT2, { scroll: 120 }),
        item('right-scrolled', RIGHT, { scroll: 120 }),
        item('both-scrolled', { ...LEFT2, ...RIGHT }, { scroll: 160 }),
        item('both-no-column-borders', { ...LEFT1, ...RIGHT }, { scroll: 160, attrs: 'show-column-borders="false"', colBorders: false }),
        { id: 'unscrolled-unpinned', wrap: 'width:100%;', ref: refTable({ columns: COLUMNS, rows: ROWS, scrollLeft: 0 }), el: elTable({ columns: COLUMNS, rows: ROWS, attrs: 'data-scroll-left="0"' }) },
    ],
};
