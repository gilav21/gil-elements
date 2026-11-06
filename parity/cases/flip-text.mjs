// shadcn-angular flip-text.component.html + .css: an inline-flex wrapper of inline-block spans, each with the flip-in animation
// (rotateX 90deg to 0, blur 4px to 0, opacity 0 to 1), a per-character delay and one shared duration.
const STYLE = '<style>.animate-flip-in{opacity:0;animation:flip-in forwards cubic-bezier(0.2,0.6,0.35,1)}@keyframes flip-in{0%{opacity:0;transform:rotateX(90deg);filter:blur(4px)}100%{opacity:1;transform:rotateX(0deg);filter:blur(0)}}</style>';
const ref = (text, delay = 50, duration = 500, cls = '') =>
    `${STYLE}<ui-flip-text class="contents"><span class="inline-flex ${cls}" data-slot="flip-text">${text.split('').map((c, i) => `<span class="inline-block animate-flip-in" style="animation-delay:${i * delay}ms;animation-duration:${duration}ms">${c === ' ' ? ' ' : c}</span>`).join('')}</span></ui-flip-text>`;
const el = (text, attrs = '') => `<ge-flip-text text="${text}"${attrs}></ge-flip-text>`;
const T = 'Flip these letters';
const W = 'font-size:28px;font-weight:700;width:360px;';
export default {
    name: 'flip-text',
    items: [
        { id: 'start', wrap: W, at: 100, ref: ref(T), el: el(T) },
        { id: 'mid', wrap: W, at: 500, ref: ref(T), el: el(T) },
        { id: 'done', wrap: W, at: 1700, ref: ref(T), el: el(T) },
        { id: 'slow-wide', wrap: W, at: 900, ref: ref(T, 120, 800), el: el(T, ' delay="120" duration="800"') },
        { id: 'tight-fast', wrap: W, at: 300, ref: ref(T, 10, 200), el: el(T, ' delay="10" duration="200"') },
        { id: 'spaces', wrap: W, at: 1700, ref: ref('a  b'), el: el('a  b') },
        { id: 'empty', wrap: `${W}outline:1px dashed var(--border);min-height:10px;`, ref: ref(''), el: el('') },
        { id: 'wrapper-class', wrap: W, at: 1700, ref: ref(T, 50, 500, 'text-primary'), el: `<style>.tinted::part(base){color:var(--primary)}</style>${el(T, ' class="tinted"')}` },
    ],
};
