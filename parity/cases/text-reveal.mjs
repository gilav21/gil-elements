// shadcn-angular text-reveal.component.html + .css: a flex-wrap container, one inline-block span per word followed by &nbsp;.
const STYLE = '<style>.animate-blur-in{animation:blur-in 1s forwards cubic-bezier(.2,.2,0,1)}@keyframes blur-in{0%{opacity:0;filter:blur(10px);transform:translateY(10px)}100%{opacity:1;filter:blur(0);transform:translateY(0)}}</style>';
const WORD = 'inline-block transition-all duration-500 will-change-[transform,opacity,filter] opacity-0 animate-blur-in';
const ref = (text, delay = 50, cls = '') => {
    const words = text.split(/[ \t\n\r\f]+/).filter((w) => w !== '');
    const spans = words.map((w, i) => `<span class="${WORD}" style="animation-delay:${i * delay}ms">${w}&nbsp;</span>`).join('');
    return `${STYLE}<ui-text-reveal><div class="flex flex-wrap ${cls}" data-slot="text-reveal">${spans}</div></ui-text-reveal>`;
};
const el = (text, attrs = '') => `<ge-text-reveal text="${text}"${attrs}></ge-text-reveal>`;
const SENTENCE = 'Ship web components that look like shadcn';
const W = 'width:360px;';

export default {
    name: 'text-reveal',
    items: [
        { id: 'default', wrap: W, ref: ref(SENTENCE), el: el(SENTENCE) },
        { id: 'delay-200', wrap: W, ref: ref(SENTENCE, 200), el: el(SENTENCE, ' delay="200"') },
        { id: 'delay-0', wrap: W, ref: ref(SENTENCE, 0), el: el(SENTENCE, ' delay="0"') },
        { id: 'wraps-narrow', wrap: 'width:140px;', ref: ref(SENTENCE), el: el(SENTENCE) },
        { id: 'collapses-whitespace', wrap: W, ref: ref('  one   two\n three  '), el: el('  one   two\n three  ') },
        { id: 'empty', wrap: `${W}outline:1px dashed var(--border);min-height:10px;`, ref: ref(''), el: el('') },
        {
            id: 'styled-container',
            wrap: W,
            ref: ref(SENTENCE, 50, 'justify-center text-2xl font-bold'),
            el: `<style>.big::part(base){justify-content:center;font-size:1.5rem;line-height:2rem;font-weight:700}</style>${el(SENTENCE, ' class="big"')}`,
        },
    ],
};
