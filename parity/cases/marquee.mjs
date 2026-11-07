// shadcn-angular marquee.component.html + the setup in marquee.component.ts, which runs a frame after the view is created:
// the segment is cloned into the track, the track becomes a flex row (or column) and animates by one segment plus the gap.
const item = (w, h = 24, n = 'A') => `<div style="width:${w}px;height:${h}px;display:flex;align-items:center;justify-content:center;background:var(--muted);border-radius:6px">${n}</div>`;
const ROW = [item(80, 24, 'A'), item(120, 24, 'B'), item(60, 24, 'C')].join('');
const COL = [item(100, 24, 'A'), item(100, 36, 'B'), item(100, 24, 'C')].join('');
const styleFor = (id, axis, distance, speed, reverse) =>
    `<style>@keyframes mq-${id}{from{transform:${axis}(0)}to{transform:${axis}(-${distance}px)}}.mq-${id}{animation:mq-${id} ${speed}s linear infinite ${reverse ? 'reverse' : 'normal'}}</style>`;
const ref = (id, { dir = 'left', speed = 20, gap = 16, body = ROW, size = 0, cls = '' } = {}) => {
    const vertical = dir === 'up' || dir === 'down';
    const column = vertical ? 'flex-direction:column;' : '';
    const seg = (extra = '') => `<div class="shrink-0" style="display:flex;gap:${gap}px;${column}"${extra}>${body}</div>`;
    return `${styleFor(id, vertical ? 'translateY' : 'translateX', size + gap, speed, dir === 'right' || dir === 'down')}<ui-marquee class="block"><div class="overflow-hidden ${cls}" data-slot="marquee"><div class="mq-${id}" style="gap:${gap}px;display:flex;${vertical ? column : 'width:max-content;'}">${seg()}${seg(' aria-hidden="true"')}</div></div></ui-marquee>`;
};
const el = (attrs, body = ROW) => `<ge-marquee${attrs}>${body}</ge-marquee>`;
const W = 'width:300px;';
const H = 'width:140px;';
// Segment sizes: row = 80+120+60 plus two default gaps; column = 24+36+24 plus two default gaps.
export default {
    name: 'marquee',
    items: [
        { id: 'left-default', wrap: W, ref: ref('l', { size: 292 }), el: el('') },
        { id: 'right', wrap: W, ref: ref('r', { dir: 'right', size: 292 }), el: el(' direction="right"') },
        { id: 'slow-speed', wrap: W, ref: ref('s', { speed: 60, size: 292 }), el: el(' speed="60"') },
        { id: 'wide-gap', wrap: W, ref: ref('g', { gap: 40, size: 260 + 80 }), el: el(' gap="40"') },
        { id: 'no-gap', wrap: W, ref: ref('n', { gap: 0, size: 260 }), el: el(' gap="0"') },
        { id: 'pause-on-hover-idle', wrap: W, ref: ref('p', { size: 292 }), el: el(' pause-on-hover') },
        { id: 'up', wrap: `${H}height:100px;`, ref: ref('u', { dir: 'up', body: COL, size: 84 + 32, cls: 'h-[100px]' }), el: el(' direction="up" style="height:100px"', COL) },
        { id: 'down', wrap: `${H}height:100px;`, ref: ref('d', { dir: 'down', body: COL, size: 84 + 32, cls: 'h-[100px]' }), el: el(' direction="down" style="height:100px"', COL) },
    ],
};
