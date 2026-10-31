import { describe, expect, it } from 'vitest';
import axe from 'axe-core';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, paintedToken, useTheme } from '../test-utils.js';
import type { GeBadge } from './badge.js';

const mountBadge = async (markup: string): Promise<GeBadge> => (await mount(markup)).querySelector<GeBadge>('ge-badge')!;

describe('ge-badge', () => {
    it('shows label as the simple mode and lets slotted content take over', async () => {
        const simple = await mountBadge('<ge-badge label="Beta"></ge-badge>');
        const custom = await mountBadge('<ge-badge label="Beta"><b>Pro</b> plan</ge-badge>');

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
        const badge = await mountBadge(`<div style="${distinct}"><ge-badge variant="${variant}" label="x"></ge-badge></div>`);
        const style = getComputedStyle(badge);

        expect(style.backgroundColor).toBe(paintedToken(background, badge));
        expect(style.color).toBe(paintedToken(foreground, badge));
        expect(style.backgroundColor).toMatch(/^rgb\(10, /);
    });

    it('draws outline with no fill and falls back to default for an unknown variant', async () => {
        const outline = await mountBadge('<ge-badge variant="outline" label="x"></ge-badge>');
        const unknown = await mountBadge('<ge-badge variant="nonsense" label="x"></ge-badge>');

        expect(getComputedStyle(outline).backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(getComputedStyle(outline).color).toBe(paintedToken('--foreground', outline));
        expect(getComputedStyle(unknown).backgroundColor).toBe(paintedToken('--primary', unknown));
    });

    it('scales padding with global density and lets the per-component variable win', async () => {
        const base = await mountBadge('<ge-badge label="x"></ge-badge>');
        const dense = await mountBadge('<div style="--density: 0.75"><ge-badge label="x"></ge-badge></div>');
        const override = await mountBadge('<div style="--density: 0.75; --density-badge: 1.25"><ge-badge label="x"></ge-badge></div>');
        const inline = (b: GeBadge) => Number.parseFloat(getComputedStyle(b).paddingInlineStart);

        expect(inline(base)).toBeCloseTo(10, 5); // 0.625rem
        expect(inline(dense)).toBeCloseTo(7.5, 5); // x 0.75
        expect(inline(override)).toBeCloseTo(12.5, 5); // x 1.25, ignoring --density
    });

    it('swaps to a fixed-size placeholder in skeleton mode and keeps layout width', async () => {
        const badge = await mountBadge('<ge-badge label="Loading text that is long" skeleton></ge-badge>');
        const placeholder = badge.shadowRoot!.querySelector('.skeleton')!;

        expect(badge.shadowRoot!.textContent).not.toContain('Loading text');
        expect(placeholder.getBoundingClientRect().width).toBeCloseTo(64, 0); // w-16
        expect(placeholder.getBoundingClientRect().height).toBeCloseTo(20, 0); // h-5
        expect(getComputedStyle(badge).backgroundColor).toBe('rgba(0, 0, 0, 0)');
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode, every variant', async (mode) => {
        useTheme(mode);
        const host = await mount(
            ['default', 'secondary', 'destructive', 'outline']
                .map((v) => `<ge-badge variant="${v}" label="Status ${v}"></ge-badge>`)
                .join(' '),
        );

        const { violations } = await axe.run(host);
        expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(',')}`)).toEqual([]);
    });
});
