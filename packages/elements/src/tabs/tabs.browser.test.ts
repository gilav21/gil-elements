import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeTabs } from './tabs.js';
import type { GeTabsTrigger } from './sub/tabs-trigger.js';

const tabs = (page: HTMLElement) => page.querySelector<GeTabs>('ge-tabs')!;
const triggers = (root: ParentNode) => [...root.querySelectorAll<GeTabsTrigger>('ge-tabs-trigger')];
const button = (trigger: GeTabsTrigger) => trigger.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
/** The text of every rendered panel; a closed panel renders nothing. */
const panels = (root: ParentNode) =>
    [...root.querySelectorAll('ge-tabs-content')].flatMap((content) => (content.shadowRoot!.querySelector('[role=tabpanel]') ? [content.textContent?.trim()] : []));
const settle = async (root: ParentNode) => {
    await Promise.all([...root.querySelectorAll<HTMLElement & { updateComplete: Promise<boolean> }>('ge-tabs, ge-tabs-list, ge-tabs-trigger, ge-tabs-content')].map((el) => el.updateComplete));
};
const CUSTOM = (attrs = '') => `
    <ge-tabs ${attrs}>
        <ge-tabs-list aria-label="Settings">
            <ge-tabs-trigger value="account">Account</ge-tabs-trigger>
            <ge-tabs-trigger value="password">Password</ge-tabs-trigger>
            <ge-tabs-trigger value="team">Team</ge-tabs-trigger>
        </ge-tabs-list>
        <ge-tabs-content value="account">Make changes to your account.</ge-tabs-content>
        <ge-tabs-content value="password">Change your password.</ge-tabs-content>
        <ge-tabs-content value="team">Invite your team.</ge-tabs-content>
    </ge-tabs>`;

describe('ge-tabs', () => {
    it('shows only the panel of the active tab, switches on press, and announces each pick with its value, even a repeat', async () => {
        const page = await mount(CUSTOM('value="account"'));
        const picks: string[] = [];
        tabs(page).addEventListener('tab-change', (event) => picks.push((event as CustomEvent<string>).detail));
        await settle(page);
        const [account, password] = triggers(page);
        expect([panels(page), tabs(page).value]).toEqual([['Make changes to your account.'], 'account']);

        button(password).click();
        button(password).click();
        await settle(page);

        expect(panels(page)).toEqual(['Change your password.']);
        expect(picks).toEqual(['password', 'password']);
        expect([button(account).getAttribute('aria-selected'), button(password).getAttribute('aria-selected')]).toEqual(['false', 'true']);
    });

    it('starts with nothing active when no value is given in template mode', async () => {
        const page = await mount(CUSTOM());
        await settle(page);

        expect([panels(page), triggers(page).map((t) => button(t).getAttribute('aria-selected'))]).toEqual([[], ['false', 'false', 'false']]);
    });

    it('builds triggers and panels from tabs, opens the first one by default, disables one, and skips a tab without content', async () => {
        const page = await mount('<ge-tabs></ge-tabs>');
        tabs(page).tabs = [
            { value: 'a', label: 'Alpha', content: 'First.' },
            { value: 'b', label: 'Beta', content: 'Second.', disabled: true },
            { value: 'c', label: 'Gamma' },
        ];
        await tabs(page).updateComplete;
        const root = tabs(page).shadowRoot!;
        await settle(root);
        const [alpha, beta, gamma] = triggers(root);

        expect([tabs(page).value, panels(root)]).toEqual(['a', ['First.']]);
        expect([button(beta).disabled, button(alpha).disabled]).toEqual([true, false]);
        button(beta).click();
        button(gamma).click();
        await settle(root);
        expect([tabs(page).value, panels(root)]).toEqual(['c', []]);
    });

    it('puts only the active tab in the tab order and focuses the panel next', async () => {
        const page = await mount(`<button id="before">before</button>${CUSTOM('value="password"')}`);
        await settle(page);
        const [, password] = triggers(page);

        expect(triggers(page).map((t) => button(t).tabIndex)).toEqual([-1, 0, -1]);
        page.querySelector<HTMLElement>('#before')!.focus();
        await userEvent.tab();
        expect(document.activeElement).toBe(password);
        await userEvent.tab();
        expect(document.activeElement).toBe(page.querySelector('ge-tabs-content[value=password]'));
    });

    it('lets Enter and Space pick the focused tab', async () => {
        const page = await mount(CUSTOM('value="account"'));
        await settle(page);
        const [, password, team] = triggers(page);

        password.focus();
        await userEvent.keyboard('{Enter}');
        expect(tabs(page).value).toBe('password');
        team.focus();
        await userEvent.keyboard(' ');
        expect(tabs(page).value).toBe('team');
    });

    it('exposes a named tab list, tabs with their selected state, and a panel named after its tab', async () => {
        const page = await mount(CUSTOM('value="password"'));
        await settle(page);
        const session = cdp();
        await session.send('Accessibility.enable');
        // The test page runs in an iframe of the runner, so ask for that frame's tree.
        const { frameTree } = await session.send('Page.getFrameTree');
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: frameTree.childFrames?.[0]?.frame.id });
        const props = (node?: (typeof nodes)[number]) => Object.fromEntries((node?.properties ?? []).map((p) => [p.name, p.value.value]));
        const tab = (name: string) => props(nodes.find((n) => n.role?.value === 'tab' && n.name?.value === name));

        expect(nodes.find((n) => n.role?.value === 'tablist' && n.name?.value === 'Settings')).toBeDefined();
        expect(['Account', 'Password', 'Team'].map((name) => tab(name).selected)).toEqual([false, true, false]);
        expect(nodes.find((n) => n.role?.value === 'tabpanel' && n.name?.value === 'Password')).toBeDefined();
    });

    it('shows placeholder tabs, as many as asked for, in place of the triggers', async () => {
        const page = await mount('<ge-tabs><ge-tabs-list skeleton skeleton-count="4"><ge-tabs-trigger value="x">X</ge-tabs-trigger></ge-tabs-list></ge-tabs>');
        const list = page.querySelector('ge-tabs-list')!;
        await list.updateComplete;

        expect([list.shadowRoot!.querySelectorAll('ge-skeleton').length, list.shadowRoot!.querySelector('[role=tablist]')]).toEqual([4, null]);
    });

    it.each(['light', 'dark'])('passes axe in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(CUSTOM('value="account"'));
        await settle(page);

        expect((await axe.run(page)).violations).toEqual([]);
    });

    it('scales the trigger padding with the tabs density token, and keeps the bar 2.25rem tall', async () => {
        const page = await mount(CUSTOM('value="account" style="--density-tabs: 1.5"'));
        await settle(page);
        const style = getComputedStyle(button(triggers(page)[0]));
        const bar = page.querySelector('ge-tabs-list')!.shadowRoot!.querySelector('.list')!.getBoundingClientRect();

        expect([style.paddingLeft, style.paddingTop, bar.height]).toEqual(['18px', '6px', 36]);
    });
});
