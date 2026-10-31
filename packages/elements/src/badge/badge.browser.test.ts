import { afterEach, describe, expect, it } from 'vitest';
import axe from 'axe-core';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import type { GeBadge } from './badge.js';

const mounted: HTMLElement[] = [];

/** Mounts markup the way a page author writes it and waits for Lit's first render. */
async function mount(markup: string, host: HTMLElement = document.body): Promise<GeBadge> {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = markup;
    host.append(wrapper);
    mounted.push(wrapper);
    const badge = wrapper.querySelector<GeBadge>('ge-badge')!;
    await badge.updateComplete;
    return badge;
}

/** Resolves a token to the colour the browser actually paints, whatever its source syntax (oklch, color-mix). */
function paintedToken(token: string, at: Element): string {
    const probe = document.createElement('span');
    probe.style.color = `var(${token})`;
    at.append(probe);
    const colour = getComputedStyle(probe).color;
    probe.remove();
    return colour;
}

afterEach(() => {
    for (const el of mounted.splice(0)) el.remove();
    document.documentElement.classList.remove('dark');
});

describe('ge-badge', () => {
    it('shows label as the simple mode and lets slotted content take over', async () => {
        const simple = await mount('<ge-badge label="Beta"></ge-badge>');
        const custom = await mount('<ge-badge label="Beta"><b>Pro</b> plan</ge-badge>');

        expect(simple.shadowRoot!.querySelector('slot')!.assignedNodes()).toHaveLength(0);
        expect(simple.shadowRoot!.textContent).toContain('Beta');
        expect(custom.shadowRoot!.querySelector('slot')!.assignedNodes({ flatten: true }).map((n) => n.textContent)).toEqual([
            'Pro',
            ' plan',
        ]);
    });

    it.each([
        ['default', '--primary', '--primary-foreground'],
        ['secondary', '--secondary', '--secondary-foreground'],
        ['destructive', '--destructive', '--destructive-foreground'],
    ])('paints the %s variant with its tokens', async (variant, background, foreground) => {
        // Distinct value per token: the shipped defaults repeat (secondary equals muted), which
        // would let a wrong-token bug pass.
        const distinct = [background, foreground]
            .map((token, i) => `${token}: rgb(${i + 10}, ${token.length * 7}, ${variant.length * 11})`)
            .join('; ');
        const badge = await mount(`<div style="${distinct}"><ge-badge variant="${variant}" label="x"></ge-badge></div>`);
        const style = getComputedStyle(badge);

        expect(style.backgroundColor).toBe(paintedToken(background, badge));
        expect(style.color).toBe(paintedToken(foreground, badge));
        expect(style.backgroundColor).toMatch(/^rgb\(10, /);
    });

    it('draws outline with no fill and falls back to default for an unknown variant', async () => {
        const outline = await mount('<ge-badge variant="outline" label="x"></ge-badge>');
        const unknown = await mount('<ge-badge variant="nonsense" label="x"></ge-badge>');

        expect(getComputedStyle(outline).backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(getComputedStyle(outline).color).toBe(paintedToken('--foreground', outline));
        expect(getComputedStyle(unknown).backgroundColor).toBe(paintedToken('--primary', unknown));
    });

    it('scales padding with global density and lets the per-component variable win', async () => {
        const base = await mount('<ge-badge label="x"></ge-badge>');
        const dense = await mount('<div style="--density: 0.75"><ge-badge label="x"></ge-badge></div>');
        const override = await mount('<div style="--density: 0.75; --density-badge: 1.25"><ge-badge label="x"></ge-badge></div>');
        const inline = (b: GeBadge) => Number.parseFloat(getComputedStyle(b).paddingInlineStart);

        expect(inline(base)).toBeCloseTo(10, 5); // 0.625rem
        expect(inline(dense)).toBeCloseTo(7.5, 5); // x 0.75
        expect(inline(override)).toBeCloseTo(12.5, 5); // x 1.25, ignoring --density
    });

    it('swaps to a fixed-size placeholder in skeleton mode and keeps layout width', async () => {
        const badge = await mount('<ge-badge label="Loading text that is long" skeleton></ge-badge>');
        const placeholder = badge.shadowRoot!.querySelector('.skeleton')!;

        expect(badge.shadowRoot!.textContent).not.toContain('Loading text');
        expect(placeholder.getBoundingClientRect().width).toBeCloseTo(64, 0); // w-16
        expect(placeholder.getBoundingClientRect().height).toBeCloseTo(20, 0); // h-5
        expect(getComputedStyle(badge).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode, every variant', async (mode) => {
        document.documentElement.classList.toggle('dark', mode === 'dark');
        document.body.style.background = 'var(--background)';
        const host = await mount(
            ['default', 'secondary', 'destructive', 'outline']
                .map((v) => `<ge-badge variant="${v}" label="Status ${v}"></ge-badge>`)
                .join(' '),
        );

        const { violations } = await axe.run(host.parentElement!);
        expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(',')}`)).toEqual([]);
    });
});
