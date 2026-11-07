import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeColorPicker } from './index.js';

const settle = async (el: GeColorPicker) => {
    for (let round = 0; round < 3; round++) {
        await el.updateComplete;
        for (const child of el.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await child.updateComplete;
    }
};
const picker = async (attrs = 'inline value="#3366cc"') => {
    const page = await mount(`<ge-color-picker ${attrs}></ge-color-picker>`);
    const el = page.querySelector<GeColorPicker>('ge-color-picker')!;
    await settle(el);
    return el;
};
const q = <T extends HTMLElement = HTMLElement>(el: GeColorPicker, selector: string) => el.shadowRoot!.querySelector<T>(selector)!;
const all = <T extends HTMLElement = HTMLElement>(el: GeColorPicker, selector: string) => [...el.shadowRoot!.querySelectorAll<T>(selector)];
const changes = (el: GeColorPicker) => {
    const log: string[] = [];
    el.addEventListener('color-change', (event) => log.push((event as CustomEvent<string>).detail));
    return log;
};
/** Types into a `ge-input` the way the browser reports it: on the inner field, as a composed `input` event. */
const type = async (el: GeColorPicker, field: HTMLElement, text: string) => {
    const inner = field.shadowRoot!.querySelector('input')!;
    inner.value = text;
    inner.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await settle(el);
};
const slide = async (el: GeColorPicker, input: HTMLInputElement, value: number) => {
    input.value = String(value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle(el);
};
const tab = async (el: GeColorPicker, format: string) => {
    q(el, `ge-tabs-trigger[value=${format}]`).shadowRoot!.querySelector('button')!.click();
    await settle(el);
};
const pointAt = (el: GeColorPicker, fx: number, fy: number) => {
    const area = q(el, '.area');
    const rect = area.getBoundingClientRect();
    area.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: rect.left + rect.width * fx, clientY: rect.top + rect.height * fy }));
    window.dispatchEvent(new MouseEvent('mouseup'));
};

afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
});

