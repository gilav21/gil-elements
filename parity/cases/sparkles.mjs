// shadcn-angular sparkles.component.html: the host is `display: contents`; the svg (160x160 viewBox, four-point star in currentColor) is
// `pointer-events-none absolute` and sized/placed by its class. The ping animation scales the star to 2x and fades it, so the cases hold it at
// its start with a long animation delay on the star (the element side puts the delay on the host).
const STAR = 'M80 0C80 0 84.2846 41.2925 101.496 58.504C118.707 75.7154 160 80 160 80C160 80 118.707 84.2846 101.496 101.496C84.2846 118.707 80 160 80 160C80 160 75.7154 118.707 58.504 101.496C41.2925 84.2846 0 80 0 80C0 80 41.2925 75.7154 58.504 58.504C75.7154 41.2925 80 0 80 0Z';
const KEYFRAMES = '<style>@keyframes ge-ref-ping{75%,100%{transform:scale(2);opacity:0}}</style>';
const ref = (pos) => `${KEYFRAMES}<ui-sparkles style="display: contents"><svg class="pointer-events-none absolute" style="${pos};animation-delay:0s" data-slot="sparkles" viewBox="0 0 160 160" fill="none" aria-hidden="true"><path d="${STAR}" class="origin-center" style="animation:ge-ref-ping 1.5s cubic-bezier(0,0,.2,1) 100000s infinite" fill="currentColor"/></svg></ui-sparkles>`;
const el = (pos) => `<ge-sparkles style="${pos};animation-delay:100000s"></ge-sparkles>`;
const box = (inner, style = '') => `<div style="position:relative;width:240px;height:120px;background:var(--muted);${style}">${inner}</div>`;
export default {
    name: 'sparkles',
    items: [
        { id: 'small', ref: box(ref('top:20px;left:30px;width:24px;height:24px;color:var(--primary)')), el: box(el('top:20px;left:30px;width:24px;height:24px;color:var(--primary)')) },
        { id: 'large', ref: box(ref('top:10px;left:100px;width:64px;height:64px;color:#f59e0b')), el: box(el('top:10px;left:100px;width:64px;height:64px;color:#f59e0b')) },
        { id: 'three', ref: box(`${ref('top:10px;left:20px;width:16px;height:16px;color:#f59e0b')}${ref('top:60px;left:120px;width:28px;height:28px;color:#ec4899')}${ref('top:20px;left:190px;width:12px;height:12px;color:#38bdf8')}`), el: box(`${el('top:10px;left:20px;width:16px;height:16px;color:#f59e0b')}${el('top:60px;left:120px;width:28px;height:28px;color:#ec4899')}${el('top:20px;left:190px;width:12px;height:12px;color:#38bdf8')}`) },
    ],
};
