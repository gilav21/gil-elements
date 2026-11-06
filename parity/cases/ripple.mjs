// shadcn-angular ripple.directive.ts: the host becomes position:relative and overflow:hidden; a click adds an absolutely
// positioned circle twice the host's longer side across, centred on the click, that scales 0 to 1 while fading out.
const STYLE = (name, ms) => `<style>@keyframes rp-${name}{from{transform:scale(0);opacity:1}to{transform:scale(1);opacity:0}}.rp-${name}{animation:rp-${name} ${ms}ms cubic-bezier(.2,.6,.35,1) forwards}</style>`;
const BOX = 'width:200px;height:80px;border-radius:12px;background:var(--primary);color:var(--primary-foreground);';
const inner = '<div style="display:flex;height:100%;align-items:center;justify-content:center;font-size:14px">Click me</div>';
const wave = (name, [x, y], { color = 'color-mix(in srgb, currentColor 35%, transparent)' } = {}) =>
    `<span class="rp-${name}" style="position:absolute;width:400px;height:400px;left:${x - 200}px;top:${y - 200}px;border-radius:50%;pointer-events:none;background-color:${color}"></span>`;
const ref = (name, ms, points, extra = {}) => `${STYLE(name, ms)}<div style="position:relative;overflow:hidden;${BOX}">${inner}${points.map((p) => wave(name, p, extra)).join('')}</div>`;
const el = (points, attrs = '') => `<ge-ripple${attrs} style="${BOX}" data-click-at="${points.map((p) => p.join(',')).join(';')}">${inner}</ge-ripple>`;
const AT = 1000;

export default {
    name: 'ripple',
    items: [
        { id: 'default-centre', at: AT, ref: ref('a', 20000, [[100, 40]]), el: el([[100, 40]], ' duration="20000"') },
        { id: 'default-corner', at: AT, ref: ref('b', 20000, [[20, 10]]), el: el([[20, 10]], ' duration="20000"') },
        { id: 'two-clicks', at: AT, ref: ref('c', 20000, [[40, 20], [160, 60]]), el: el([[40, 20], [160, 60]], ' duration="20000"') },
        { id: 'custom-colour', at: AT, ref: ref('d', 20000, [[100, 40]], { color: 'rgb(255, 255, 0)' }), el: el([[100, 40]], ' duration="20000" color="rgb(255, 255, 0)"') },
        { id: 'slower-duration', at: AT, ref: ref('e', 40000, [[100, 40]]), el: el([[100, 40]], ' duration="40000"') },
        { id: 'at-rest', ref: `<div style="position:relative;overflow:hidden;${BOX}">${inner}</div>`, el: `<ge-ripple style="${BOX}">${inner}</ge-ripple>` },
        { id: 'disabled', ref: `<div style="${BOX}">${inner}</div>`, el: `<ge-ripple disabled style="${BOX}" data-click-at="100,40">${inner}</ge-ripple>` },
    ],
};
