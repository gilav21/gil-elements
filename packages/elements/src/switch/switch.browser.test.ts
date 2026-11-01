import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../label/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeSwitch } from './switch.js';

const first = (page: HTMLElement) => page.querySelector<GeSwitch>('ge-switch')!;
const part = (el: Element, selector: string) => el.shadowRoot!.querySelector<HTMLElement>(selector)!;

describe('ge-switch', () => {
    it('toggles on click, announces it once, and a click on the label text counts too', async () => {
        const page = await mount('<ge-switch label="Airplane mode"></ge-switch>');
        const control = first(page);
        const events: string[] = [];
        control.addEventListener('input', () => events.push('input'));
        control.addEventListener('change', () => events.push('change'));

        part(control, '.track').click();
        expect(control.checked).toBe(true);
        part(control, '.label').click();
        expect(control.checked).toBe(false);

        expect(events).toEqual(['input', 'change', 'input', 'change']);
    });

    it('does nothing while disabled, directly or through a disabled fieldset', async () => {
        const page = await mount('<ge-switch id="direct" disabled></ge-switch><fieldset disabled><ge-switch id="inherited"></ge-switch></fieldset>');

        for (const id of ['direct', 'inherited']) part(page.querySelector(`#${id}`)!, '.track').click();

        expect([...page.querySelectorAll<GeSwitch>('ge-switch')].map((s) => s.checked)).toEqual([false, false]);
    });

    it('is a tab stop that Enter toggles on press and Space on release, and a disabled one skips', async () => {
        const page = await mount('<ge-switch id="a"></ge-switch><ge-switch id="skipped" disabled></ge-switch><ge-switch id="b"></ge-switch>');
        const [a, , b] = [...page.querySelectorAll<GeSwitch>('ge-switch')];

        await userEvent.tab();
        expect(document.activeElement).toBe(a);
        await userEvent.keyboard('{Enter}');
        expect(a.checked).toBe(true);
        await userEvent.keyboard('[Space>]');
        expect(a.checked).toBe(true);
        await userEvent.keyboard('[/Space]');
        expect(a.checked).toBe(false);

        await userEvent.tab();
        expect(document.activeElement).toBe(b);
    });

    it('exposes an on/off switch to assistive technology', async () => {
        await mount('<ge-switch aria-label="off"></ge-switch><ge-switch aria-label="on" checked></ge-switch><ge-switch aria-label="gone" disabled></ge-switch>');
        const session = cdp();
        await session.send('Accessibility.enable');
        const { frameTree } = await session.send('Page.getFrameTree');
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: frameTree.childFrames?.[0]?.frame.id });
        const read = (name: string) => {
            const node = nodes.find((n) => n.role?.value === 'switch' && n.name?.value === name);
            return Object.fromEntries((node?.properties ?? []).map((p) => [p.name, p.value.value]));
        };

        expect(read('off').checked).toBe('false');
        expect(read('on').checked).toBe('true');
        expect(read('gone').disabled).toBe(true);
    });

    it('is named by a ge-label elsewhere in the page, and clicking that label toggles it', async () => {
        const page = await mount('<ge-switch id="airplane"></ge-switch> <ge-label for="airplane">Airplane mode</ge-label>');

        page.querySelector<HTMLElement>('ge-label')!.click();

        expect(first(page).checked).toBe(true);
        expect((await axe.run(page)).violations).toEqual([]);
    });

    it('slides the thumb 1rem scaled by density, towards the end of the line in either direction', async () => {
        const page = await mount(`
            <ge-switch id="d1" checked></ge-switch>
            <div style="--density: 1.5"><ge-switch id="d15" checked></ge-switch></div>
            <div dir="rtl"><ge-switch id="rtl" checked></ge-switch></div>`);
        // How far the thumb sits from the start edge of the track, past its 2px border.
        const travel = (id: string) => {
            const el = page.querySelector(`#${id}`)!;
            const track = part(el, '.track').getBoundingClientRect();
            const thumb = part(el, '.thumb').getBoundingClientRect();
            return getComputedStyle(el).direction === 'rtl' ? track.right - 2 - thumb.right : thumb.left - track.left - 2;
        };

        expect([travel('d1'), travel('d15'), travel('rtl')]).toEqual([16, 24, 16]);
    });

    it('draws a focus ring only for keyboard focus', async () => {
        const page = await mount('<ge-switch></ge-switch>');
        const track = part(first(page), '.track');

        await userEvent.tab();
        expect(first(page).matches(':focus-visible')).toBe(true);
        expect(getComputedStyle(track).boxShadow).toMatch(/0px 0px 0px 4px/);
    });

    it('submits its value only while on and not disabled, and a form reset restores the markup', async () => {
        const page = await mount('<form><ge-switch name="a" checked></ge-switch><ge-switch name="b"></ge-switch><ge-switch name="c" checked disabled></ge-switch></form>');
        const form = page.querySelector('form')!;
        const [a, b] = page.querySelectorAll<GeSwitch>('ge-switch');
        const submitted = () => [...new FormData(form).keys()];

        expect(submitted()).toEqual(['a']);
        b.click();
        a.click();
        await Promise.all([a.updateComplete, b.updateComplete]);
        expect(submitted()).toEqual(['b']);

        form.reset();
        await Promise.all([a.updateComplete, b.updateComplete]);
        expect(submitted()).toEqual(['a']);
    });

    it.each(['light', 'dark'])('has no axe violations in %s mode, labelled and bare', async (mode) => {
        useTheme(mode);
        const page = await mount('<ge-switch label="Airplane mode"></ge-switch><ge-switch aria-label="Wi-Fi" checked></ge-switch><ge-switch aria-label="Locked" disabled></ge-switch>');

        expect((await axe.run(page)).violations).toEqual([]);
    });
});
