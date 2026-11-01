import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../label/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeNumberInput } from './number-input.js';

const first = (page: HTMLElement) => page.querySelector<GeNumberInput>('ge-number-input')!;
const inner = (el: GeNumberInput) => el.shadowRoot!.querySelector<HTMLInputElement>('input')!;
const record = (el: Element) => {
    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));
    return events;
};

describe('ge-number-input', () => {
    it('takes what is typed as the value, keeps a half-typed decimal intact, and announces the change on blur', async () => {
        const page = await mount('<ge-number-input></ge-number-input><button>next</button>');
        const field = first(page);
        const events = record(field);

        await userEvent.click(inner(field));
        await userEvent.keyboard('-12.5');
        expect([field.value, inner(field).value]).toEqual([-12.5, '-12.5']);
        expect(events).not.toContain('change');
        await userEvent.tab();

        expect(events.filter((e) => e === 'input')).toHaveLength(5);
        expect(events.filter((e) => e === 'change')).toHaveLength(1);
    });

    it('leaves the text under the caret alone while typing, even when it is not how the number would be written', async () => {
        const page = await mount('<ge-number-input></ge-number-input>');
        const field = first(page);

        await userEvent.click(inner(field));
        await userEvent.keyboard('053');

        expect([field.value, inner(field).value]).toEqual([53, '053']);
    });

    it('is empty as null, and clearing the field returns it to null rather than 0', async () => {
        const page = await mount('<ge-number-input value="7"></ge-number-input>');
        const field = first(page);
        expect(field.value).toBe(7);

        await userEvent.fill(inner(field), '');

        expect([field.value, inner(field).value]).toEqual([null, '']);
    });

    it('steps with the arrows from an empty field and from off the grid, stopping at the limits without announcing a non-change', async () => {
        const page = await mount('<ge-number-input min="0" max="10" step="2.5"></ge-number-input>');
        const field = first(page);
        const events = record(field);

        await userEvent.click(inner(field));
        await userEvent.keyboard('{ArrowUp}');
        expect(field.value).toBe(2.5);
        await userEvent.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}');
        expect(field.value).toBe(10);
        await userEvent.keyboard('{ArrowUp}');
        expect(events).toEqual(['input', 'change', 'input', 'change', 'input', 'change', 'input', 'change']);

        await userEvent.fill(inner(field), '3');
        await userEvent.keyboard('{ArrowDown}');
        expect(field.value).toBe(2.5);

        const open = await mount('<ge-number-input></ge-number-input><ge-number-input></ge-number-input>');
        const [up, down] = open.querySelectorAll<GeNumberInput>('ge-number-input');
        up.increment();
        down.decrement();
        expect([up.value, down.value]).toEqual([1, -1]);
        await userEvent.keyboard('{ArrowDown}{ArrowDown}');
        expect(field.value).toBe(0);
    });

    it('steps with the wheel only while it has focus', async () => {
        const page = await mount('<ge-number-input value="5"></ge-number-input>');
        const field = first(page);
        const wheel = (deltaY: number) => inner(field).dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));

        const unfocused = wheel(-100);
        expect([field.value, unfocused]).toEqual([5, true]);
        inner(field).focus();
        const focused = wheel(-100);
        wheel(100);
        wheel(100);

        expect([field.value, focused]).toEqual([4, false]);
    });

    it('clamps to min and max when it loses focus, and only then', async () => {
        const page = await mount('<ge-number-input min="1" max="10"></ge-number-input><ge-number-input id="b" min="1" max="10"></ge-number-input><button>x</button>');
        const [low, high] = page.querySelectorAll<GeNumberInput>('ge-number-input');
        const events = record(low);

        await userEvent.fill(inner(low), '-4');
        expect(low.value).toBe(-4);
        await userEvent.fill(inner(high), '99');
        await userEvent.click(page.querySelector('button')!);

        expect([low.value, high.value]).toEqual([1, 10]);
        expect(inner(low).value).toBe('1');
        expect(events.at(-1)).toBe('change');
    });

    it('leaves an empty field empty when it loses focus, even with limits', async () => {
        const page = await mount('<ge-number-input min="1" max="10"></ge-number-input><button>x</button>');
        const field = first(page);

        await userEvent.click(inner(field));
        await userEvent.click(page.querySelector('button')!);

        expect([field.value, inner(field).value]).toEqual([null, '']);
    });

    it('ignores the arrows, the wheel and the step methods while disabled or in a disabled fieldset', async () => {
        const page = await mount('<ge-number-input id="a" disabled value="3"></ge-number-input><fieldset disabled><ge-number-input id="b" value="3"></ge-number-input></fieldset>');
        const all = ['a', 'b'].map((id) => page.querySelector<GeNumberInput>(`#${id}`)!);

        for (const field of all) {
            inner(field).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
            field.increment();
            field.decrement();
        }

        expect(all.map((field) => field.value)).toEqual([3, 3]);
    });

    it('is named by a ge-label elsewhere in the page and passes axe in every variant, light and dark', async () => {
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            const page = await mount(`
                <ge-label id="l-${mode}" for="n-${mode}">Quantity</ge-label>
                <ge-number-input id="n-${mode}" value="2"></ge-number-input>
                <ge-number-input variant="underline" aria-label="Underline" value="2"></ge-number-input>
                <ge-number-input variant="ghost" aria-label="Ghost" disabled></ge-number-input>`);
            expect(first(page).getAttribute('aria-labelledby')).toBe(`l-${mode}`);
            expect((await axe.run(page)).violations).toEqual([]);
            page.remove();
        }
    });

    it('is as tall as an input and scales with the density token', async () => {
        const page = await mount('<ge-number-input></ge-number-input><ge-number-input style="--density-input: 1.5"></ge-number-input>');
        const heights = [...page.querySelectorAll<GeNumberInput>('ge-number-input')].map((field) => field.shadowRoot!.querySelector('.wrap')!.getBoundingClientRect().height);

        expect(heights).toEqual([36, 54]);
    });

    it('submits its value under its name, submits empty when blank, and a form reset restores the markup', async () => {
        const page = await mount('<form><ge-number-input name="qty" value="3"></ge-number-input><ge-number-input name="blank"></ge-number-input></form>');
        const form = page.querySelector('form')!;
        const field = first(page);

        expect([...new FormData(form).entries()]).toEqual([['qty', '3'], ['blank', '']]);
        await userEvent.fill(inner(field), '8');
        await field.updateComplete;
        expect(new FormData(form).get('qty')).toBe('8');

        form.reset();
        await field.updateComplete;
        expect([field.value, inner(field).value, new FormData(form).get('qty')]).toEqual([3, '3', '3']);
    });
});
