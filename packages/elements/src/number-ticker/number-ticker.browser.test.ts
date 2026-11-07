import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeNumberTicker } from './number-ticker.js';

afterEach(() => {
    vi.restoreAllMocks();
});

const digits = (el: Element) => Array.from(el.shadowRoot!.querySelectorAll('ge-number-ticker-digit')).map((d) => (d as HTMLElement).getAttribute('digit'));
const text = (el: Element) => digits(el).join('');
const ticker = async (attrs: string) => {
    const page = await mount(`<ge-number-ticker ${attrs}></ge-number-ticker>`);
    const el = page.firstElementChild as GeNumberTicker;
    await el.updateComplete;
    return el;
};
const reduced = () => vi.spyOn(globalThis, 'matchMedia').mockImplementation((q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false }) as MediaQueryList);

describe('ge-number-ticker', () => {
    it('counts up from 0 to the value, grouped by the locale, and settles on exactly the value', async () => {
        const el = await ticker('value="12345" duration="0.2"');
        await expect.poll(() => text(el), { timeout: 3000 }).toBe('12,345');
        expect(el.getAttribute('dir')).toBe('ltr');
    });

    it('keeps the decimals it was told to, and groups by the locale given', async () => {
        const el = await ticker('value="1234.5" decimal-places="2" locale="de" duration="0.1"');
        await expect.poll(() => text(el), { timeout: 3000 }).toBe('1.234,50');
    });

    it('chases a new value from what is on screen', async () => {
        const el = await ticker('value="100" duration="0.1"');
        await expect.poll(() => text(el)).toBe('100');
        el.value = 40;
        await expect.poll(() => text(el)).toBe('40');
    });

    it('waits for the delay before moving', async () => {
        const el = await ticker('value="50" delay="0.4" duration="0.1"');
        await new Promise((r) => setTimeout(r, 150));
        expect(text(el)).toBe('0');
        await expect.poll(() => text(el), { timeout: 3000 }).toBe('50');
    });

    it('snaps to the value under reduced motion', async () => {
        reduced();
        const el = await ticker('value="987" duration="5"');
        await expect.poll(() => text(el)).toBe('987');
    });

    it('rolls a digit that changes to another digit and swaps a separator at once', async () => {
        const el = await ticker('value="9" duration="0.05"');
        await expect.poll(() => text(el)).toBe('9');
        const digit = el.shadowRoot!.querySelector('ge-number-ticker-digit') as HTMLElement;
        const roll = [] as Animation[];
        const original = Element.prototype.animate;
        vi.spyOn(Element.prototype, 'animate').mockImplementation(function (this: Element, ...args: Parameters<Element['animate']>) {
            const a = original.apply(this, args);
            roll.push(a);
            return a;
        });
        el.value = 8;
        await expect.poll(() => text(el)).toBe('8');
        await expect.poll(() => roll.length).toBeGreaterThan(0);
        expect(digit.shadowRoot!.querySelectorAll('.cell').length).toBe(2);
        el.value = 1000;
        await expect.poll(() => text(el), { timeout: 3000 }).toBe('1,000');
        const comma = Array.from(el.shadowRoot!.querySelectorAll('ge-number-ticker-digit')).find((d) => d.getAttribute('digit') === ',')!;
        expect(comma.shadowRoot!.querySelectorAll('.cell').length).toBe(1);
    });

    it('starts a new count from what is showing, not from zero', async () => {
        const el = await ticker('value="100" duration="0.05"');
        await expect.poll(() => text(el)).toBe('100');
        el.duration = 5;
        el.value = 90;
        await el.updateComplete;
        await new Promise((r) => setTimeout(r, 120));
        expect(Number(text(el))).toBeGreaterThanOrEqual(90);
    });

    it('swaps a digit that becomes a separator at once, with no roll', async () => {
        const el = await ticker('value="0"');
        const digit = el.shadowRoot!.querySelector('ge-number-ticker-digit') as HTMLElement;
        digit.setAttribute('digit', '5');
        await (digit as unknown as { updateComplete: Promise<boolean> }).updateComplete;
        const animate = vi.spyOn(HTMLElement.prototype, 'animate');
        digit.setAttribute('digit', '.');
        await (digit as unknown as { updateComplete: Promise<boolean> }).updateComplete;
        expect(animate).not.toHaveBeenCalled();
        expect(digit.shadowRoot!.querySelectorAll('.cell')).toHaveLength(1);
    });
});
