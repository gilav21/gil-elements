import axe from 'axe-core';
import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeToggle } from './toggle.js';

const inner = (el: Element) => el.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const first = (page: HTMLElement) => page.querySelector<GeToggle>('ge-toggle')!;

describe('ge-toggle', () => {
    it('flips on click, reports the new state, and starts pressed when the markup says so', async () => {
        const page = await mount('<ge-toggle>Bold</ge-toggle><ge-toggle pressed>Italic</ge-toggle>');
        const [bold, italic] = page.querySelectorAll<GeToggle>('ge-toggle');
        const states: boolean[] = [];
        bold.addEventListener('pressed-change', (event) => states.push((event as CustomEvent<boolean>).detail));

        expect([inner(bold).getAttribute('aria-pressed'), inner(italic).getAttribute('aria-pressed')]).toEqual(['false', 'true']);
        inner(bold).click();
        inner(bold).click();

        expect(states).toEqual([true, false]);
        expect(bold.pressed).toBe(false);
    });

    it('moves focus to the inner button when the host is focused from script', async () => {
        const page = await mount('<ge-toggle>Go</ge-toggle>');
        const toggle = first(page);

        toggle.focus();

        expect(toggle.shadowRoot!.activeElement).toBe(inner(toggle));
    });

    it('does nothing while disabled and is skipped by Tab', async () => {
        const page = await mount('<ge-toggle id="off" disabled>A</ge-toggle><ge-toggle id="on">B</ge-toggle>');
        const states: boolean[] = [];
        page.addEventListener('pressed-change', (event) => states.push((event as CustomEvent<boolean>).detail));

        inner(page.querySelector('#off')!).click();
        await userEvent.tab();

        expect(states).toEqual([]);
        expect(document.activeElement).toBe(page.querySelector('#on'));
    });

    it('toggles from the keyboard with Space and Enter, like a native button', async () => {
        const page = await mount('<ge-toggle>Bold</ge-toggle>');
        const toggle = first(page);

        await userEvent.tab();
        await userEvent.keyboard('{Enter}');
        expect(toggle.pressed).toBe(true);
        await userEvent.keyboard(' ');
        expect(toggle.pressed).toBe(false);
    });

    it('can be set from script, and an icon-only toggle takes its name from aria-label', async () => {
        const page = await mount('<ge-toggle aria-label="Bold"><svg width="16" height="16" viewBox="0 0 24 24"><path d="M5 12h14"/></svg></ge-toggle>');
        const toggle = first(page);

        toggle.pressed = true;
        await toggle.updateComplete;

        expect(inner(toggle).getAttribute('aria-pressed')).toBe('true');
        expect(inner(toggle).getAttribute('aria-label')).toBe('Bold');
    });

    it('paints the pressed state with the accent tokens, and the outline variant with a border', async () => {
        // Distinct token values: in the default theme --accent and --muted are the same colour.
        const page = await mount(`<div style="--accent: rgb(11, 22, 33); --muted: rgb(77, 88, 99)">
            <ge-toggle id="off">A</ge-toggle><ge-toggle id="on" pressed>B</ge-toggle><ge-toggle id="outline" variant="outline">C</ge-toggle></div>`);
        const style = (id: string) => getComputedStyle(inner(page.querySelector(`#${id}`)!));

        expect(style('off').backgroundColor).toBe('rgba(0, 0, 0, 0)');
        expect(style('on').backgroundColor).toBe('rgb(11, 22, 33)');
        expect([style('off').borderTopWidth, style('outline').borderTopWidth]).toEqual(['0px', '1px']);
    });

    it('is 36px tall, 32px small and 40px large, and scales with density', async () => {
        const page = await mount(`
            <ge-toggle id="d">A</ge-toggle><ge-toggle id="sm" size="sm">A</ge-toggle><ge-toggle id="lg" size="lg">A</ge-toggle>
            <div style="--density: 0.75"><ge-toggle id="dense">A</ge-toggle></div>
            <div style="--density: 0.75; --density-button: 1.25"><ge-toggle id="override">A</ge-toggle></div>`);
        const height = (id: string) => inner(page.querySelector(`#${id}`)!).getBoundingClientRect().height;

        expect(['d', 'sm', 'lg', 'dense', 'override'].map(height)).toEqual([36, 32, 40, 27, 45]);
    });

    it('draws a focus ring only for keyboard focus', async () => {
        const page = await mount('<ge-toggle>Go</ge-toggle>');
        const button = inner(first(page));

        await userEvent.tab();

        expect(button.matches(':focus-visible')).toBe(true);
        await vi.waitFor(() => expect(getComputedStyle(button).boxShadow).toMatch(/0px 0px 0px 3px/));
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-toggle>Bold</ge-toggle><ge-toggle pressed variant="outline">Italic</ge-toggle><ge-toggle disabled>Locked</ge-toggle>');

        expect((await axe.run(page, { rules: { region: { enabled: false } } })).violations.map((v) => v.id)).toEqual([]);
    });
});
