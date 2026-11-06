import axe from 'axe-core';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount, useTheme } from '../test-utils.js';
import type { GeTree } from '../tree/index.js';
import type { GeTreeSelect, TreeNode } from './index.js';

const NODES: TreeNode[] = [
    { key: 'docs', label: 'Documents', children: [{ key: 'intro', label: 'Introduction' }, { key: 'guide', label: 'Guide' }] },
    { key: 'src', label: 'Source' },
];

const select = (page: HTMLElement) => page.querySelector<GeTreeSelect>('ge-tree-select')!;
const trigger = (el: GeTreeSelect) => el.shadowRoot!.querySelector<HTMLButtonElement>('.trigger')!;
const label = (el: GeTreeSelect) => trigger(el).querySelector('.label')!.textContent!.trim();
const panel = (el: GeTreeSelect) => el.shadowRoot!.querySelector<HTMLElement>('ge-popover-content')!;
const tree = (el: GeTreeSelect) => el.shadowRoot!.querySelector<GeTree>('ge-tree');
const item = (el: GeTreeSelect, key: string) => tree(el)!.querySelector<HTMLElement & { updateComplete: Promise<boolean> }>(`ge-tree-item[value="${key}"]`)!;
const header = (el: GeTreeSelect, key: string) => item(el, key).shadowRoot!.querySelector<HTMLElement>('.header')!;
const settle = async (el: GeTreeSelect) => {
    for (let round = 0; round < 3; round++) {
        await el.updateComplete;
        for (const part of el.shadowRoot!.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await part.updateComplete;
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    }
};
const mountSelect = async (attrs = '', nodes: TreeNode[] = NODES) => {
    const page = await mount(`<form><ge-tree-select ${attrs}></ge-tree-select></form>`);
    const el = select(page);
    el.nodes = nodes;
    await settle(el);
    return { page, el };
};
const log = (el: GeTreeSelect) => {
    const seen: string[] = [];
    el.addEventListener('selection-change', (event) => seen.push(`selection-change:${JSON.stringify((event as CustomEvent<string[]>).detail)}`));
    el.addEventListener('change', () => seen.push('change'));
    el.addEventListener('open-change', (event) => seen.push(`open-change:${(event as CustomEvent<boolean>).detail}`));
    return seen;
};
/** Opens the panel the way a user does, and waits for the tree to render and take focus. */
const open = async (el: GeTreeSelect) => {
    trigger(el).click();
    await settle(el);
    await expect.poll(() => tree(el)?.focusedKey !== undefined && tree(el) !== null).toBe(true);
};
const expandDocs = async (el: GeTreeSelect) => {
    item(el, 'docs').shadowRoot!.querySelector<HTMLElement>('.expand')!.click();
    await settle(el);
};

describe('ge-tree-select', () => {
    it('shows the placeholder, then the label of the selected node, nested ones included', async () => {
        const { el } = await mountSelect();
        expect(label(el)).toBe('Select...');
        expect(trigger(el).getAttribute('aria-label')).toBe('Select...');

        el.value = 'intro';
        await settle(el);
        expect(label(el)).toBe('Introduction');

        // A key with no node is a placeholder, not an empty box.
        el.value = 'gone';
        await settle(el);
        expect(label(el)).toBe('Select...');

        el.placeholder = 'Pick a folder';
        await settle(el);
        expect(label(el)).toBe('Pick a folder');
        expect(trigger(el).getAttribute('aria-label')).toBe('Pick a folder');
    });

    it('opens a panel as wide as the trigger with the tree, and points the tree at the selected node', async () => {
        const { el } = await mountSelect('value="guide"');
        el.style.display = 'block';
        el.style.width = '260px';
        await settle(el);
        expect(tree(el)).toBeNull();
        expect(trigger(el).getAttribute('aria-expanded')).toBe('false');

        const seen = log(el);
        trigger(el).click();
        await settle(el);
        expect(trigger(el).getAttribute('aria-expanded')).toBe('true');
        expect(seen).toEqual(['open-change:true']);
        expect(tree(el)).not.toBeNull();
        expect(panel(el).shadowRoot!.querySelector('.panel')!.getBoundingClientRect().width).toBeCloseTo(trigger(el).getBoundingClientRect().width, 0);
        // The tree takes focus on the row of the current value, which is nested: that branch is not open, so the key is still its target.
        await expect.poll(() => tree(el)!.focusedKey).toBe('guide');
        expect(trigger(el).getAttribute('aria-controls')).toBe(panel(el).id);
    });

    it('turns the expand chevron and the arrow keys the RTL way when the select is in Hebrew', async () => {
        const { el } = await mountSelect('locale="he"');
        await open(el);
        const tree = el.shadowRoot!.querySelector<GeTree>('ge-tree')!;
        expect(getComputedStyle(tree).direction).toBe('rtl');
        const chevron = item(el, 'docs').shadowRoot!.querySelector<HTMLElement>('.expand')!;
        await expect.poll(() => getComputedStyle(chevron).transform).toBe('matrix(-1, 0, 0, -1, 0, 0)');
    });

    it('picks a node: sets the value, fires selection-change and change once, closes, and the form submits the key', async () => {
        const { page, el } = await mountSelect('name="folder"');
        const seen = log(el);
        await open(el);
        await expandDocs(el);
        header(el, 'intro').click();
        await settle(el);

        expect(el.value).toBe('intro');
        expect(label(el)).toBe('Introduction');
        expect(seen).toEqual(['open-change:true', 'selection-change:["intro"]', 'change', 'open-change:false']);
        expect(trigger(el).getAttribute('aria-expanded')).toBe('false');
        expect(tree(el)).toBeNull();
        expect(new FormData(page.querySelector('form')!).get('folder')).toBe('intro');

        // Reopened, the tree starts clean (as in shadcn-angular), so choosing the same node again selects it again.
        await open(el);
        header(el, 'src').click();
        await settle(el);
        expect(el.value).toBe('src');
        expect(new FormData(page.querySelector('form')!).get('folder')).toBe('src');
    });

    it('stays out of the form until named and picked, and a form reset restores the starting value', async () => {
        const { page, el } = await mountSelect('name="folder" value="src"');
        const form = page.querySelector('form')!;
        expect(new FormData(form).get('folder')).toBe('src');
        el.select('docs');
        await settle(el);
        expect(new FormData(form).get('folder')).toBe('docs');
        form.reset();
        await settle(el);
        expect(el.value).toBe('src');
        expect(label(el)).toBe('Source');
        el.select(null);
        await settle(el);
        expect(new FormData(form).has('folder')).toBe(false);
    });

    it('toggles from the trigger: a second click closes it', async () => {
        const { el } = await mountSelect();
        trigger(el).click();
        await settle(el);
        expect(el.open).toBe(true);
        trigger(el).click();
        await settle(el);
        expect(el.open).toBe(false);
    });

    it('closes on Escape and on a click outside, without picking anything', async () => {
        const { page, el } = await mountSelect();
        const seen = log(el);
        await open(el);
        await userEvent.keyboard('{Escape}');
        await settle(el);
        expect(trigger(el).getAttribute('aria-expanded')).toBe('false');

        await open(el);
        page.ownerDocument.body.click();
        await settle(el);
        expect(trigger(el).getAttribute('aria-expanded')).toBe('false');
        expect(el.value).toBeNull();
        expect(seen).toEqual(['open-change:true', 'open-change:false', 'open-change:true', 'open-change:false']);
    });

    it('cannot be opened while disabled, by attribute or by an enclosing fieldset', async () => {
        const page = await mount('<fieldset><ge-tree-select></ge-tree-select></fieldset><ge-tree-select disabled></ge-tree-select>');
        const [inFieldset, plain] = [...page.querySelectorAll<GeTreeSelect>('ge-tree-select')] as [GeTreeSelect, GeTreeSelect];
        for (const el of [inFieldset, plain]) {
            el.nodes = NODES;
            await settle(el);
        }
        expect(trigger(plain).disabled).toBe(true);
        plain.show();
        await settle(plain);
        expect(tree(plain)).toBeNull();

        page.querySelector('fieldset')!.disabled = true;
        await settle(inFieldset);
        expect(trigger(inFieldset).disabled).toBe(true);
        expect(inFieldset.isDisabled).toBe(true);
    });

    it('works with projected content: the popover opens from the trigger, and select() picks, fires and closes', async () => {
        const page = await mount(`<ge-tree-select>
            <ge-tree-select-trigger><ge-popover-trigger><ge-button variant="outline">Choose</ge-button></ge-popover-trigger></ge-tree-select-trigger>
            <ge-tree-select-content><ge-popover-content align="start" strategy="fixed"><ge-button id="pick" variant="ghost">Pick source</ge-button></ge-popover-content></ge-tree-select-content>
        </ge-tree-select>`);
        const el = select(page);
        await settle(el);
        const seen = log(el);
        const wrapper = page.querySelector('ge-popover-trigger')!.shadowRoot!.querySelector<HTMLElement>('[part="base"]')!;
        expect(el.isDataDriven).toBe(false);

        wrapper.click();
        await settle(el);
        expect(seen).toEqual(['open-change:true']);
        const content = page.querySelector('ge-popover-content')!;
        await expect.poll(() => content.shadowRoot!.querySelector('.panel') !== null).toBe(true);
        // The panel hangs from the projected trigger, found through the light DOM.
        await expect.poll(() => Math.abs(content.shadowRoot!.querySelector('.panel')!.getBoundingClientRect().top - (wrapper.getBoundingClientRect().bottom + 4))).toBeLessThan(2);

        page.querySelector<HTMLElement>('#pick')!.addEventListener('click', () => el.select('src'));
        page.querySelector<HTMLElement>('#pick')!.click();
        await settle(el);
        expect(el.value).toBe('src');
        expect(seen).toEqual(['open-change:true', 'selection-change:["src"]', 'change', 'open-change:false']);
        await expect.poll(() => content.shadowRoot!.querySelector('.panel')).toBeNull();
    });

    it('takes its placeholder and direction from the locale', async () => {
        const { el } = await mountSelect('locale="he"');
        expect(label(el)).toBe('...בחר');
        expect(el.shadowRoot!.querySelector('.root')!.getAttribute('dir')).toBe('rtl');
    });

    it('has no accessibility violations closed or open, in either theme', async () => {
        const { page, el } = await mountSelect('value="src"');
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            await expect.poll(async () => (await axe.run(page)).violations.map((v) => v.id)).toEqual([]);
        }
        await open(el);
        for (const mode of ['light', 'dark']) {
            useTheme(mode);
            await expect.poll(async () => (await axe.run(page)).violations.map((v) => v.id)).toEqual([]);
        }
    });
});
