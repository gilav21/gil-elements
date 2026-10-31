import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';

describe('ge-kbd', () => {
    it('renders slotted key text in a real <kbd> and grows with longer keys while keeping a 20px square minimum', async () => {
        const page = await mount('<ge-kbd id="k">K</ge-kbd><ge-kbd id="ctrl">Ctrl</ge-kbd>');
        const cap = (id: string) => page.querySelector(id)!.shadowRoot!.querySelector('kbd')!;

        expect(cap('#k').getBoundingClientRect().height).toBe(20);
        expect(cap('#k').getBoundingClientRect().width).toBeGreaterThanOrEqual(20);
        expect(cap('#ctrl').getBoundingClientRect().width).toBeGreaterThan(cap('#k').getBoundingClientRect().width);
        expect(cap('#ctrl').querySelector('slot')!.assignedNodes()[0]!.textContent).toBe('Ctrl');
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<p>Press <ge-kbd>Ctrl</ge-kbd> + <ge-kbd>K</ge-kbd> to search</p>');

        const { violations } = await axe.run(page);
        expect(violations.map((v) => v.id)).toEqual([]);
    });
});
