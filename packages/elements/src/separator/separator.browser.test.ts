import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, paintedToken } from '../test-utils.js';

describe('ge-separator', () => {
    it('draws a 1px line across its container horizontally and down its height vertically', async () => {
        const page = await mount(`
            <div style="width: 200px"><ge-separator id="h"></ge-separator></div>
            <div style="display: flex; height: 40px"><ge-separator id="v" orientation="vertical"></ge-separator></div>`);
        const h = page.querySelector('#h')!.getBoundingClientRect();
        const v = page.querySelector('#v')!.getBoundingClientRect();

        expect([h.width, h.height]).toEqual([200, 1]);
        expect([v.width, v.height]).toEqual([1, 40]);
    });

    it('paints the border token and exposes separator semantics with the matching orientation', async () => {
        const page = await mount('<div style="--border: rgb(12, 34, 56)"><ge-separator></ge-separator><ge-separator orientation="vertical"></ge-separator></div>');
        const [horizontal, vertical] = [...page.querySelectorAll('ge-separator')].map((el) => el.shadowRoot!.querySelector('[role="separator"]')!);

        expect(getComputedStyle(horizontal!).backgroundColor).toBe('rgb(12, 34, 56)');
        expect(horizontal!.getAttribute('aria-orientation')).toBe('horizontal');
        expect(vertical!.getAttribute('aria-orientation')).toBe('vertical');
        expect(paintedToken('--border', page)).not.toBe('rgb(12, 34, 56)');
    });
});
