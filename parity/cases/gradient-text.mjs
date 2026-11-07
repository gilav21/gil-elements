// shadcn-angular gradient-text.component.ts: an inline-block host with `background: linear-gradient(...)` sized 200% 200%, clipped to the text,
// text-fill transparent; a requestAnimationFrame loop pans background-position. The loop cannot be frozen, so every case uses a sweep of a
// hundred thousand seconds: after the first second the position is still 50% (to within 0.001%), which is what the reference states.
const STOPS = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4'];
const ref = (stops, dir = 'to right', cls = '', inner = 'Gradient text') =>
    `<ui-gradient-text class="inline-block ${cls}" data-slot="gradient-text" style="background:linear-gradient(${dir}, ${stops.join(', ')});background-size:200% 200%;background-clip:text;-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-position:50% 50%">${inner}</ui-gradient-text>`;
const el = (stops, dir = 'to right', attrs = '', inner = 'Gradient text') => `<ge-gradient-text speed="100000" direction="${dir}"${attrs} data-props='${JSON.stringify({ colors: stops })}'>${inner}</ge-gradient-text>`;
const W = 'font-size:32px;font-weight:800;width:360px;';
export default {
    name: 'gradient-text',
    items: [
        { id: 'default', wrap: W, ref: ref(STOPS), el: el(STOPS) },
        ...['to left', 'to bottom', 'to top'].map((d) => ({ id: d.replace(' ', '-'), wrap: W, ref: ref(STOPS, d), el: el(STOPS, d) })),
        { id: 'two-stops', wrap: W, ref: ref(['#000000', '#ffffff']), el: el(['#000000', '#ffffff']) },
        { id: 'one-stop', wrap: W, ref: ref(['#e11d48']), el: el(['#e11d48']) },
        { id: 'long-text-wraps', wrap: 'font-size:24px;font-weight:700;width:200px;', ref: ref(STOPS, 'to right', '', 'A gradient over a sentence that wraps onto several lines'), el: el(STOPS, 'to right', '', 'A gradient over a sentence that wraps onto several lines') },
        { id: 'inside-element', wrap: W, ref: ref(STOPS, 'to right', '', '<b>Bold</b> and plain'), el: el(STOPS, 'to right', '', '<b>Bold</b> and plain') },
    ],
};
