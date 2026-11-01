// shadcn-angular progress.component.html: a track (relative h-2 w-full overflow-hidden rounded-full bg-primary/20) around a width-driven fill.
const ref = (pct) =>
    `<ui-progress class="block"><div class="relative h-2 w-full overflow-hidden rounded-full bg-primary/20" data-slot="progress"><progress class="sr-only" value="${pct}" max="100"></progress><div class="h-full bg-primary transition-all rounded-full" style="width:${Math.min(100, Math.max(0, pct))}%" aria-hidden="true"></div></div></ui-progress>`;
const W = 'width:16rem;';
const item = (id, value, max = 100, refPct = (value / max) * 100) => ({ id, wrap: W, ref: ref(refPct), el: `<ge-progress value="${value}" max="${max}"></ge-progress>` });
export default {
    name: 'progress',
    items: [
        item('empty', 0),
        item('half', 50),
        item('complete', 100),
        item('custom-max', 30, 40),
        // Clamped to 0-100% in the fill, while the native element still reports the raw value.
        item('over', 150),
        item('negative', -10),
    ],
};
