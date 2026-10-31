import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';

const built = (el: Element) => el.shadowRoot!.querySelector('output')!;

describe('ge-spinner', () => {
    it.each([
        ['xs', 12],
        ['default', 20],
        ['xl', 32],
        ['page', 48],
    ])('sizes the ring for size=%s to %ipx', async (size, px) => {
        const page = await mount(`<ge-spinner size="${size}"></ge-spinner>`);
        const svg = built(page.firstElementChild!).querySelector('svg')!.getBoundingClientRect();

        expect([svg.width, svg.height]).toEqual([px, px]);
    });

    it('lets custom-size override the preset for the ring, and builds the other variants from the same size', async () => {
        const page = await mount(`
            <ge-spinner id="custom" size="xs" custom-size="30"></ge-spinner>
            <ge-spinner id="dots" variant="dots"></ge-spinner>
            <ge-spinner id="bars" variant="bars" size="lg"></ge-spinner>
            <ge-spinner id="pulse" variant="pulse" size="sm"></ge-spinner>`);
        const at = (id: string) => built(page.querySelector(id)!);

        expect(at('#custom').querySelector('svg')!.getBoundingClientRect().width).toBe(30);
        expect(at('#dots').querySelectorAll('.dot')).toHaveLength(3);
        expect(at('#dots').querySelector('.dot')!.getBoundingClientRect().width).toBe(8);
        expect(at('#bars').querySelectorAll('.bar')).toHaveLength(5);
        expect(at('#bars').querySelector('.bar')!.getBoundingClientRect().height).toBe(24);
        expect(at('#pulse').getBoundingClientRect().width).toBe(16);
    });

    it('is announced as a status named by label, and slotted content replaces the built-in loader', async () => {
        const page = await mount(`
            <ge-spinner id="named" label="Saving"></ge-spinner>
            <ge-spinner id="custom"><span id="mine">my loader</span></ge-spinner>`);

        expect(built(page.querySelector('#named')!).getAttribute('aria-label')).toBe('Saving');
        const slot = page.querySelector('#custom')!.shadowRoot!.querySelector('slot')!;
        expect(slot.assignedNodes()).toHaveLength(1);
        expect(page.querySelector('#custom')!.querySelector('#mine')!.getBoundingClientRect().width).toBeGreaterThan(0);
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode, every variant', async (mode) => {
        useTheme(mode);
        const page = await mount(['ring', 'dots', 'bars', 'pulse'].map((v) => `<ge-spinner variant="${v}"></ge-spinner>`).join(' '));

        const { violations } = await axe.run(page);
        expect(violations.map((v) => v.id)).toEqual([]);
    });
});
