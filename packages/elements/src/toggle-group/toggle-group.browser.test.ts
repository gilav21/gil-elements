import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeToggleGroup } from './toggle-group.js';
import type { GeToggleGroupItem } from './sub/toggle-group-item.js';

const group = (page: HTMLElement) => page.querySelector<GeToggleGroup>('ge-toggle-group')!;
const items = (page: HTMLElement) => [...page.querySelectorAll<GeToggleGroupItem>('ge-toggle-group-item')];
const button = (item: GeToggleGroupItem) => item.shadowRoot!.querySelector<HTMLButtonElement>('button')!;
const pressed = (page: HTMLElement) => items(page).map((item) => button(item).getAttribute('aria-pressed'));
const settle = async (page: HTMLElement) => {
    await group(page).updateComplete;
    await Promise.all(items(page).map((item) => item.updateComplete));
};
const FONT = (attrs = '') => `
    <ge-toggle-group aria-label="Text style" ${attrs}>
        <ge-toggle-group-item value="bold">Bold</ge-toggle-group-item>
        <ge-toggle-group-item value="italic">Italic</ge-toggle-group-item>
        <ge-toggle-group-item value="underline">Underline</ge-toggle-group-item>
    </ge-toggle-group>`;

describe('ge-toggle-group', () => {
    it('single: one item on at a time, clicking the one that is on clears it, and each change is announced once', async () => {
        const page = await mount(FONT());
        const events: string[] = [];
        group(page).addEventListener('input', () => events.push('input'));
        group(page).addEventListener('change', () => events.push('change'));
        const [bold, italic] = items(page);

        button(bold).click();
        button(italic).click();
        await settle(page);
        expect([group(page).value, pressed(page)]).toEqual(['italic', ['false', 'true', 'false']]);
        button(italic).click();
        await settle(page);

        expect([group(page).value, pressed(page)]).toEqual(['', ['false', 'false', 'false']]);
        expect(events).toEqual(['input', 'change', 'input', 'change', 'input', 'change']);
    });

    it('multiple: items accumulate and leave one by one, value is the array, and the attribute is a comma list', async () => {
        const page = await mount(FONT('type="multiple" value="bold,underline"'));
        await settle(page);
        const [bold, italic] = items(page);
        expect(pressed(page)).toEqual(['true', 'false', 'true']);

        button(italic).click();
        button(bold).click();
        await settle(page);

        expect([group(page).value, pressed(page)]).toEqual([['underline', 'italic'], ['false', 'true', 'true']]);
    });

    it('does nothing for a disabled item or a disabled group', async () => {
        const page = await mount(`${FONT()}
            <ge-toggle-group id="off" disabled aria-label="Off"><ge-toggle-group-item value="x">X</ge-toggle-group-item></ge-toggle-group>
            <ge-toggle-group id="one" aria-label="One"><ge-toggle-group-item value="y" disabled>Y</ge-toggle-group-item></ge-toggle-group>`);
        const [, , , x, y] = items(page);
        await settle(page);

        expect([button(x).disabled, button(y).disabled]).toEqual([true, true]);
        x.click();
        y.click();
        button(x).click();
        button(y).click();
        page.querySelector<GeToggleGroup>('#off')!.toggle('x');
        expect([...page.querySelectorAll<GeToggleGroup>('ge-toggle-group')].map((g) => g.value)).toEqual([undefined, undefined, undefined]);
    });

    it('is reached by Tab one item at a time and toggled by Space and Enter', async () => {
        const page = await mount(FONT());
        const [bold, italic] = items(page);

        await userEvent.tab();
        await userEvent.keyboard(' ');
        await userEvent.tab();
        await userEvent.keyboard('{Enter}');
        await settle(page);

        expect([document.activeElement, group(page).value]).toEqual([italic, 'italic']);
        expect(bold.matches(':focus-within')).toBe(false);
    });

    it('builds one item per option, labelled and disabled from the data, ahead of any projected items', async () => {
        const page = await mount('<ge-toggle-group aria-label="Align" type="multiple"><ge-toggle-group-item value="extra">Extra</ge-toggle-group-item></ge-toggle-group>');
        const g = group(page);
        g.options = [{ value: 'left', label: 'Left' }, { value: 'right', label: 'Right', disabled: true }];
        g.value = ['left'];
        await g.updateComplete;
        const rendered = [...g.shadowRoot!.querySelectorAll<GeToggleGroupItem>('ge-toggle-group-item')];
        await Promise.all(rendered.map((item) => item.updateComplete));

        expect(rendered.map((item) => [item.value, item.textContent?.trim(), button(item).getAttribute('aria-label'), button(item).disabled, button(item).dataset.state])).toEqual([
            ['left', 'Left', 'Left', false, 'on'],
            ['right', 'Right', 'Right', true, 'off'],
        ]);
        const corners = rendered.map((item) => {
            const s = getComputedStyle(button(item));
            return [s.borderTopLeftRadius, s.borderTopRightRadius].map((r) => r !== '0px');
        });
        expect(corners).toEqual([[true, false], [false, true]]);
        button(rendered[1]).click();
        button(rendered[0]).click();
        button(items(page)[0]).click();
        expect(g.value).toEqual(['extra']);
    });

    it('joins items flush with only the outer corners round, in both text directions', async () => {
        const page = await mount(`<div dir="rtl">${FONT('variant="outline"')}</div>`);
        await settle(page);
        const radii = items(page).map((item) => {
            const s = getComputedStyle(button(item));
            return [s.borderTopLeftRadius, s.borderTopRightRadius].map((r) => r !== '0px');
        });

        // In RTL the first item is on the right.
        expect(radii).toEqual([[false, true], [false, false], [true, false]]);
    });

    it('draws the join darker next to an item that is on, on whichever side it is, and only for outline', async () => {
        const page = await mount(`${FONT('variant="outline" type="multiple" value="italic"')}${FONT('type="multiple" value="italic"')}`);
        await Promise.all([...page.querySelectorAll<GeToggleGroup>('ge-toggle-group')].map((g) => g.updateComplete));
        await settle(page);
        const divider = items(page).map((item) => button(item).hasAttribute('data-divider'));

        expect(divider).toEqual([true, true, false, false, false, false]);
    });

    it('exposes a named group of toggle buttons with their pressed state to assistive technology', async () => {
        const page = await mount(FONT('value="italic"'));
        await settle(page);
        const session = cdp();
        await session.send('Accessibility.enable');
        // The test page runs in an iframe of the runner, so ask for that frame's tree.
        const { frameTree } = await session.send('Page.getFrameTree');
        const { nodes } = await session.send('Accessibility.getFullAXTree', { frameId: frameTree.childFrames?.[0]?.frame.id });
        const props = (node?: (typeof nodes)[number]) => Object.fromEntries((node?.properties ?? []).map((p) => [p.name, p.value.value]));
        const toggle = (name: string) => props(nodes.find((n) => n.role?.value === 'button' && n.name?.value === name));

        expect(nodes.find((n) => n.role?.value === 'group' && n.name?.value === 'Text style')).toBeDefined();
        expect(['Bold', 'Italic', 'Underline'].map((name) => toggle(name).pressed)).toEqual(['false', 'true', 'false']);
    });

    it.each(['light', 'dark'])('passes axe in %s mode', async (mode) => {
        useTheme(mode);
        const page = await mount(FONT('variant="outline" value="bold"'));
        await settle(page);

        expect((await axe.run(page)).violations).toEqual([]);
    });

    it('scales height and padding with the button density token', async () => {
        const page = await mount(`<ge-toggle-group style="--density-button: 1.5" aria-label="d"><ge-toggle-group-item value="a">A</ge-toggle-group-item></ge-toggle-group>`);
        await settle(page);
        const s = getComputedStyle(button(items(page)[0]));

        expect([s.height, s.paddingLeft]).toEqual(['54px', '18px']);
    });
});
