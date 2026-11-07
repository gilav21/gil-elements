import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import '../chat-message/define.js';
import { mount } from '../test-utils.js';
import type { GeChatList } from './chat-list.js';

const viewport = (el: GeChatList) => el.shadowRoot!.querySelector('ge-scroll-area')!.shadowRoot!.querySelector<HTMLElement>('[part="viewport"]')!;
const msg = (n: number) => `<ge-chat-message sender="${n % 2 ? 'assistant' : 'user'}" content="Message number ${n}"></ge-chat-message>`;

async function list(attrs: string, count: number): Promise<GeChatList> {
    const page = await mount(`<div style="height:200px;display:flex"><ge-chat-list ${attrs}>${Array.from({ length: count }, (_, i) => msg(i)).join('')}</ge-chat-list></div>`);
    const el = page.querySelector<GeChatList>('ge-chat-list')!;
    await el.updateComplete;
    return el;
}
const atBottom = (v: HTMLElement) => Math.abs(v.scrollHeight - v.clientHeight - v.scrollTop) < 2;

describe('ge-chat-list', () => {
    it('fills its flex parent, scrolls its messages inside, and leaves them where they are without auto-scroll', async () => {
        const el = await list('', 12);
        const v = viewport(el);
        await new Promise((r) => setTimeout(r, 50));

        expect(el.getBoundingClientRect().height).toBe(200);
        expect(v.scrollHeight).toBeGreaterThan(v.clientHeight + 100);
        expect(v.scrollTop).toBe(0);

        el.scrollToBottom();
        await new Promise((r) => requestAnimationFrame(() => r(null)));
        expect(atBottom(v)).toBe(true);
    });

    it('follows new messages to the bottom while auto-scroll is on, and stops when it is turned off', async () => {
        const el = await list('auto-scroll', 12);
        const v = viewport(el);
        await new Promise((r) => setTimeout(r, 50));
        expect(atBottom(v)).toBe(true);

        el.insertAdjacentHTML('beforeend', msg(99));
        await new Promise((r) => setTimeout(r, 50));
        expect(atBottom(v)).toBe(true);
        expect(v.scrollTop).toBeGreaterThan(0);

        el.autoScroll = false;
        await el.updateComplete;
        v.scrollTop = 0;
        el.insertAdjacentHTML('beforeend', msg(100));
        await new Promise((r) => setTimeout(r, 50));
        expect(v.scrollTop).toBe(0);
    });

    it('follows text that grows inside an existing message', async () => {
        const el = await list('auto-scroll', 12);
        const v = viewport(el);
        await new Promise((r) => setTimeout(r, 50));
        const last = el.lastElementChild!;
        last.innerHTML = '<span>streamed</span>';
        const span = last.firstElementChild!;
        await new Promise((r) => setTimeout(r, 50));
        (span.firstChild as Text).data = 'streamed '.repeat(300);
        await new Promise((r) => setTimeout(r, 80));
        expect(atBottom(v)).toBe(true);
    });
});
