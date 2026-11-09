// Conditional formatting that data can carry: colour scale and data bar (html 46-87). Class and style rules, icon sets
// and anything else that is a function cannot travel in `data-props`; the browser tests cover those.
import { cellStyle, elTable, refTable } from './data-table.mjs';

const COLUMNS = [
    { accessorKey: 'name', header: 'Name' },
    { accessorKey: 'age', header: 'Age', width: '120px', colorScale: { min: 20, max: 45, from: '#ffffff', to: '#3b82f6' } },
    { accessorKey: 'score', header: 'Score', width: '200px', dataBar: { min: 0, max: 100, color: '#22c55e' } },
    { accessorKey: 'load', header: 'Load', width: '200px', dataBar: { min: 0, max: 100, color: '#f59e0b', track: '#e5e7eb' } },
];
const ROWS = [
    { name: 'Alice Martin', age: 34, score: 82, load: 20 },
    { name: 'Bob Stone', age: 28, score: 47, load: 55 },
    { name: 'Carol Diaz', age: 41, score: 100, load: 90 },
    { name: 'Dave Lee', age: 25, score: 0, load: 100 },
];

const pct = (v, min, max) => (max === min ? 0 : Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100)));
const cellHtml = (c, row) => {
    const value = row[c.accessorKey];
    const text = `<span class="relative min-w-0 truncate">${value}</span>`;
    if (c.colorScale) {
        const s = c.colorScale;
        return `<span data-slot="cell-formatted" class="relative flex w-full items-center gap-1.5 " style="background-color: color-mix(in srgb, ${s.to} ${pct(value, s.min, s.max)}%, ${s.from});">${text}</span>`;
    }
    if (c.dataBar) {
        const b = c.dataBar;
        const track = b.track ? `<span data-slot="cell-data-bar-track" class="pointer-events-none absolute inset-x-0 inset-y-0.5 rounded-sm" style="background-color: ${b.track};"></span>` : '';
        return `<span data-slot="cell-formatted" class="relative flex w-full items-center gap-1.5 " style="">${track}<span data-slot="cell-data-bar" class="pointer-events-none absolute inset-y-0.5 start-0 rounded-sm" style="width: ${pct(value, b.min, b.max)}%; background-color: ${b.color};"></span>${text}</span>`;
    }
    return value;
};
const style = (c) => cellStyle(c.width);

export default {
    name: 'data-table-format',
    isolated: true,
    width: 700,
    items: [
        { id: 'scale-and-bars', wrap: 'width:100%;', ref: refTable({ columns: COLUMNS, rows: ROWS, cellHtml, style }), el: elTable({ columns: COLUMNS, rows: ROWS }) },
        { id: 'no-borders', wrap: 'width:100%;', ref: refTable({ columns: COLUMNS, rows: ROWS, cellHtml, style, rowBorders: false, colBorders: false }), el: elTable({ columns: COLUMNS, rows: ROWS, attrs: 'show-row-borders="false" show-column-borders="false"' }) },
    ],
};
