import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import '../button/define.js';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeCollapsible } from './collapsible.js';

const root = (page: HTMLElement) => page.querySelector<GeCollapsible>('ge-collapsible')!;
const trigger = (page: HTMLElement) => page.querySelector('ge-collapsible-trigger')!;
const panel = (page: HTMLElement) => page.querySelector('ge-collapsible-content')!.shadowRoot!.querySelector('.panel');
const control = (page: HTMLElement) => trigger(page).shadowRoot!.querySelector<HTMLElement>('[data-slot=collapsible-trigger]')!;
const settle = async (page: HTMLElement) => {
    await root(page).updateComplete;
    await trigger(page).updateComplete;
    await page.querySelector('ge-collapsible-content')!.updateComplete;
};
const LABELLED = (attrs = '') => `
    <ge-collapsible ${attrs}>
        <ge-collapsible-trigger>Show more</ge-collapsible-trigger>
        <ge-collapsible-content><p>Hidden until it is opened.</p></ge-collapsible-content>
    </ge-collapsible>`;

describe('ge-collapsible', () => {
    it('renders the panel only while open, starts open from the attribute, and announces each change with the new state', async () => {
        const page = await mount(LABELLED());
        const states: boolean[] = [];
        root(page).addEventListener('open-change', (event) => states.push((event as CustomEvent<boolean>).detail));
        await settle(page);
        expect(panel(page)).toBeNull();

        control(page).click();
        await settle(page);
        expect([panel(page) === null, root(page).hasAttribute('open'), root(page).dataset.state]).toEqual([false, true, 'open']);
        control(page).click();
        await settle(page);

        expect([panel(page), root(page).dataset.state, states]).toEqual([null, 'closed', [true, false]]);
        const opened = await mount(LABELLED('open'));
        await settle(opened);
        expect(panel(opened)).not.toBeNull();
    });

    it('is a button that Enter and Space toggle, with aria-expanded following the state', async () => {
        const page = await mount(LABELLED());

        await userEvent.tab();
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect([document.activeElement, control(page).getAttribute('aria-expanded')]).toEqual([trigger(page), 'true']);
        await userEvent.keyboard(' ');
        await settle(page);

        expect(control(page).getAttribute('aria-expanded')).toBe('false');
        expect(control(page).getAttribute('role')).toBe('button');
    });

    it('blocks toggle() and show() while disabled but lets hide() close it, and announces show() and hide() even when nothing changes', async () => {
        const page = await mount(LABELLED('open'));
        const events: boolean[] = [];
        root(page).addEventListener('open-change', (event) => events.push((event as CustomEvent<boolean>).detail));
        root(page).disabled = true;
        await settle(page);

        expect(control(page).getAttribute('aria-disabled')).toBe('true');
        control(page).click();
        root(page).show();
        root(page).toggle();
        expect(events).toEqual([]);
        root(page).hide();
        await settle(page);
        expect([root(page).open, panel(page), events]).toEqual([false, null, [false]]);
        root(page).disabled = false;
        root(page).hide();
        root(page).show();
        root(page).show();
        expect(events).toEqual([false, false, true, true]);
    });

    it('stays out of the way of a control it wraps: no second tab stop, no role, one toggle per click or key press', async () => {
        const page = await mount(`
            <ge-collapsible disabled>
                <ge-collapsible-trigger><ge-button variant="outline">Toggle</ge-button></ge-collapsible-trigger>
                <ge-collapsible-content>Body</ge-collapsible-content>
            </ge-collapsible>
            <ge-collapsible id="wrapped">
                <ge-collapsible-trigger><div><button type="button">Native</button></div><input aria-label="Search" /></ge-collapsible-trigger>
            </ge-collapsible>`);
        const [first, second] = [...page.querySelectorAll<GeCollapsible>('ge-collapsible')];
        await settle(page);
        await second.querySelector('ge-collapsible-trigger')!.updateComplete;
        const wrapper = (collapsible: Element) => collapsible.querySelector('ge-collapsible-trigger')!.shadowRoot!.querySelector('[data-slot=collapsible-trigger]')!;
        const bare = (el: Element) => ['role', 'tabindex', 'aria-expanded', 'aria-disabled'].map((name) => el.getAttribute(name));

        expect([bare(wrapper(first)), bare(wrapper(second))]).toEqual([[null, null, null, null], [null, null, null, null]]);
        const input = second.querySelector('input')!;
        input.focus();
        await userEvent.keyboard('a b');
        expect([input.value, second.open]).toEqual(['a b', false]);
        first.disabled = false;
        await first.updateComplete;
        page.querySelector<HTMLElement>('ge-button')!.focus();
        await userEvent.keyboard('{Enter}');
        await settle(page);
        expect(panel(page)).not.toBeNull();
        page.querySelector<HTMLElement>('ge-button')!.click();
        await settle(page);
        expect(panel(page)).toBeNull();
    });

    it('keeps Space from scrolling the page when the wrapper is the button', async () => {
        const page = await mount(LABELLED());
        await settle(page);
        const space = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
        const other = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
        control(page).dispatchEvent(space);
        control(page).dispatchEvent(other);

        expect([space.defaultPrevented, other.defaultPrevented]).toEqual([true, false]);
    });

    it('exposes one expandable button, and passes axe in both themes', async () => {
        const page = await mount(LABELLED('open'));
        await settle(page);
        const session = cdp();
        await session.send('Accessibility.enable');
        // The test page runs in an iframe of the runner, so ask for that frame's tree.
        const { frameTree } = await session.send('Page.getFrameTree');
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: frameTree.childFrames?.[0]?.frame.id });
        const button = nodes.find((n) => n.role?.value === 'button' && n.name?.value === 'Show more');
        const props = Object.fromEntries((button?.properties ?? []).map((p) => [p.name, p.value.value]));
        expect(props.expanded).toBe(true);

        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            expect((await axe.run(page)).violations).toEqual([]);
        }
    });
});
