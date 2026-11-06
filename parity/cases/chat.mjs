// shadcn-angular chat.component.ts (ui-chat-message, rootClasses / bubbleClasses), sub/chat-list.component.ts and
// sub/chat-input.component.ts. `role` is `sender` here (an attribute named role is an ARIA role).
import { ref as buttonRef } from '../lib/button-ref.mjs';
const IMG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#6366f1"/><circle cx="40" cy="32" r="14" fill="#fff"/></svg>');
const AV = 'relative flex shrink-0 overflow-hidden rounded-full h-8 w-8';
const FB = 'flex h-full w-full items-center justify-center rounded-full bg-muted';
const ROOT = { user: 'flex w-full gap-3 mb-4 justify-end ps-8 [&>[data-slot=avatar]]:order-last', assistant: 'flex w-full gap-3 mb-4 justify-start pe-8', system: 'flex w-full gap-3 justify-center px-4 mb-2' };
const BUBBLE = {
    user: 'relative rounded-lg px-4 py-2 text-sm max-w-[85%] sm:max-w-[75%] md:max-w-[65%] bg-primary text-primary-foreground',
    assistant: 'relative rounded-lg px-4 py-2 text-sm max-w-[85%] sm:max-w-[75%] md:max-w-[65%] bg-muted border',
    system: 'relative rounded-lg px-4 py-2 max-w-[85%] sm:max-w-[75%] md:max-w-[65%] bg-transparent text-xs text-muted-foreground text-center italic',
};
const avatar = (src, fb) => `<div data-slot="avatar" class="${AV}">${src ? `<img src="${src}" alt="" class="aspect-square h-full w-full" data-slot="avatar-image">` : `<div class="${FB}" data-slot="avatar-fallback">${fb}</div>`}</div>`;
const msgRef = (sender, body, { src = '', fb = '?', projected = false } = {}) =>
    `<ui-chat-message class="contents"><div class="${ROOT[sender]}" data-slot="chat-message">${sender === 'system' ? '' : avatar(src, fb)}<div class="${BUBBLE[sender]}" data-slot="chat-bubble"><span class="${projected ? '' : 'hidden'}">${projected ? body : ''}</span>${projected ? '' : `<span>${body}</span>`}</div></div></ui-chat-message>`;
const msgEl = (sender, body, { src = '', fb = '', projected = false } = {}) =>
    `<ge-chat-message sender="${sender}"${src ? ` avatar-src="${src}"` : ''}${fb ? ` avatar-fallback="${fb}"` : ''}${projected ? `>${body}</ge-chat-message>` : ` content="${body}"></ge-chat-message>`}`;
const LONG = 'This is a much longer reply that has to wrap across several lines of the bubble because it is wider than the allowed share of the row, so the maximum width decides where it breaks.';
const W = 'width:420px;';

const TEXTAREA = 'flex w-full border-input text-base placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-ring min-h-[44px] resize-none bg-background pe-12 py-3 rounded-lg border focus-visible:ring-offset-0';
const ARROW = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>';
const inputRef = (value, { placeholder = 'Type a message...', disabled = false } = {}) =>
    `<ui-chat-input class="contents"><div class="relative flex items-center" data-slot="chat-input"><ui-textarea class="contents"><textarea class="${TEXTAREA}" placeholder="${placeholder}" rows="1" data-slot="textarea">${value}</textarea></ui-textarea>${buttonRef('default', 'icon', ARROW, { extra: 'absolute end-2 bottom-2 h-8 w-8', disabled: !value || disabled })}</div></ui-chat-input>`;
const inputEl = (value, { placeholder = '', disabled = false } = {}) =>
    `<ge-chat-input${placeholder ? ` placeholder="${placeholder}"` : ''}${disabled ? ' disabled' : ''} data-props='${JSON.stringify({ draft: value })}'></ge-chat-input>`;

const SCROLL_VIEWPORT = 'size-full rounded-[inherit] overflow-auto scrollbar-none focus-visible:ring-ring/50 transition-[color,box-shadow] outline-none focus-visible:ring-[3px]';
const listRef = (inner) => `<ui-chat-list class="flex flex-col flex-1 overflow-hidden"><ui-scroll-area class="h-full w-full"><div class="relative overflow-hidden h-full w-full" data-slot="chat-list"><div class="${SCROLL_VIEWPORT}" data-slot="scroll-area-viewport" tabindex="0"><div class="p-4 flex flex-col">${inner}</div></div></div></ui-scroll-area></ui-chat-list>`;
const FRAME = 'display:flex;height:260px;width:420px;border:1px solid var(--border);border-radius:var(--radius);';

export default {
    name: 'chat',
    items: [
        { id: 'message-user', wrap: W, ref: msgRef('user', 'Hello there', { fb: 'GL' }), el: msgEl('user', 'Hello there', { fb: 'GL' }) },
        { id: 'message-assistant', wrap: W, ref: msgRef('assistant', 'Hi! How can I help?'), el: msgEl('assistant', 'Hi! How can I help?') },
        { id: 'message-system', wrap: W, ref: msgRef('system', 'Joined the room'), el: msgEl('system', 'Joined the room') },
        { id: 'message-picture', wrap: W, ref: msgRef('assistant', 'With a picture', { src: IMG }), el: msgEl('assistant', 'With a picture', { src: IMG }) },
        { id: 'message-long-user', wrap: W, ref: msgRef('user', LONG, { fb: 'ME' }), el: msgEl('user', LONG, { fb: 'ME' }) },
        { id: 'message-long-assistant', wrap: W, ref: msgRef('assistant', LONG, { fb: 'AI' }), el: msgEl('assistant', LONG, { fb: 'AI' }) },
        { id: 'message-projected', wrap: W, ref: msgRef('assistant', '<strong>Bold</strong> reply', { projected: true, fb: 'AI' }), el: msgEl('assistant', '<strong>Bold</strong> reply', { projected: true, fb: 'AI' }) },
        { id: 'input-empty', wrap: W, ref: inputRef(''), el: inputEl('') },
        { id: 'input-text', wrap: W, ref: inputRef('Hello'), el: inputEl('Hello') },
        { id: 'input-placeholder', wrap: W, ref: inputRef('', { placeholder: 'Ask anything' }), el: inputEl('', { placeholder: 'Ask anything' }) },
        { id: 'input-disabled', wrap: W, ref: inputRef('Hello', { disabled: true }), el: inputEl('Hello', { disabled: true }) },
        {
            id: 'list-short', wrap: FRAME,
            ref: listRef(msgRef('user', 'Hello', { fb: 'ME' }) + msgRef('assistant', 'Hi there', { fb: 'AI' })),
            el: `<ge-chat-list>${msgEl('user', 'Hello', { fb: 'ME' })}${msgEl('assistant', 'Hi there', { fb: 'AI' })}</ge-chat-list>`,
        },
    ],
};
