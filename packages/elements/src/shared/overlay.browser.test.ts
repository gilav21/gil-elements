import { describe, expect, it } from 'vitest';
import { mount } from '../test-utils.js';
import { deepActive, registerLayer, tabStops, trapTab } from './overlay.js';

const press = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, composed: true, ...init });
    (deepActive() ?? document.body).dispatchEvent(event);
    return event;
};

describe('registerLayer', () => {
    it('sends Escape to the innermost layer only, and releases it before it dismisses', () => {
        const log: string[] = [];
        const outer = { modal: true, dismiss: () => log.push('outer') };
        const inner = { modal: true, dismiss: () => log.push('inner') };
        const offOuter = registerLayer(outer);
        const offInner = registerLayer(inner);

        press('Escape');
        expect(log).toEqual(['inner']);
        press('Escape');
        expect(log).toEqual(['inner', 'outer']);
        press('Escape');
        expect(log).toEqual(['inner', 'outer']);
        offInner();
        offOuter();
    });

    it('keeps the page scroll lock until the last modal closes and then restores the consumer overflow', () => {
        document.body.style.overflowY = 'scroll';
        const a = registerLayer({ modal: true, dismiss: () => undefined });
        const b = registerLayer({ modal: true, dismiss: () => undefined });
        expect(getComputedStyle(document.body).overflowY).toBe('hidden');

        a();
        expect(getComputedStyle(document.body).overflowY).toBe('hidden');
        b();
        expect(document.body.style.overflowY).toBe('scroll');
        expect(document.body.style.overflowX).toBe('');
        document.body.style.overflowY = '';
    });

    it('does not lock the page for a non-modal layer', () => {
        const off = registerLayer({ modal: false, dismiss: () => undefined });
        expect(document.body.style.overflow).toBe('');
        off();
    });

    it('ignores an Escape that was already handled', () => {
        let dismissed = 0;
        const off = registerLayer({ modal: true, dismiss: () => dismissed++ });
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        event.preventDefault();
        document.dispatchEvent(event);
        expect(dismissed).toBe(0);
        off();
    });
});

describe('tab stops and trap', () => {
    const MARKUP = `<div id="panel" tabindex="-1">
        <button id="a">A</button>
        <button id="off" disabled>off</button>
        <button id="skip" tabindex="-1">skip</button>
        <ge-button id="b">B</ge-button>
        <input id="c">
    </div>`;

    it('lists only enabled, non-negative stops in order, through the shadow root of a host', async () => {
        const page = await mount(MARKUP.replace(`<ge-button id="b">B</ge-button>`, `<span id="host"></span>`));
        page.querySelector('#host')!.attachShadow({ mode: 'open' }).innerHTML = '<button id="inner">in</button><slot></slot>';

        expect(tabStops(page.querySelector('#panel')!).map((el) => el.id)).toEqual(['a', 'inner', 'c']);
    });

    it('wraps Tab from the last stop to the first and Shift+Tab from the first to the last', async () => {
        const page = await mount(MARKUP.replace('<ge-button id="b">B</ge-button>', ''));
        const panel = page.querySelector<HTMLElement>('#panel')!;
        const a = page.querySelector<HTMLElement>('#a')!;
        const c = page.querySelector<HTMLElement>('#c')!;

        c.focus();
        const forward = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
        trapTab(forward, panel, panel);
        expect(forward.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(a);

        const backward = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
        trapTab(backward, panel, panel);
        expect(document.activeElement).toBe(c);
    });

    it('leaves Tab alone between stops, and holds focus on the panel when nothing is tabbable', async () => {
        const page = await mount('<div id="p" tabindex="-1"><button id="x">x</button><button id="y">y</button></div><div id="empty" tabindex="-1"><span>text</span></div>');
        const p = page.querySelector<HTMLElement>('#p')!;
        page.querySelector<HTMLElement>('#x')!.focus();
        const middle = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
        trapTab(middle, p, p);
        expect(middle.defaultPrevented).toBe(false);

        const empty = page.querySelector<HTMLElement>('#empty')!;
        const stuck = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
        trapTab(stuck, empty, empty);
        expect(stuck.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(empty);
    });

    it('pulls focus that sits outside the container back to its first stop', async () => {
        const page = await mount('<button id="out">out</button><div id="p"><button id="first">1</button><button id="last">2</button></div>');
        page.querySelector<HTMLElement>('#out')!.focus();
        const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true });
        trapTab(event, page.querySelector('#p')!, page.querySelector('#p')!);
        expect(document.activeElement).toBe(page.querySelector('#first'));
    });
});
