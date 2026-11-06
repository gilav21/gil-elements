// shadcn-angular blur-fade.component.ts: the host is `block` and is animated by the Web Animations API (opacity 0 to 1, blur 8px to 0,
// an 8px slide), 500ms, cubic-bezier(0.2, 0.6, 0.35, 1), fill forwards. The reference reproduces that with a CSS animation; the harness
// freezes both at `at` ms. The element side plays at once (in-view="false") because most cases are below the fold.
const FROM = { up: 'translateY(8px)', down: 'translateY(-8px)', left: 'translateX(8px)', right: 'translateX(-8px)' };
const BODY = '<div style="padding:12px 16px;border:1px solid var(--border);border-radius:8px;background:var(--card);width:200px">Fade me in<br>with a second line</div>';
const ref = (id, direction, duration, delay) =>
    `<style>@keyframes bf-${id}{from{opacity:0;filter:blur(8px);transform:${FROM[direction]}}to{opacity:1;filter:blur(0);transform:translate(0,0)}}.bf-${id}{opacity:0;animation:bf-${id} ${duration}ms ${delay}ms cubic-bezier(0.2,0.6,0.35,1) forwards}</style><ui-blur-fade class="block bf-${id}" data-slot="blur-fade">${BODY}</ui-blur-fade>`;
const el = (direction, duration, delay) => `<ge-blur-fade in-view="false" direction="${direction}" duration="${duration}" delay="${delay}">${BODY}</ge-blur-fade>`;
const W = 'width:260px;';
export default {
    name: 'blur-fade',
    items: [
        ...['up', 'down', 'left', 'right'].map((d) => ({ id: `${d}-mid`, wrap: W, at: 250, ref: ref(`${d}-mid`, d, 500, 0), el: el(d, 500, 0) })),
        { id: 'up-done', wrap: W, at: 900, ref: ref('up-done', 'up', 500, 0), el: el('up', 500, 0) },
        { id: 'slow-mid', wrap: W, at: 600, ref: ref('slow-mid', 'left', 1200, 0), el: el('left', 1200, 0) },
        { id: 'delayed-before', wrap: W, at: 150, ref: ref('delayed-before', 'up', 500, 300), el: el('up', 500, 300) },
        { id: 'delayed-mid', wrap: W, at: 550, ref: ref('delayed-mid', 'up', 500, 300), el: el('up', 500, 300) },
    ],
};
