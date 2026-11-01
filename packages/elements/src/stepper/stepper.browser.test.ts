import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeStepper } from './index.js';

const FORM = `<ge-stepper active-step="1">
  <ge-stepper-item value="account"><ge-stepper-trigger><ge-stepper-title>Account</ge-stepper-title><ge-stepper-description>Create your login</ge-stepper-description></ge-stepper-trigger><ge-stepper-content>Account form</ge-stepper-content></ge-stepper-item>
  <ge-stepper-item value="profile"><ge-stepper-trigger><ge-stepper-title>Profile</ge-stepper-title></ge-stepper-trigger><ge-stepper-content>Profile form</ge-stepper-content></ge-stepper-item>
  <ge-stepper-item value="done"><ge-stepper-trigger><ge-stepper-title>Done</ge-stepper-title></ge-stepper-trigger><ge-stepper-content>All done</ge-stepper-content></ge-stepper-item>
</ge-stepper>`;

const stepper = (page: HTMLElement) => page.querySelector<GeStepper>('ge-stepper')!;
const settle = async (page: HTMLElement) => {
    const s = stepper(page);
    await s.updateComplete;
    for (const el of s.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await el.updateComplete;
    await s.updateComplete;
    for (const el of s.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await el.updateComplete;
};
const button = (page: HTMLElement, index: number) =>
    page.querySelectorAll('ge-stepper-trigger')[index]!.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const statuses = (page: HTMLElement) => [...page.querySelectorAll('ge-stepper-item')].map((i) => i.shadowRoot!.querySelector('.item')!.getAttribute('data-status'));
const visiblePanels = (page: HTMLElement) =>
    [...page.querySelectorAll('ge-stepper-content')].filter((c) => c.shadowRoot!.querySelector('[data-slot=stepper-content]')).map((c) => c.textContent);

describe('ge-stepper', () => {
    it('marks earlier steps complete, the active one current, shows only its panel, and moves on a trigger click', async () => {
        const page = await mount(FORM);
        await settle(page);
        const changes: number[] = [];
        stepper(page).addEventListener('step-change', (e) => changes.push((e as CustomEvent<number>).detail));

        expect(statuses(page)).toEqual(['complete', 'current', 'pending']);
        expect(visiblePanels(page)).toEqual(['Profile form']);
        expect(button(page, 1).getAttribute('aria-current')).toBe('step');

        button(page, 2).click();
        await settle(page);

        expect(stepper(page).activeStep).toBe(2);
        expect(changes).toEqual([2]);
        expect(statuses(page)).toEqual(['complete', 'complete', 'current']);
        expect(visiblePanels(page)).toEqual(['All done']);
    });

    it('renders the quick form from `steps`, with descriptions only where given', async () => {
        const page = await mount('<ge-stepper active-step="0"></ge-stepper>');
        stepper(page).steps = [
            { value: 'a', title: 'First', description: 'Begin here' },
            { value: 'b', title: 'Second' },
        ];
        await settle(page);
        await settle(page);

        const texts = [...stepper(page).shadowRoot!.querySelectorAll('ge-stepper-trigger')].map((t) => t.textContent!.replaceAll(/\s+/g, ' ').trim());
        expect(texts).toEqual(['First Begin here', 'Second']);
    });

    it('in a linear stepper disables steps ahead of the current one and ignores goToStep to them', async () => {
        const page = await mount(FORM.replace('active-step="1"', 'active-step="0" linear'));
        await settle(page);
        const changes: number[] = [];
        stepper(page).addEventListener('step-change', (e) => changes.push((e as CustomEvent<number>).detail));

        expect([0, 1, 2].map((i) => button(page, i).disabled)).toEqual([false, true, true]);
        stepper(page).goToStep(2);
        await settle(page);
        expect(stepper(page).activeStep).toBe(0);

        stepper(page).nextStep();
        await settle(page);

        expect(stepper(page).activeStep).toBe(1);
        expect(changes).toEqual([1]);
        expect([0, 1, 2].map((i) => button(page, i).disabled)).toEqual([false, false, true]);
    });

    it('clamps nextStep and prevStep at the ends', async () => {
        const page = await mount(FORM);
        await settle(page);
        stepper(page).nextStep();
        stepper(page).nextStep();
        expect(stepper(page).activeStep).toBe(2);
        for (let i = 0; i < 4; i++) stepper(page).prevStep();
        expect(stepper(page).activeStep).toBe(0);
    });

    describe('can-leave guard', () => {
        it('blocks a move the guard refuses and reports where it was headed', async () => {
            const page = await mount(FORM);
            await settle(page);
            stepper(page).canLeave = (from, to) => from === 1 && to === 0 ? false : true;
            const blocked: unknown[] = [];
            stepper(page).addEventListener('step-blocked', (e) => blocked.push((e as CustomEvent).detail));

            stepper(page).goToStep(0);
            expect(stepper(page).activeStep).toBe(1);
            expect(blocked).toEqual([{ from: 1, to: 0 }]);
            stepper(page).goToStep(2);
            expect(stepper(page).activeStep).toBe(2);
        });

        it('treats a throwing or rejecting guard as a refusal', async () => {
            const page = await mount(FORM);
            await settle(page);
            stepper(page).canLeave = () => { throw new Error('boom'); };
            stepper(page).goToStep(2);
            stepper(page).canLeave = () => Promise.reject(new Error('nope'));
            stepper(page).goToStep(2);
            await new Promise((r) => setTimeout(r));
            expect(stepper(page).activeStep).toBe(1);
        });

        it('disables every trigger while an async guard decides, then moves when it allows', async () => {
            const page = await mount(FORM);
            await settle(page);
            let allow!: (ok: boolean) => void;
            stepper(page).canLeave = () => new Promise<boolean>((r) => { allow = r; });

            button(page, 2).click();
            await settle(page);
            expect([0, 1, 2].map((i) => button(page, i).disabled)).toEqual([true, true, true]);
            expect(button(page, 2).getAttribute('aria-busy')).toBe('true');
            expect(stepper(page).activeStep).toBe(1);

            allow(true);
            await new Promise((r) => setTimeout(r));
            await settle(page);
            expect(stepper(page).activeStep).toBe(2);
            expect(button(page, 2).hasAttribute('aria-busy')).toBe(false);
        });

        it('lets a newer move cancel a stale async answer', async () => {
            const page = await mount(FORM);
            await settle(page);
            let allow!: (ok: boolean) => void;
            stepper(page).canLeave = (_from, to) => (to === 2 ? new Promise<boolean>((r) => { allow = r; }) : true);

            stepper(page).goToStep(2);
            stepper(page).goToStep(0);
            allow(true);
            await new Promise((r) => setTimeout(r));

            expect(stepper(page).activeStep).toBe(0);
        });
    });

    it('joins steps with a connector that leaves 8px on both sides, in both orientations', async () => {
        const gap = (page: Element, from: 'left' | 'top') => {
            const items = [...page.querySelectorAll('ge-stepper-item')];
            const root = (i: Element) => i.shadowRoot!;
            const item = (i: Element) => root(i).querySelector('.item')!.getBoundingClientRect();
            const connector = root(items[0]!).querySelector('.connector')!.getBoundingClientRect();
            const [start, end] = from === 'left' ? (['right', 'left'] as const) : (['bottom', 'top'] as const);
            return {
                before: connector[from] - item(items[0]!)[start],
                after: item(items[1]!)[end] - connector[start],
                connector,
                last: root(items[2]!).querySelector('.connector'),
                items,
            };
        };

        const row = await mount(FORM);
        await settle(row);
        const h = gap(row, 'left');
        expect(h.before).toBeCloseTo(8, 0);
        expect(h.after).toBeCloseTo(8, 0);
        expect(h.last).toBeNull();

        const col = await mount(FORM.replace('<ge-stepper ', '<ge-stepper orientation="vertical" '));
        await settle(col);
        const v = gap(col, 'top');
        expect(v.connector.width).toBeCloseTo(2, 0);
        expect(v.connector.height).toBeCloseTo(32, 0);
        expect(v.before).toBeCloseTo(8, 0);
        expect(v.after).toBeCloseTo(8, 0);
        expect(v.last).toBeNull();
    });

    it('moves by keyboard: Tab to a trigger and Enter activates it', async () => {
        const page = await mount(FORM);
        await settle(page);
        page.querySelectorAll<HTMLElement>('ge-stepper-trigger')[0]!.focus();
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(stepper(page).activeStep).toBe(0);
    });

    describe.each(['light', 'dark'] as const)('%s theme', (theme) => {
        useTheme(theme);
        it('has no accessibility violations', async () => {
            const page = await mount(FORM);
            await settle(page);
            const { violations } = await axe.run(page);
            expect(violations.map((v) => v.id)).toEqual([]);
        });
    });
});
