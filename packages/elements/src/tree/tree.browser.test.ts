import axe from 'axe-core';
import { html } from 'lit';
import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeTree, TreeNode } from './tree.js';
import type { GeTreeItem } from './sub/tree-item.js';

const tree = (page: HTMLElement) => page.querySelector<GeTree>('ge-tree')!;
const item = (page: HTMLElement, value: string) => page.querySelector<GeTreeItem>(`ge-tree-item[value="${value}"]`)!;
const row = (it: GeTreeItem) => it.shadowRoot!.querySelector<HTMLElement>('.header')!;
const chevron = (it: GeTreeItem) => it.shadowRoot!.querySelector<HTMLButtonElement>('.expand')!;
const settle = async (page: HTMLElement) => {
    await tree(page).updateComplete;
    for (const it of page.querySelectorAll<GeTreeItem>('ge-tree-item')) await it.updateComplete;
    await tree(page).updateComplete;
};
const press = async (page: HTMLElement, key: string) => {
    tree(page).dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    await settle(page);
};
const focused = (page: HTMLElement) => tree(page).focusedKey;
const open = (page: HTMLElement) => [...tree(page).expandedKeys];

const SLOTTED = (attrs = '') => `
    <ge-tree ${attrs}>
        <ge-tree-item value="src"><ge-tree-label>src</ge-tree-label>
            <ge-tree-item value="app"><ge-tree-label>app</ge-tree-label>
                <ge-tree-item value="main"><ge-tree-label>main.ts</ge-tree-label></ge-tree-item>
            </ge-tree-item>
            <ge-tree-item value="index"><ge-tree-label>index.html</ge-tree-label></ge-tree-item>
        </ge-tree-item>
        <ge-tree-item value="readme"><ge-tree-label>README.md</ge-tree-label></ge-tree-item>
        <ge-tree-item value="docs"><ge-tree-label>docs</ge-tree-label></ge-tree-item>
    </ge-tree>`;

const NODES: TreeNode[] = [
    { key: 'src', label: 'src', icon: '📁', children: [
        { key: 'app', label: 'app', icon: '📁', children: [{ key: 'main', label: 'main.ts', icon: '📄' }] },
        { key: 'index', label: 'index.html', icon: '📄' },
    ] },
    { key: 'readme', label: 'README.md', icon: '📄' },
];

