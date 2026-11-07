// shadcn-angular magnetic.directive.ts: the host gets transform translate(pull) and a transform transition; the pull is
// (pointer - centre) * strength while the pointer is within the radius of the centre.
const B = 'width:120px;height:44px;border-radius:8px;background:var(--primary);color:var(--primary-foreground);display:flex;align-items:center;justify-content:center;font-size:14px;';
const WRAP = 'padding:40px;';
const ref = (tx, ty, ms = 150) => `<span style="display:inline-block;transform:translate(${tx}px, ${ty}px);transition:transform ${ms}ms ease-out"><div style="${B}">Hover me</div></span>`;
const el = (attrs = '', move = '') => `<ge-magnetic${attrs}${move ? ` data-move-at="${move}"` : ''}><div style="${B}">Hover me</div></ge-magnetic>`;
// Pointer at (90, 30) of a 120x44 box: 30px right of and 8px below the centre (60, 22).
export default {
    name: 'magnetic',
    items: [
        { id: 'at-rest', wrap: WRAP, ref: ref(0, 0), el: el() },
        { id: 'pulled-default', wrap: WRAP, ref: ref(9, 2.4), el: el('', '90,30') },
        // Whole-pixel pulls only: a fractional translate of an animated layer is rasterised on a different subpixel grid than a static one.
        { id: 'pulled-strong', wrap: WRAP, ref: ref(20, 6), el: el(' strength="0.5"', '100,34') },
        { id: 'pulled-up-left', wrap: WRAP, ref: ref(-12, -6.6), el: el('', '20,0') },
        { id: 'outside-radius', wrap: WRAP, ref: ref(0, 0), el: el(' radius="20"', '90,30') },
        { id: 'slower-smoothing', wrap: WRAP, ref: ref(9, 2.4, 300), el: el(' smoothing="300"', '90,30') },
    ],
};
