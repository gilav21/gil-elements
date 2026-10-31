import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, paintedToken, useTheme } from '../test-utils.js';
import type { GeButton } from './button.js';

const inner = (el: Element) => el.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const first = (page: HTMLElement) => page.querySelector<GeButton>('ge-button')!;

describe('ge-button', () => {
    it('submits and resets the form it sits in, like a native button, and stays inert for type=button', async () => {
        const page = await mount(`
            <form id="f"><input name="q" value="draft">
                <ge-button id="submit" type="submit">Go</ge-button>
                <ge-button id="reset" type="reset">Clear</ge-button> <!-- the ids shadow form.submit and form.reset on purpose -->
                <ge-button id="plain">Noop</ge-button>
            </form>`);
        const form = page.querySelector<HTMLFormElement>('#f')!;
        const input = form.querySelector('input')!;
        const submitted: FormData[] = [];
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            submitted.push(new FormData(form));
        });

        input.value = 'edited';
        inner(page.querySelector('#plain')!).click();
        expect(submitted).toHaveLength(0);

        inner(page.querySelector('#submit')!).click();
        expect(submitted.map((data) => data.get('q'))).toEqual(['edited']);

        inner(page.querySelector('#reset')!).click();
        expect(input.value).toBe('draft');
    });

    it('is activated from the keyboard: Tab reaches it, Enter and Space click it', async () => {
        const page = await mount('<form><ge-button type="submit">Go</ge-button></form>');
        const button = first(page);
        let submits = 0;
        page.querySelector('form')!.addEventListener('submit', (event) => {
            event.preventDefault();
            submits++;
        });

        await userEvent.tab();
        expect(button.matches(':focus')).toBe(true);
        expect(button.shadowRoot!.activeElement).toBe(inner(button));
        await userEvent.keyboard('{Enter}');
        await userEvent.keyboard(' ');

        expect(submits).toBe(2);
    });

    it('moves focus to the inner button when the host is focused from script', async () => {
        const page = await mount('<ge-button>Go</ge-button>');
        const button = first(page);

        button.focus();

        expect(button.shadowRoot!.activeElement).toBe(inner(button));
    });

    it('does nothing while disabled, loading or inside a disabled fieldset, and is not tabbable', async () => {
        const page = await mount(`
            <form>
                <ge-button id="d" type="submit" disabled>A</ge-button>
                <ge-button id="l" type="submit" loading>B</ge-button>
                <fieldset disabled><ge-button id="f" type="submit">C</ge-button></fieldset>
            </form>`);
        let submits = 0;
        page.querySelector('form')!.addEventListener('submit', (event) => {
            event.preventDefault();
            submits++;
        });

        for (const id of ['d', 'l', 'f']) {
            const button = page.querySelector<GeButton>(`#${id}`)!;
            expect(inner(button).disabled).toBe(true);
            button.click();
            inner(button).click();
        }
        expect(submits).toBe(0);
        expect(getComputedStyle(inner(page.querySelector('#d')!)).opacity).toBe('0.5');
    });

    it('lets a capture-phase listener cancel the submit, like a native button', async () => {
        const page = await mount('<form><ge-button type="submit">Go</ge-button></form>');
        let submits = 0;
        const form = page.querySelector('form')!;
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            submits++;
        });
        form.addEventListener('click', (event) => event.preventDefault(), { capture: true });

        inner(first(page)).click();

        expect(submits).toBe(0);
    });

    it('forwards its ARIA attributes to the inner button, where assistive technology looks', async () => {
        const page = await mount('<ge-button aria-label="Close dialog" aria-expanded="true" aria-pressed="false" aria-haspopup="menu">x</ge-button>');
        const button = inner(first(page));

        expect(button.getAttribute('aria-label')).toBe('Close dialog');
        expect(button.getAttribute('aria-expanded')).toBe('true');
        expect(button.getAttribute('aria-pressed')).toBe('false');
        expect(button.getAttribute('aria-haspopup')).toBe('menu');
    });

    it('prefers slotted content to the label attribute and shows a busy button as a spinner over its text', async () => {
        const page = await mount(`
            <ge-button id="a" label="From label">From slot</ge-button>
            <ge-button id="b" label="Only label"></ge-button>
            <ge-button id="c" loading>Saving</ge-button>`);

        expect(page.querySelector('#a')!.shadowRoot!.querySelector('slot')!.assignedNodes()[0].textContent).toBe('From slot');
        expect(page.querySelector('#b')!.shadowRoot!.textContent).toContain('Only label');
        expect(page.querySelector('#c')!.shadowRoot!.querySelector('.spinner svg')).not.toBeNull();
    });

    it('paints each variant with its tokens and scales height with density', async () => {
        const tokens = '--primary: rgb(11, 22, 33); --secondary: rgb(44, 55, 66); --destructive: rgb(77, 88, 99)';
        const page = await mount(`
            <div style="${tokens}">
                <ge-button id="p">P</ge-button><ge-button id="s" variant="secondary">S</ge-button>
                <ge-button id="o" variant="outline">O</ge-button><ge-button id="g" variant="ghost">G</ge-button>
            </div>
            <div style="--density: 0.75"><ge-button id="dense">D</ge-button></div>
            <div style="--density: 0.75; --density-button: 1.25"><ge-button id="override">D</ge-button></div>
            <ge-button id="base">D</ge-button>`);
        const style = (id: string) => getComputedStyle(inner(page.querySelector(`#${id}`)!));
        const height = (id: string) => inner(page.querySelector(`#${id}`)!).getBoundingClientRect().height;

        expect(style('p').backgroundColor).toBe('rgb(11, 22, 33)');
        expect(style('s').backgroundColor).toBe('rgb(44, 55, 66)');
        expect(style('o').backgroundColor).toBe(paintedToken('--background', page));
        expect(style('g').backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect([height('base'), height('dense'), height('override')]).toEqual([36, 27, 45]);
    });

    it('draws a focus ring only for keyboard focus', async () => {
        const page = await mount('<ge-button>Go</ge-button>');
        const button = inner(first(page));

        button.dispatchEvent(new MouseEvent('mousedown'));
        button.focus();
        await userEvent.tab();
        await userEvent.tab({ shift: true });

        expect(button.matches(':focus-visible')).toBe(true);
        // `transition: all` means the ring fades in, so wait for it rather than read the first frame.
        await vi.waitFor(() => expect(getComputedStyle(button).boxShadow).toMatch(/0px 0px 0px 3px/));
    });

    it('ripples from the pointer when asked and cleans up after itself', async () => {
        const page = await mount('<ge-button ripple>Go</ge-button><ge-button>Plain</ge-button>');
        const [rippling, plain] = page.querySelectorAll('ge-button');

        inner(plain).click();
        inner(rippling).click();

        expect(inner(plain).querySelector('span')).toBeNull();
        const wave = inner(rippling).querySelector('span')!;
        expect(wave).not.toBeNull();
        await vi.waitFor(() => expect(wave.isConnected).toBe(false), { timeout: 2000 });
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-button aria-label="Save">Save</ge-button><ge-button variant="outline">Cancel</ge-button><ge-button size="icon" variant="ghost" aria-label="Add"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12h14"/></svg></ge-button>');
        const result = await axe.run(page, { rules: { region: { enabled: false } } });

        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});
