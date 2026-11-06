// shadcn-angular typing-animation.component.html + .css: an inline wrapper with an sr-only span of every phrase, an aria-hidden span of the
// typed text and a 2px caret (blinking only while the run is idle). Timers cannot be frozen, so each element case is put in a still state:
// a type-speed of a millisecond with a pause of a hundred thousand seconds is "fully typed and idle"; a type-speed of a hundred
// thousand seconds is "first character only, mid-typing" (the first character is typed at once).
const STYLE = '<style>.cursor-blink{animation:cursor-blink 0.8s step-end infinite}@keyframes cursor-blink{0%,100%{opacity:1}50%{opacity:0}}</style>';
const CARET = (blink) => `<span aria-hidden="true" class="inline-block w-[2px] h-[1em] bg-current ms-0.5 align-text-bottom ${blink ? 'cursor-blink' : ''}"></span>`;
const ref = (strings, shown, { blink = false, cursor = true, cls = '' } = {}) =>
    `${STYLE}<ui-typing-animation class="contents"><span class="inline ${cls}" data-slot="typing-animation"><span class="sr-only">${strings.join(', ')}</span><span aria-hidden="true">${shown}</span>${cursor ? CARET(blink) : ''}</span></ui-typing-animation>`;
const el = (strings, attrs) => `<ge-typing-animation ${attrs} data-props='${JSON.stringify({ strings })}'></ge-typing-animation>`;
const IDLE = 'type-speed="1" pause-duration="100000000"';
const FIRST = 'type-speed="100000000"';
const W = 'font-size:24px;font-weight:600;width:360px;';
const S = ['Build faster', 'Ship sooner'];
export default {
    name: 'typing-animation',
    items: [
        { id: 'typed-idle-caret', wrap: W, ref: ref(S, S[0], { blink: true }), el: el(S, IDLE) },
        { id: 'first-character-solid-caret', wrap: W, ref: ref(S, 'B'), el: el(S, FIRST) },
        { id: 'typed-no-cursor', wrap: W, ref: ref(S, S[0], { blink: true, cursor: false }), el: el(S, `${IDLE} cursor="false"`) },
        { id: 'single-phrase', wrap: W, ref: ref(['Only one'], 'Only one', { blink: true }), el: el(['Only one'], IDLE) },
        { id: 'no-phrases', wrap: W, ref: ref([], ''), el: el([], '') },
        { id: 'inline-in-text', wrap: 'font-size:18px;width:360px;', ref: `We make ${ref(['tools'], 'tools', { blink: true })} for teams.`, el: `We make ${el(['tools'], IDLE)} for teams.` },
    ],
};
