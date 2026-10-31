import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';

const box = (button: Element) => button.shadowRoot!.querySelector('button')!;
const corners = (el: Element) => {
    const s = getComputedStyle(el);
    return [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map((r) => r !== '0px');
};

describe('ge-button-group', () => {
    it('keeps only the outer corners round and merges the borders between neighbours', async () => {
        const page = await mount(`
            <ge-button-group><ge-button variant="outline">A</ge-button><ge-button variant="outline">B</ge-button><ge-button variant="outline">C</ge-button></ge-button-group>`);
        const [a, b, c] = [...page.querySelectorAll('ge-button')].map(box);

        // [top-left, top-right, bottom-right, bottom-left] are round
        expect(corners(a)).toEqual([true, false, false, true]);
        expect(corners(b)).toEqual([false, false, false, false]);
        expect(corners(c)).toEqual([false, true, true, false]);
        expect([a, b, c].map((el) => getComputedStyle(el).borderLeftWidth)).toEqual(['1px', '0px', '0px']);
        expect(b.getBoundingClientRect().left).toBe(a.getBoundingClientRect().right);
    });

    it('does the same along the block axis when vertical, and mirrors in right-to-left', async () => {
        const page = await mount(`
            <ge-button-group orientation="vertical"><ge-button variant="outline">A</ge-button><ge-button variant="outline">B</ge-button></ge-button-group>
            <div dir="rtl"><ge-button-group><ge-button variant="outline">A</ge-button><ge-button variant="outline">B</ge-button></ge-button-group></div>`);
        const [va, vb, ra, rb] = [...page.querySelectorAll('ge-button')].map(box);

        expect(corners(va)).toEqual([true, true, false, false]);
        expect(corners(vb)).toEqual([false, false, true, true]);
        expect(getComputedStyle(vb).borderTopWidth).toBe('0px');
        expect(getComputedStyle(vb).borderLeftWidth).toBe('1px');
        // the first item is on the right in RTL, so its right corners are the round ones
        expect(corners(ra)).toEqual([false, true, true, false]);
        expect(corners(rb)).toEqual([true, false, false, true]);
    });

    it('lays out text and separator items between buttons', async () => {
        const page = await mount(`
            <ge-button-group><ge-button-group-text>USD</ge-button-group-text><ge-button variant="outline">Pay</ge-button><ge-button-group-separator></ge-button-group-separator><ge-button variant="outline">Cancel</ge-button><ge-button-group-text>.00</ge-button-group-text></ge-button-group>`);
        const separator = page.querySelector('ge-button-group-separator')!.shadowRoot!.querySelector('.separator')!.getBoundingClientRect();
        const [text, suffix] = [...page.querySelectorAll('ge-button-group-text')].map((t) => t.shadowRoot!.querySelector('.text')!);
        const [pay, cancel] = [...page.querySelectorAll('ge-button')].map(box);

        expect(corners(text)).toEqual([true, false, false, true]);
        expect(corners(pay)).toEqual([false, false, false, false]);
        expect(corners(cancel)).toEqual([false, false, false, false]);
        expect(corners(suffix)).toEqual([false, true, true, false]);
        expect(getComputedStyle(suffix).borderLeftWidth).toBe('0px');
        expect(separator.width).toBe(1);
        expect(separator.height).toBe(text.getBoundingClientRect().height);
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-button-group><ge-button variant="outline">Years</ge-button><ge-button variant="outline">Months</ge-button></ge-button-group>');
        const result = await axe.run(page, { rules: { region: { enabled: false } } });

        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});
