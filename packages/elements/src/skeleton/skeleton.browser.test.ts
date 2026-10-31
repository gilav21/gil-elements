import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeSkeleton } from './skeleton.js';

describe('ge-skeleton', () => {
    it('takes the size the page gives it, and has none of its own', async () => {
        const page = await mount('<ge-skeleton style="width: 64px; height: 20px"></ge-skeleton><ge-skeleton id="bare"></ge-skeleton>');
        const sized = page.querySelector('ge-skeleton')!.getBoundingClientRect();

        expect([sized.width, sized.height]).toEqual([64, 20]);
        expect(page.querySelector('#bare')!.getBoundingClientRect().height).toBe(0);
    });

    it('fills with a faint primary tint by default and a themed gradient for shimmer, which follows the dark theme', async () => {
        const page = await mount(`
            <div style="--primary: rgb(200, 0, 0); --skeleton-shimmer-base: rgb(1, 2, 3); --skeleton-shimmer-highlight: rgb(4, 5, 6)">
                <ge-skeleton id="pulse" style="height: 8px"></ge-skeleton>
                <ge-skeleton id="shimmer" variant="shimmer" style="height: 8px"></ge-skeleton>
            </div>`);
        const pulse = getComputedStyle(page.querySelector('#pulse')!);
        const shimmer = getComputedStyle(page.querySelector('#shimmer')!);

        const other = await mount('<div style="--primary: rgb(0, 0, 200)"><ge-skeleton style="height: 8px"></ge-skeleton></div>');

        expect(pulse.backgroundColor).toMatch(/ 0\.1\)$/);
        expect(getComputedStyle(other.querySelector('ge-skeleton')!).backgroundColor).not.toBe(pulse.backgroundColor);
        expect(shimmer.backgroundImage).toContain('rgb(1, 2, 3)');
        expect(shimmer.backgroundImage).toContain('rgb(4, 5, 6)');
        expect((page.querySelector('#shimmer') as GeSkeleton).variant).toBe('shimmer');
    });
});
