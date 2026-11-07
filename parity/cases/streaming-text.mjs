// shadcn-angular streaming-text.component.html: a whitespace-pre-wrap span of the typed text, then, only while typing and when showCursor
// is on, an animate-pulse bold `|`. The interval cannot be frozen: a speed of a millisecond is "fully typed", a speed of a hundred
// thousand seconds is "nothing typed yet, still typing".
const CURSOR = '<span class="animate-pulse font-bold ms-0.5">|</span>';
const ref = (text, { typing = false, cursor = true, cls = '' } = {}) => `<ui-streaming-text><span class="whitespace-pre-wrap ${cls}" data-slot="streaming-text">${text}</span>${cursor && typing ? CURSOR : ''}</ui-streaming-text>`;
const el = (text, attrs = '') => `<ge-streaming-text speed="1"${attrs} data-props='${JSON.stringify({ text })}'></ge-streaming-text>`;
const stuck = (text, attrs = '') => `<ge-streaming-text speed="100000000"${attrs} data-props='${JSON.stringify({ text })}'></ge-streaming-text>`;
const W = 'width:320px;font-size:16px;';
const REPLY = 'Streaming text types itself out.';
export default {
    name: 'streaming-text',
    items: [
        { id: 'typed', wrap: W, at: 1200, ref: ref(REPLY), el: el(REPLY) },
        { id: 'typing-nothing-yet', wrap: W, ref: ref('', { typing: true }), el: stuck(REPLY) },
        { id: 'typing-no-cursor', wrap: W, ref: ref('', { typing: true, cursor: false }), el: stuck(REPLY, ' show-cursor="false"') },
        { id: 'typed-no-cursor', wrap: W, at: 1200, ref: ref(REPLY, { cursor: false }), el: el(REPLY, ' show-cursor="false"') },
        { id: 'newlines-and-spaces', wrap: W, at: 1200, ref: ref('Line one\n   indented line\n\nafter a gap'), el: el('Line one\n   indented line\n\nafter a gap') },
        { id: 'wraps', wrap: 'width:160px;font-size:16px;', at: 1200, ref: ref(REPLY), el: el(REPLY) },
        { id: 'empty', wrap: `${W}outline:1px dashed var(--border);min-height:10px;`, at: 1200, ref: ref(''), el: el('') },
        { id: 'inline-in-text', wrap: W, at: 1200, ref: `Reply: ${ref('ok')} done`, el: `Reply: ${el('ok')} done` },
    ],
};
