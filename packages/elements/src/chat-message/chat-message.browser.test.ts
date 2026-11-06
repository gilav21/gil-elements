import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeChatMessage } from './chat-message.js';

const parts = (el: GeChatMessage) => ({
    row: el.shadowRoot!.querySelector<HTMLElement>('.row')!,
    bubble: el.shadowRoot!.querySelector<HTMLElement>('.bubble')!,
    avatar: el.shadowRoot!.querySelector<HTMLElement>('.avatar'),
});

async function message(attrs: string, inner = ''): Promise<GeChatMessage> {
    const page = await mount(`<div style="width:500px"><ge-chat-message ${attrs}>${inner}</ge-chat-message></div>`);
    const el = page.querySelector<GeChatMessage>('ge-chat-message')!;
    await el.updateComplete;
    return el;
}

describe('ge-chat-message', () => {
    it('puts a user message on the end side in the primary colour, with an avatar after the bubble', async () => {
        const el = await message('sender="user" content="Hello there" avatar-fallback="GL"');
        const { row, bubble, avatar } = parts(el);
        const page = el.getBoundingClientRect();

        expect(bubble.textContent!.trim()).toBe('Hello there');
        expect(getComputedStyle(row).justifyContent).toBe('flex-end');
        const probe = document.createElement('div');
        probe.style.background = 'var(--primary)';
        el.parentElement!.append(probe);
        expect(getComputedStyle(bubble).backgroundColor).toBe(getComputedStyle(probe).backgroundColor);
        expect(avatar!.getAttribute('fallback')).toBe('GL');
        expect(bubble.getBoundingClientRect().right).toBeLessThan(avatar!.getBoundingClientRect().left + 1);
        expect(avatar!.getBoundingClientRect().right).toBeGreaterThan(page.right - 40);
    });

    it('puts an assistant message on the start side in a muted, bordered bubble with the avatar first', async () => {
        const el = await message('sender="assistant" content="Hi"');
        const { row, bubble, avatar } = parts(el);

        expect(getComputedStyle(row).justifyContent).toBe('flex-start');
        expect(getComputedStyle(bubble).borderTopWidth).toBe('1px');
        expect(avatar!.getBoundingClientRect().right).toBeLessThanOrEqual(bubble.getBoundingClientRect().left + 1);
    });

    it('falls back to a question mark in the avatar when no fallback or picture is given', async () => {
        const el = await message('sender="assistant" content="Hi"');
        const avatar = parts(el).avatar!;
        await (avatar as unknown as { updateComplete: Promise<boolean> }).updateComplete;
        expect(avatar.shadowRoot!.textContent).toContain('?');
    });

    it('centres a system note without an avatar, small and italic', async () => {
        const el = await message('sender="system" content="Joined the room"');
        const { row, bubble, avatar } = parts(el);

        expect(avatar).toBeNull();
        expect(getComputedStyle(row).justifyContent).toBe('center');
        expect(getComputedStyle(bubble).fontStyle).toBe('italic');
        expect(getComputedStyle(bubble).fontSize).toBe('12px');
        expect(getComputedStyle(bubble).borderTopWidth).toBe('0px');
    });

    it('defaults to a user message and caps a long bubble at 85% of the row on a narrow screen', async () => {
        const el = await message('', '');
        el.content = 'word '.repeat(200);
        await el.updateComplete;
        const { row, bubble } = parts(el);

        expect(el.sender).toBe('user');
        expect(bubble.getBoundingClientRect().width).toBeLessThanOrEqual(row.getBoundingClientRect().width * 0.85 + 1);
        expect(bubble.getBoundingClientRect().width).toBeGreaterThan(row.getBoundingClientRect().width * 0.5);
    });

    it('shows projected content instead of the content attribute, and falls back when the projection is blank', async () => {
        const custom = await message('sender="assistant" content="plain"', '<strong>rich</strong>');
        expect(custom.shadowRoot!.querySelector('.bubble')!.textContent).not.toContain('plain');
        expect(custom.querySelector('strong')!.getBoundingClientRect().width).toBeGreaterThan(0);

        const blank = await message('sender="assistant" content="plain"', '   \n  ');
        expect(parts(blank).bubble.textContent).toContain('plain');

        const text = await message('content="plain"', 'typed words');
        expect(text.shadowRoot!.querySelector('.bubble')!.textContent).not.toContain('plain');
        expect(parts(text).bubble.getBoundingClientRect().width).toBeGreaterThan(0);
    });
});
