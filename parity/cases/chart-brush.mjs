// shadcn-angular chart-brush.component.ts and .html: the strip, the selected band, its two handles and the Reset button.
const ref = ({ width = 400, height = 40, selection = null } = {}) => {
    const reset = selection
        ? '<button type="button" data-slot="chart-brush-reset" class="absolute right-1 top-1 z-10 rounded border bg-background/90 px-2 py-0.5 text-xs text-muted-foreground hover:text-foreground" aria-label="Reset zoom">Reset</button>'
        : '';
    let band = '';
    if (selection) {
        const x = Math.min(selection.start, selection.end);
        const w = Math.abs(selection.end - selection.start);
        band = `<rect x="${x}" y="0" width="${w}" height="${height}" class="fill-primary/20 stroke-primary" style="touch-action: none; cursor: move"/><rect x="${x - 3}" y="0" width="6" height="${height}" class="fill-primary" style="touch-action: none; cursor: ew-resize"/><rect x="${x + w - 3}" y="0" width="6" height="${height}" class="fill-primary" style="touch-action: none; cursor: ew-resize"/>`;
    }
    return `<ui-chart-brush class="block"><div class="relative w-full">${reset}<svg viewBox="0 0 ${width} ${height}" height="${height}" class="block w-full select-none" data-slot="chart-brush" preserveAspectRatio="none" role="group" aria-label="Zoom brush"><rect x="0" y="0" width="${width}" height="${height}" class="fill-muted/40" style="touch-action: none; cursor: crosshair"/>${band}</svg></div></ui-chart-brush>`;
};
const el = ({ width = 400, height = 40, selection = null } = {}) =>
    `<ge-chart-brush${width === 400 ? '' : ` width="${width}"`}${height === 40 ? '' : ` height="${height}"`} data-props='${JSON.stringify({ selection })}'></ge-chart-brush>`;
const pair = (id, opts = {}) => ({ id, wrap: 'width:424px;', ref: ref(opts), el: el(opts) });

export default {
    name: 'chart-brush',
    items: [
        pair('empty'),
        pair('selection', { selection: { start: 100, end: 260 } }),
        pair('selection-at-the-edge', { selection: { start: 0, end: 60 } }),
        pair('collapsed-selection', { selection: { start: 200, end: 200 } }),
        pair('reversed-selection', { selection: { start: 300, end: 120 } }),
        pair('tall', { height: 80, selection: { start: 50, end: 150 } }),
        pair('wide-coordinate-space-stretches', { width: 800, selection: { start: 200, end: 520 } }),
    ],
};