describe('ge-tree', () => {
    it('is one tab stop whose roles, states and active descendant follow expansion, selection and focus', async () => {
        const page = await mount(SLOTTED('selectable="multiple"'));
        const t = tree(page);
        expect([t.getAttribute('role'), t.tabIndex, t.getAttribute('aria-multiselectable'), t.hasAttribute('aria-activedescendant')]).toEqual(['tree', 0, 'true', false]);
        const src = item(page, 'src');
        const docs = item(page, 'docs');
        src.id = 'mine';
        src.remove();
        t.prepend(src);
        await settle(page);
        expect(src.id).toBe('mine');
        expect([src.getAttribute('role'), src.getAttribute('aria-expanded'), docs.hasAttribute('aria-expanded'), src.getAttribute('aria-selected')]).toEqual(['treeitem', 'false', false, 'false']);

        row(docs).click();
        await settle(page);
        expect([t.getAttribute('aria-activedescendant'), docs.id !== '', docs.dataset.selected, docs.dataset.focused, docs.getAttribute('aria-selected')]).toEqual([docs.id, true, 'true', 'true', 'true']);
        chevron(src).click();
        await settle(page);
        expect([src.getAttribute('aria-expanded'), src.dataset.selected, src.dataset.expanded]).toEqual(['true', 'false', 'true']);
    });

    it('selects by mode: none ignores clicks, single replaces, multiple accumulates and toggles, and each change reports every key', async () => {
        const run = async (mode: string, clicks: string[]) => {
            const page = await mount(SLOTTED(`selectable="${mode}"`));
            const seen: string[][] = [];
            tree(page).addEventListener('selection-change', (e) => seen.push((e as CustomEvent<string[]>).detail));
            for (const key of clicks) {
                row(item(page, key)).click();
                await settle(page);
            }
            return { seen, hasAria: item(page, 'readme').hasAttribute('aria-selected') };
        };
        expect(await run('none', ['readme'])).toEqual({ seen: [], hasAria: false });
        expect((await run('single', ['readme', 'docs', 'docs'])).seen).toEqual([['readme'], ['docs'], []]);
        expect((await run('multiple', ['readme', 'docs', 'readme'])).seen).toEqual([['readme'], ['readme', 'docs'], ['docs']]);
    });

    it('expands and collapses with the chevron, keeping descendants\' own state, and announces the full set', async () => {
        const page = await mount(SLOTTED());
        const seen: string[][] = [];
        tree(page).addEventListener('expand-change', (e) => seen.push((e as CustomEvent<string[]>).detail));
        const group = (key: string) => item(page, key).shadowRoot!.querySelector<HTMLElement>('.group')!;
        expect(group('src').hidden).toBe(true);
        chevron(item(page, 'src')).click();
        await settle(page);
        chevron(item(page, 'app')).click();
        chevron(item(page, 'src')).click();
        await settle(page);
        expect([seen, group('src').hidden]).toEqual([[['src'], ['src', 'app'], ['app']], true]);
        chevron(item(page, 'src')).click();
        await settle(page);
        expect([open(page), group('app').hidden]).toEqual([['app', 'src'], false]);
    });

    it('walks the visible nodes with the keyboard, expanding, stepping in, collapsing and climbing out', async () => {
        const page = await mount(SLOTTED('selectable="single"'));
        const trail: (string | null)[] = [];
        const key = async (k: string) => {
            await press(page, k);
            trail.push(focused(page));
        };
        await key('ArrowDown'); // first node
        await key('ArrowDown'); // README: src is collapsed so its children are skipped
        await key('ArrowUp');
        await key('ArrowRight'); // opens src
        await key('ArrowRight'); // steps into app
        await key('ArrowRight'); // opens app
        await key('ArrowDown'); // main
        await key('ArrowLeft'); // a leaf climbs to its parent and closes it
        await key('End');
        await key('Home');
        expect(trail).toEqual(['src', 'readme', 'src', 'src', 'app', 'app', 'main', 'app', 'docs', 'src']);
        expect(open(page)).toEqual(['src']);
        await press(page, 'ArrowLeft'); // closes src
        await press(page, 'Enter');
        await press(page, ' ');
        expect([open(page), tree(page).selectedKeys.size]).toEqual([[], 0]);
        await press(page, 'Enter');
        expect([...tree(page).selectedKeys]).toEqual(['src']);
    });

    it('opens every visible parent with *, starts from the last node on ArrowUp, and leaves modified keys to the browser', async () => {
        const page = await mount(SLOTTED());
        await press(page, '*');
        expect(open(page)).toEqual(['src']);
        await press(page, '*');
        expect(open(page).sort()).toEqual(['app', 'src']);
        await press(page, 'ArrowUp');
        expect(focused(page)).toBe('docs');
        const down = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
        tree(page).dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);
        await press(page, 'Home');
        await press(page, 'End');
        const ctrl = new KeyboardEvent('keydown', { key: 'ArrowDown', ctrlKey: true, bubbles: true, cancelable: true });
        tree(page).dispatchEvent(ctrl);
        const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
        tree(page).dispatchEvent(tab);
        expect([ctrl.defaultPrevented, tab.defaultPrevented, focused(page)]).toEqual([false, false, 'docs']);
    });

    it('swaps the expand and collapse arrows in a right-to-left page', async () => {
        const page = await mount(`<div dir="rtl">${SLOTTED()}</div>`);
        await press(page, 'Home');
        await press(page, 'ArrowLeft');
        expect(open(page)).toEqual(['src']);
        await press(page, 'ArrowRight');
        expect(open(page)).toEqual([]);
        expect(item(page, 'src').hasAttribute('data-rtl')).toBe(true);
    });

    it('counts child items for the chevron unless has-nested overrides it, so a lazy branch can load later', async () => {
        const page = await mount(`<ge-tree>
            <ge-tree-item value="lazy" has-nested><ge-tree-label>lazy</ge-tree-label></ge-tree-item>
            <ge-tree-item value="leaf" has-nested="false"><ge-tree-label>leaf</ge-tree-label><ge-tree-item value="hidden"></ge-tree-item></ge-tree-item>
            <ge-tree-item value="plain"><ge-tree-label>plain</ge-tree-label></ge-tree-item>
        </ge-tree>`);
        expect(['lazy', 'leaf', 'plain'].map((key) => chevron(item(page, key)) !== null)).toEqual([true, false, false]);
        const plain = item(page, 'plain');
        plain.insertAdjacentHTML('beforeend', '<ge-tree-item value="late"></ge-tree-item>');
        await settle(page);
        expect(plain.getAttribute('aria-expanded')).toBe('false');
        expect(chevron(plain)).not.toBeNull();
    });

    it('draws the data property, opening levels by initial-expand-depth and again whenever data changes', async () => {
        const page = await mount('<ge-tree selectable="single"></ge-tree>');
        const t = tree(page);
        const seen: string[][] = [];
        t.addEventListener('expand-change', (e) => seen.push((e as CustomEvent<string[]>).detail));
        const labels = () => [...page.querySelectorAll('ge-tree-item')].map((it) => it.getAttribute('value'));
        t.data = NODES;
        await settle(page);
        expect([labels(), seen]).toEqual([['src', 'readme'], []]);
        t.initialExpandDepth = 1;
        await settle(page);
        expect([labels(), seen]).toEqual([['src', 'app', 'index', 'readme'], [['src']]]);
        t.initialExpandDepth = -1;
        await settle(page);
        expect(labels()).toEqual(['src', 'app', 'main', 'index', 'readme']);
        // data changes discard the user's expansion
        t.collapseAll();
        t.data = [...NODES];
        await settle(page);
        expect([labels(), seen.at(-1)]).toEqual([['src', 'app', 'main', 'index', 'readme'], ['src', 'app']]);
        const src = item(page, 'src');
        expect(src.querySelector('ge-tree-icon')!.textContent).toBe('📁');
        expect(src.querySelector('ge-tree-label')!.textContent!.replaceAll(/\s+/g, ' ').trim()).toContain('src');
        t.expandAll(['app']);
        await settle(page);
        expect(labels()).toEqual(['src', 'readme']);
    });

    it('draws custom label content from nodeContent for each node', async () => {
        const page = await mount('<ge-tree></ge-tree>');
        const t = tree(page);
        t.nodeContent = (node) => html`<b>${node.label.toUpperCase()}</b>`;
        t.data = NODES;
        await settle(page);
        expect([...page.querySelectorAll('ge-tree-label b')].map((b) => b.textContent)).toEqual(['SRC', 'README.MD']);
    });

    it('focusNode points the tree at a key or at the first node and focuses it', async () => {
        const page = await mount(SLOTTED());
        tree(page).focusNode();
        await settle(page);
        expect([focused(page), document.activeElement === tree(page)]).toEqual(['src', true]);
        tree(page).focusNode('docs');
        await settle(page);
        expect(tree(page).getAttribute('aria-activedescendant')).toBe(item(page, 'docs').id);
    });

    it('has no axe violations open, selected and focused', async () => {
        const page = await mount(SLOTTED('selectable="single"'));
        await press(page, '*');
        await press(page, 'ArrowDown');
        await press(page, 'Enter');
        await userEvent.tab();
        await new Promise((r) => setTimeout(r, 250));
        const result = await axe.run(page);
        expect(result.violations.map((v) => v.id)).toEqual([]);
    });
});
