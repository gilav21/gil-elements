import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeTimelineItem } from './index.js';

const SIMPLE = `<ge-timeline>
  <ge-timeline-item heading="Version 2.0 released" description="Major update with new features." time="January 2024" variant="success"></ge-timeline-item>
  <ge-timeline-item heading="Beta started" time="November 2023"></ge-timeline-item>
  <ge-timeline-item heading="Kickoff"></ge-timeline-item>
</ge-timeline>`;
const CUSTOM = `<ge-timeline><ge-timeline-item>
  <ge-timeline-header><ge-timeline-dot variant="filled"></ge-timeline-dot></ge-timeline-header>
  <ge-timeline-content><ge-timeline-title>Custom</ge-timeline-title></ge-timeline-content>
</ge-timeline-item></ge-timeline>`;

const items = (page: HTMLElement) => [...page.querySelectorAll<GeTimelineItem>('ge-timeline-item')];
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 3; round++) {
        for (const el of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await el.updateComplete;
        for (const item of items(page)) for (const el of item.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await el.updateComplete;
    }
};
const textOf = (item: Element) => [...item.shadowRoot!.querySelectorAll('ge-timeline-title, ge-timeline-description, ge-timeline-time')].map((p) => p.textContent!.trim());
const dotOf = (item: Element) => item.shadowRoot!.querySelector('ge-timeline-dot')!;

describe('ge-timeline', () => {
    it('simple mode builds the dot, line and text from attributes and leaves out what is not given', async () => {
        const page = await mount(SIMPLE);
        await settle(page);

        expect(textOf(items(page)[0]!)).toEqual(['Version 2.0 released', 'Major update with new features.', 'January 2024']);
        expect(textOf(items(page)[1]!)).toEqual(['Beta started', 'November 2023']);
        expect(textOf(items(page)[2]!)).toEqual(['Kickoff']);
        expect(dotOf(items(page)[0]!).getAttribute('variant')).toBe('success');
        expect(dotOf(items(page)[1]!).getAttribute('variant')).toBe('default');
    });

    it('hide-connector drops the line and nothing else', async () => {
        const page = await mount(SIMPLE.replace('heading="Kickoff"', 'heading="Kickoff" hide-connector'));
        await settle(page);

        expect(items(page).map((i) => i.shadowRoot!.querySelector('ge-timeline-connector') !== null)).toEqual([true, true, false]);
        expect(dotOf(items(page)[2]!)).not.toBeNull();
    });

    it('custom mode shows the slotted parts instead of generating its own', async () => {
        const page = await mount(CUSTOM);
        await settle(page);
        const item = items(page)[0]!;

        expect(item.shadowRoot!.querySelector('ge-timeline-dot')).toBeNull();
        expect(item.shadowRoot!.querySelector('slot')).not.toBeNull();
        expect(page.querySelector('ge-timeline-title')!.textContent).toBe('Custom');
    });

    it('switches to custom mode when a header is added later', async () => {
        const page = await mount('<ge-timeline><ge-timeline-item heading="Plain"></ge-timeline-item></ge-timeline>');
        await settle(page);
        const item = items(page)[0]!;
        expect(item.shadowRoot!.querySelector('ge-timeline-title')).not.toBeNull();

        item.insertAdjacentHTML('beforeend', '<ge-timeline-header><ge-timeline-dot></ge-timeline-dot></ge-timeline-header>');
        await new Promise((r) => setTimeout(r));
        await settle(page);

        expect(item.shadowRoot!.querySelector('ge-timeline-title')).toBeNull();
        expect(item.shadowRoot!.querySelector('slot')).not.toBeNull();
    });

    it('spaces every item from the next except the last, and the line reaches the next dot', async () => {
        const page = await mount(SIMPLE);
        await settle(page);
        const boxes = items(page).map((i) => i.shadowRoot!.querySelector('.item')!.getBoundingClientRect());
        const dots = items(page).map((i) => dotOf(i).shadowRoot!.querySelector('div')!.getBoundingClientRect());
        const line = items(page)[0]!.shadowRoot!.querySelector('ge-timeline-connector')!.shadowRoot!.querySelector('div')!.getBoundingClientRect();

        expect(boxes[1]!.top - boxes[0]!.bottom).toBe(0);
        expect(dots[1]!.top - dots[0]!.bottom).toBeGreaterThan(boxes[0]!.height - 24 - 8);
        expect(getComputedStyle(items(page)[0]!.shadowRoot!.querySelector('.item')!).paddingBottom).toBe('32px');
        expect(getComputedStyle(items(page)[2]!.shadowRoot!.querySelector('.item')!).paddingBottom).toBe('0px');
        // The line starts under the dot and runs to the item bottom less the 24px dot, i.e. it ends at the padding.
        expect(line.top).toBeCloseTo(boxes[0]!.top + 24, 0);
        expect(line.bottom).toBeCloseTo(boxes[0]!.bottom, 0);
    });

    it('lays items out in a column or a row by orientation', async () => {
        const col = await mount(SIMPLE);
        const row = await mount(SIMPLE.replace('<ge-timeline>', '<ge-timeline orientation="horizontal">'));
        await settle(col);
        await settle(row);
        const pos = (page: HTMLElement) => items(page).map((i) => i.shadowRoot!.querySelector('.item')!.getBoundingClientRect());

        expect(pos(col)[1]!.top).toBeGreaterThan(pos(col)[0]!.top);
        expect(pos(col)[1]!.left).toBe(pos(col)[0]!.left);
        expect(pos(row)[1]!.left).toBeGreaterThan(pos(row)[0]!.left);
        expect(pos(row)[1]!.top).toBe(pos(row)[0]!.top);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no accessibility violations', async () => {
            const page = await mount(`${SIMPLE}${CUSTOM}`);
            await settle(page);
            const { violations } = await axe.run(page);
            expect(violations.map((v) => v.id)).toEqual([]);
        });
    });
});