describe('ge-color-picker', () => {
    it('opens from its trigger showing the colour as hex, and a colour set from outside never fires color-change', async () => {
        const el = await picker('value="#3366cc"');
        const log = changes(el);
        expect(q(el, '.trigger-text').textContent).toBe('#3366cc');
        expect(el.shadowRoot!.querySelector('.panel')).toBeNull();

        q(el, '.trigger').click();
        await settle(el);
        expect(q(el, '.area').getAttribute('aria-valuetext')).toBe('S 75%, V 80%');

        el.value = 'rgb(255, 0, 0)';
        await settle(el);
        expect([q(el, '.trigger-text').textContent, el.value, log]).toEqual(['#ff0000', '#ff0000', []]);
    });

    it('moves saturation and value with the pointer and the keyboard, clamped, and reports each new colour once', async () => {
        const el = await picker('inline value="#ff0000"');
        const log = changes(el);

        pointAt(el, 0, 0);
        await settle(el);
        expect(el.value).toBe('#ffffff');
        pointAt(el, 1, 1);
        await settle(el);
        expect(el.value).toBe('#000000');

        pointAt(el, 1, 0);
        await settle(el);
        q(el, '.area').focus();
        await userEvent.keyboard('{ArrowLeft}');
        await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}');
        await userEvent.keyboard('{ArrowDown}');
        await userEvent.keyboard('{PageDown}');
        await settle(el);
        expect(q(el, '.area').getAttribute('aria-valuetext')).toBe('S 89%, V 89%');
        await userEvent.keyboard('{Home}');
        await userEvent.keyboard('{PageUp}');
        await userEvent.keyboard('{PageUp}');
        await settle(el);
        expect(q(el, '.area').getAttribute('aria-valuetext')).toBe('S 0%, V 100%');
        expect(log.at(-1)).toBe('#ffffff');
        // The same position twice is one report: the hex did not change.
        const before = log.length;
        pointAt(el, 0, 0);
        await settle(el);
        expect(log.length).toBe(before);
    });

    it('keeps the hue through greys, takes the hue slider, and writes alpha into the hex only when asked', async () => {
        const el = await picker('inline value="#ff0000" alpha');
        await slide(el, q<HTMLInputElement>(el, 'input[aria-label=Hue]'), 120);
        expect(el.value).toBe('#00ff00');
        pointAt(el, 0, 0.5);
        await settle(el);
        expect(el.value).toBe('#808080');
        expect(q<HTMLInputElement>(el, 'input[aria-label=Hue]').value).toBe('120');

        await slide(el, q<HTMLInputElement>(el, 'input[aria-label=Alpha]'), 50);
        expect(el.value).toBe('#80808080');
        // A grey set from outside keeps the hue too: HSV has none to give back.
        el.value = '#404040';
        await settle(el);
        expect(q<HTMLInputElement>(el, 'input[aria-label=Hue]').value).toBe('120');

        const plain = await picker('inline value="#ff000080"');
        expect(plain.value).toBe('#ff0000');
        const clear = await picker('inline value="transparent"');
        expect(clear.value).toBe('#00000000');
    });

    it('edits through the format tabs: any CSS colour in the hex field, clamped channels, and ignores half-typed values', async () => {
        const el = await picker('inline value="#3366cc" formats="hex rgb hsl oklch"');
        const log = changes(el);

        await type(el, q(el, '.format-content ge-input'), 'rgb(10, 20, 30)');
        expect([el.value, log]).toEqual(['#0a141e', ['#0a141e']]);
        await type(el, q(el, '.format-content ge-input'), '#12');
        expect(el.value).toBe('#0a141e');

        await tab(el, 'rgb');
        await type(el, q(el, 'ge-input[aria-label=Red]'), '300');
        expect(el.value).toBe('#ff141e');
        expect([q(el, '.value').textContent, q(el, 'ge-input[aria-label=Red]').value]).toEqual(['rgb(255, 20, 30)', '255']);

        await tab(el, 'hsl');
        await type(el, q(el, 'ge-input[aria-label=Lightness]'), '150');
        expect(el.value).toBe('#ffffff');
        await type(el, q(el, 'ge-input[aria-label=Lightness]'), '50');
        await type(el, q(el, 'ge-input[aria-label=Saturation]'), '100');
        await type(el, q(el, 'ge-input[aria-label=Hue]'), '240');
        expect([el.value, q(el, '.value').textContent]).toEqual(['#0000ff', 'hsl(240, 100%, 50%)']);

        await tab(el, 'oklch');
        expect(q(el, '.value').textContent).toBe('oklch(45.2% 0.313 264.1)');
        expect(log.at(-1)).toBe('#0000ff');
    });

    it('copies the colour in the format being shown and marks the button until it is done', async () => {
        const written: string[] = [];
        vi.stubGlobal('navigator', { clipboard: { writeText: async (text: string) => void written.push(text) } });
        const el = await picker('inline value="#3366cc"');

        q(el, '.copy').click();
        await settle(el);
        expect(written).toEqual(['#3366cc']);
        expect(q(el, '.copy path').getAttribute('d')).toBe('m4 12.5 5 5L20 6.5');
        await expect.poll(() => q(el, '.copy rect'), { timeout: 3000 }).not.toBeNull();
    });

    it('records swatch picks as recents, newest first without case-insensitive duplicates and capped, and keeps them under a storage key', async () => {
        const el = await picker('inline value="#000000" max-recent="3" storage-key="demo" presets=\'["#FF0000","#00ff00","#0000ff","#ffff00"]\'');
        for (const hex of ['#FF0000', '#00ff00', '#0000ff', '#ffff00', '#ff0000']) {
            q(el, `.swatch[aria-label="Select ${hex.toLowerCase() === '#ff0000' ? '#FF0000' : hex}"]`).click();
            await settle(el);
        }
        const recents = () => all(el, '[aria-label="Recent colors"] .swatch').map((b) => b.getAttribute('aria-label'));
        expect(recents()).toEqual(['Apply recent #ff0000', 'Apply recent #ffff00', 'Apply recent #0000ff']);
        expect(JSON.parse(localStorage.getItem('ge-color-picker:demo')!)).toEqual(['#ff0000', '#ffff00', '#0000ff']);

        const reloaded = await picker('inline max-recent="3" storage-key="demo"');
        expect(all(reloaded, '[aria-label="Recent colors"] .swatch')).toHaveLength(3);
    });

    it('leaves recents to the page while it supplies them, and hides the row on request', async () => {
        const el = await picker('inline presets=\'["#ff0000"]\'');
        el.recentColors = ['#00ff00'];
        const next: string[][] = [];
        el.addEventListener('recent-colors-change', (event) => next.push((event as CustomEvent<string[]>).detail));
        await settle(el);

        q(el, '.swatch[aria-label="Select #ff0000"]').click();
        await settle(el);
        expect(next).toEqual([['#ff0000', '#00ff00']]);
        expect(all(el, '[aria-label="Recent colors"] .swatch')).toHaveLength(1);

        const hidden = await picker('inline show-recent="false" storage-key="off" presets=\'["#ff0000"]\'');
        q(hidden, '.swatch').click();
        await settle(hidden);
        expect([hidden.shadowRoot!.querySelector('[aria-label="Recent colors"]'), localStorage.getItem('ge-color-picker:off')]).toEqual([null, null]);
    });

    it('offers harmonies of the colour, and copying one marks it without picking it', async () => {
        const written: string[] = [];
        vi.stubGlobal('navigator', { clipboard: { writeText: async (text: string) => void written.push(text) } });
        const el = await picker('inline value="#ff0000" show-harmonies');
        const groups = Object.fromEntries(all(el, '.harmony').map((row) => [row.querySelector('.harmony-label')!.textContent, [...row.querySelectorAll('.harmony-swatch')].map((s) => s.getAttribute('aria-label')!.slice(5))]));
        expect(groups).toEqual({
            Readable: ['#000000', '#ffffff'],
            Opposite: ['#ff0000', '#00ffff'],
            Neighbors: ['#ff0080', '#ff0000', '#ff8000'],
            Trio: ['#ff0000', '#00ff00', '#0000ff'],
            Quartet: ['#ff0000', '#80ff00', '#00ffff', '#7f00ff'],
        });

        q(el, '.harmony-swatch[aria-label="Copy #00ffff"]').click();
        await settle(el);
        expect(written).toEqual(['#00ffff']);
        expect(el.value).toBe('#ff0000');
        // Only the rows that hold the copied colour (Opposite and Quartet) show the badge.
        expect(all(el, '.harmony').filter((row) => row.querySelector('.copied-badge')).map((row) => row.querySelector('.harmony-label')!.textContent)).toEqual(['Opposite', 'Quartet']);
    });

    it('rates the colour against a background with its WCAG level, and edits the background through slot B', async () => {
        const el = await picker('inline value="#000000" show-contrast');
        expect([q(el, '.ratio').textContent, q(el, '.badge').textContent]).toEqual(['21.00:1', 'AAA']);

        pointAt(el, 0, 0.5);
        await settle(el);
        await slide(el, q<HTMLInputElement>(el, 'input[aria-label=Hue]'), 0);
        const grey = el.value;
        expect(grey).toBe('#808080');
        expect([q(el, '.ratio').textContent, q(el, '.badge').textContent]).toEqual(['3.95:1', 'AA Large']);

        q(el, 'button[aria-label^="Edit color B"]').click();
        await settle(el);
        expect(el.value).toBe('#ffffff');
        await type(el, q(el, '.format-content ge-input'), '#777777');
        expect([q(el, '.ratio').textContent, q(el, '.badge').textContent]).toEqual(['1.13:1', 'Fail']);
        expect(q(el, '.slot.active .slot-hex').textContent).toBe('#777777');
    });

    it('applies a colour sampled by the eyedropper like a swatch, and does nothing while disabled', async () => {
        const el = await picker('inline value="#000000"');
        q(el, 'ge-eyedropper').dispatchEvent(new CustomEvent('color-pick', { detail: '#123456', bubbles: true, composed: true }));
        await settle(el);
        expect([el.value, all(el, '[aria-label="Recent colors"] .swatch').length]).toEqual(['#123456', 1]);

        el.disabled = true;
        await settle(el);
        pointAt(el, 0, 0);
        q(el, '.area').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        await settle(el);
        expect(el.value).toBe('#123456');
    });

    it('closes its popover when it becomes disabled', async () => {
        const el = await picker('value="#3366cc"');
        q(el, '.trigger').click();
        await settle(el);
        expect(el.shadowRoot!.querySelector('.panel')).not.toBeNull();
        el.disabled = true;
        await settle(el);
        expect(el.shadowRoot!.querySelector('.panel')).toBeNull();
    });

    it('turns an image file into a palette, selects its first colour and clears it on request', async () => {
        const el = await picker('inline value="#000000" enable-image-pick');
        const canvas = document.createElement('canvas');
        canvas.width = 40;
        canvas.height = 40;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#e03030';
        ctx.fillRect(0, 0, 30, 40);
        ctx.fillStyle = '#3050e0';
        ctx.fillRect(30, 0, 10, 40);
        const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
        const transfer = new DataTransfer();
        transfer.items.add(new File([blob], 'swatch.png', { type: 'image/png' }));
        const input = q<HTMLInputElement>(el, '.file');
        input.files = transfer.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));

        await expect.poll(() => all(el, '[aria-label="Extracted palette"] .swatch').length).toBe(2);
        expect(el.value).toBe('#e03030');
        expect(all(el, '[aria-label="Extracted palette"] .swatch').map((b) => b.getAttribute('aria-label'))).toEqual(['Apply extracted #e03030', 'Apply extracted #3050e0']);
        expect(input.value).toBe('');

        q(el, '.clear').click();
        await settle(el);
        expect(el.shadowRoot!.querySelector('[aria-label="Extracted palette"]')).toBeNull();
        expect(el.value).toBe('#e03030');
    });

    it('submits its hex with a form, goes back to the markup colour on reset, and is blocked by a disabled fieldset', async () => {
        const page = await mount('<form><fieldset><ge-color-picker name="brand" inline value="#3366cc"></ge-color-picker></fieldset></form>');
        const el = page.querySelector<GeColorPicker>('ge-color-picker')!;
        await settle(el);
        const form = page.querySelector('form')!;

        pointAt(el, 0, 0);
        await settle(el);
        expect(new FormData(form).get('brand')).toBe('#ffffff');
        form.reset();
        await settle(el);
        expect(new FormData(form).get('brand')).toBe('#3366cc');

        page.querySelector('fieldset')!.disabled = true;
        await settle(el);
        expect(q(el, '.panel').hasAttribute('inert')).toBe(true);
    });

    it('opens in a popover from a custom trigger and closes with Escape', async () => {
        const page = await mount('<ge-color-picker value="#3366cc"><button slot="trigger" id="mine" type="button">Brand</button></ge-color-picker>');
        const el = page.querySelector<GeColorPicker>('ge-color-picker')!;
        await settle(el);
        expect(q<HTMLSlotElement>(el, 'slot[name=trigger]').assignedElements()).toHaveLength(1);

        page.querySelector<HTMLElement>('#mine')!.click();
        await settle(el);
        expect(el.shadowRoot!.querySelector('.panel')).not.toBeNull();
        await userEvent.keyboard('{Escape}');
        await settle(el);
        expect(el.shadowRoot!.querySelector('.panel')).toBeNull();
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no accessibility violations with everything on', async () => {
            // The passing WCAG badge (white on green-500, 2.3:1) is shadcn-angular's own colour pair and fails contrast there too; a failing colour shows the other badge.
            const el = await picker('inline value="#cccccc" alpha show-harmonies show-contrast enable-image-pick presets=\'["#ff0000","#00ff00"]\' formats="hex rgb hsl oklch"');
            const { violations } = await axe.run(el);
            expect(violations.map((v) => v.id)).toEqual([]);
        });
    });
});
