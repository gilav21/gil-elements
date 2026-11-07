import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeChatInput } from './chat-input.js';

async function input(attrs = ''): Promise<{ el: GeChatInput; sent: string[]; field: HTMLTextAreaElement; send: HTMLElement }> {
    const page = await mount(`<div style="width:400px;padding:10px"><ge-chat-input ${attrs}></ge-chat-input></div>`);
    const el = page.querySelector<GeChatInput>('ge-chat-input')!;
    await el.updateComplete;
    const sent: string[] = [];
    el.addEventListener('send', (e) => sent.push((e as CustomEvent<string>).detail));
    const textarea = el.shadowRoot!.querySelector('ge-textarea')!;
    await (textarea as unknown as { updateComplete: Promise<boolean> }).updateComplete;
    return { el, sent, field: textarea.shadowRoot!.querySelector('textarea')!, send: el.shadowRoot!.querySelector('ge-button')! };
}
const sendDisabled = (send: HTMLElement) => send.hasAttribute('disabled');

describe('ge-chat-input', () => {
    it('shows the placeholder, starts with the send button disabled and enables it once there is text', async () => {
        const { field, send, el } = await input();
        expect(field.placeholder).toBe('Type a message...');
        expect(sendDisabled(send)).toBe(true);

        await userEvent.click(field);
        await userEvent.keyboard('hi');
        await el.updateComplete;
        expect(sendDisabled(send)).toBe(false);
    });

    it('sends the text on Enter, clears the box and refuses a blank draft', async () => {
        const { field, sent, el } = await input('placeholder="Ask"');
        expect(field.placeholder).toBe('Ask');
        await userEvent.click(field);
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard('   ');
        await userEvent.keyboard('{Enter}');
        expect(sent).toEqual([]);

        await userEvent.clear(field);
        await userEvent.keyboard('Hello world{Enter}');
        await el.updateComplete;
        expect(sent).toEqual(['Hello world']);
        expect(field.value).toBe('');
    });

    it('keeps Shift+Enter as a new line, in the draft that is later sent', async () => {
        const { field, sent } = await input();
        await userEvent.click(field);
        await userEvent.keyboard('one{Shift>}{Enter}{/Shift}two');
        expect(sent).toEqual([]);
        expect(field.value).toBe('one\ntwo');
        await userEvent.keyboard('{Enter}');
        expect(sent).toEqual(['one\ntwo']);
    });

    it('does not send on the Enter that confirms an IME composition', async () => {
        const { field, sent, el } = await input();
        field.value = '日本';
        field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        await el.updateComplete;
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, composed: true, cancelable: true }));
        expect(sent).toEqual([]);
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
        expect(sent).toEqual(['日本']);
    });

    it('sends from the button click and does nothing when disabled', async () => {
        const { field, sent, send, el } = await input();
        await userEvent.click(field);
        await userEvent.keyboard('via button');
        await el.updateComplete;
        send.shadowRoot!.querySelector('button')!.click();
        expect(sent).toEqual(['via button']);

        el.disabled = true;
        await el.updateComplete;
        field.value = 'again';
        field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        await el.updateComplete;
        field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, composed: true, cancelable: true }));
        expect(sent).toEqual(['via button']);
        expect(sendDisabled(send)).toBe(true);
    });
});
