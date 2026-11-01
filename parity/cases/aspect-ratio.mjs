// shadcn-angular aspect-ratio.component.html: a relative, full-width box with padding-bottom = (1 / ratio) * 100%.
const fill = '<div style="position:absolute;inset:0;background:var(--primary);display:flex;align-items:center;justify-content:center;color:var(--primary-foreground)">16:9</div>';
const ref = (ratio, content = fill) =>
    `<ui-aspect-ratio class="contents"><div style="position:relative;width:100%;padding-bottom:${(1 / ratio) * 100}%" data-slot="aspect-ratio">${content}</div></ui-aspect-ratio>`;
const el = (ratio, content = fill) => `<ge-aspect-ratio${ratio === undefined ? '' : ` ratio="${ratio}"`}>${content}</ge-aspect-ratio>`;
const W = 'width:240px;';

export default {
    name: 'aspect-ratio',
    items: [
        { id: 'default-square', wrap: W, ref: ref(1), el: el() },
        { id: 'wide', wrap: W, ref: ref(16 / 9), el: el(16 / 9) },
        { id: 'tall', wrap: W, ref: ref(0.5), el: el(0.5) },
        { id: 'empty-reserves-space', wrap: `${W}outline:1px dashed var(--border);`, ref: ref(2, ''), el: el(2, '') },
        // Angular clips with its `class` input; the web component's equivalent is the `box` part.
        { id: 'clipped-media', wrap: W, ref: ref(4 / 3).replace('position:relative', 'overflow:hidden;border-radius:0.5rem;position:relative'), el: `<style>.clip::part(box){overflow:hidden;border-radius:0.5rem}</style>${el(4 / 3).replace('<ge-aspect-ratio', '<ge-aspect-ratio class="clip"')}` },
    ],
};
