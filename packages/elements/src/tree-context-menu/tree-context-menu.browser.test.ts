import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeContextMenu } from '../context-menu/index.js';
import type { GeTree, TreeNode } from '../tree/index.js';
import type { GeTreeContextMenu, TreeContextMenuDetail, TreeContextNode } from './index.js';

const TREE = `
    <ge-tree selectable="single" id="tree">
        <ge-tree-item value="src"><ge-tree-label>  src  </ge-tree-label>
            <ge-tree-item value="main"><ge-tree-label>main.ts</ge-tree-label></ge-tree-item>
        </ge-tree-item>
        <ge-tree-item value="assets">
            <ge-tree-item value="logo"><ge-tree-label>logo.svg</ge-tree-label></ge-tree-item>
        </ge-tree-item>
        <ge-tree-item value="readme"><ge-tree-label>README.md</ge-tree-label></ge-tree-item>
    </ge-tree>`;
const MENU = `<ge-context-menu id="menu"><ge-context-menu-content><ge-context-menu-item>Rename</ge-context-menu-item></ge-context-menu-content></ge-context-menu>`;

const wrapper = (page: HTMLElement) => page.querySelector<GeTreeContextMenu>('ge-tree-context-menu')!;
const menu = (page: HTMLElement) => page.querySelector<GeContextMenu>('ge-context-menu')!;
const tree = (page: HTMLElement) => page.querySelector<GeTree>('ge-tree')!;
const item = (page: HTMLElement, value: string) => page.querySelector<HTMLElement & { updateComplete: Promise<boolean> }>(`ge-tree-item[value="${value}"]`)!;
const row = (it: HTMLElement) => it.shadowRoot!.querySelector<HTMLElement>('.header')!;
const settle = async (page: HTMLElement) => {
    for (const e of page.querySelectorAll<HTMLElement & { updateComplete?: Promise<boolean> }>('*')) await e.updateComplete;
};
const log = (page: HTMLElement) => {
    const seen: TreeContextMenuDetail[] = [];
    wrapper(page).addEventListener('node-context-menu', (event) => seen.push((event as CustomEvent<TreeContextMenuDetail>).detail));
    return seen;
};
/** A right-click on `target`, the way the browser sends it. Returns the event so a test can read `defaultPrevented`. */
const rightClick = (target: Element, x = 40, y = 30) => {
    const event = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y });
    target.dispatchEvent(event);
    return event;
};
const finger = (target: Element, x: number, y: number) => new Touch({ identifier: 1, target, clientX: x, clientY: y });
const touch = (type: string, target: Element, x: number, y: number) => {
    const point = finger(target, x, y);
    target.dispatchEvent(new TouchEvent(type, { bubbles: true, composed: true, cancelable: true, touches: type === 'touchend' ? [] : [point], changedTouches: [point] }));
};

afterEach(() => vi.useRealTimers());

describe('ge-tree-context-menu', () => {
    it('opens the menu at the pointer with the hit item as its data, and reports the node', async () => {
        const page = await mount(`${MENU}<ge-tree-context-menu for="menu">${TREE}</ge-tree-context-menu>`);
        const seen = log(page);
        await settle(page);
        // Select and expand first, so the node reports real state.
        row(item(page, 'src')).click();
        item(page, 'src').shadowRoot!.querySelector<HTMLElement>('.expand')!.click();
        await settle(page);
        const src = item(page, 'src');
        const event = rightClick(row(src), 120, 80);
        await settle(page);

        expect(event.defaultPrevented).toBe(true);
        expect(seen).toHaveLength(1);
        expect(seen[0]!.event).toBe(event);
        expect(seen[0]!.node).toEqual({ key: 'src', label: 'src', expanded: true, selected: true, element: src });
        expect(menu(page).open).toBe(true);
        expect([menu(page).x, menu(page).y]).toEqual([120, 80]);
        expect(menu(page).data).toBe(seen[0]!.node);

        // A nested item reports its own label and state, not the parent's.
        rightClick(row(item(page, 'main')), 10, 10);
        await settle(page);
        expect(seen.at(-1)!.node).toMatchObject({ key: 'main', label: 'main.ts', expanded: false, selected: false });
        // A parent with no label of its own must not borrow a child's.
        rightClick(row(item(page, 'assets')), 10, 10);
        expect((seen.at(-1)!.node as TreeContextNode).label).toBe('');
    });

    it('works for a data-driven tree and for the menu it sits in', async () => {
        const nodes: TreeNode[] = [{ key: 'docs', label: 'Docs', children: [{ key: 'intro', label: 'Intro' }] }];
        const page = await mount(`<ge-context-menu><ge-context-menu-content><ge-context-menu-item>Open</ge-context-menu-item></ge-context-menu-content><ge-tree-context-menu><ge-tree initial-expand-depth="2"></ge-tree></ge-tree-context-menu></ge-context-menu>`);
        tree(page).data = nodes;
        await settle(page);
        await settle(page);
        const seen = log(page);
        rightClick(row(item(page, 'intro')), 55, 66);
        await settle(page);
        expect(seen[0]!.node).toMatchObject({ key: 'intro', label: 'Intro' });
        expect(menu(page).open).toBe(true);
        expect([menu(page).x, menu(page).y]).toEqual([55, 66]);
    });

    it('leaves the gesture to the browser when disabled, off an item, or with no menu', async () => {
        const page = await mount(`${MENU}<ge-tree-context-menu for="menu" disabled>${TREE}<p id="blank">blank</p></ge-tree-context-menu>`);
        const seen = log(page);
        await settle(page);
        const event = rightClick(row(item(page, 'readme')));
        expect(event.defaultPrevented).toBe(false);
        expect(seen).toEqual([]);
        expect(menu(page).open).toBe(false);

        wrapper(page).disabled = false;
        await wrapper(page).updateComplete;
        const off = rightClick(page.querySelector('#blank')!);
        expect(off.defaultPrevented).toBe(false);
        expect(seen).toEqual([]);

        // No such menu: the event still reports, and nothing throws.
        wrapper(page).forMenu = 'missing';
        rightClick(row(item(page, 'readme')));
        expect(seen).toHaveLength(1);
    });

    it('opens for the focused item when the context-menu key raises the event on the tree itself', async () => {
        const page = await mount(`${MENU}<ge-tree-context-menu for="menu">${TREE}</ge-tree-context-menu>`);
        const seen = log(page);
        await settle(page);

        // Nothing focused yet: nothing to open for.
        expect(rightClick(tree(page), 0, 0).defaultPrevented).toBe(false);
        expect(seen).toEqual([]);

        tree(page).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
        await settle(page);
        const key = tree(page).focusedKey;
        expect(key).toBe('src');
        const event = rightClick(tree(page), 0, 0);
        await settle(page);
        expect(event.defaultPrevented).toBe(true);
        expect(seen[0]!.node.key).toBe('src');
        // Anchored to the focused row, not to the (0, 0) the key press reported.
        const box = row(item(page, 'src')).getBoundingClientRect();
        expect(menu(page).y).toBeCloseTo(box.bottom, 0);
        expect(menu(page).x).toBeGreaterThan(box.left);
        expect(menu(page).x).toBeLessThanOrEqual(box.left + 24);
    });

    it('opens once on a long press, swallows the contextmenu the browser adds, and cancels when the finger moves', async () => {
        vi.useFakeTimers();
        const page = await mount(`${MENU}<ge-tree-context-menu for="menu">${TREE}</ge-tree-context-menu>`);
        const seen = log(page);
        const target = row(item(page, 'readme'));

        touch('touchstart', target, 30, 40);
        await vi.advanceTimersByTimeAsync(400);
        expect(seen).toEqual([]);
        await vi.advanceTimersByTimeAsync(150);
        expect(seen).toHaveLength(1);
        expect(seen[0]!.node.key).toBe('readme');
        expect(seen[0]!.event.type).toBe('touchstart');
        expect([menu(page).x, menu(page).y]).toEqual([30, 40]);
        touch('touchend', target, 30, 40);

        // Android follows the hold with its own contextmenu: it must neither re-open nor report again.
        const echo = rightClick(target, 31, 41);
        expect(echo.defaultPrevented).toBe(true);
        expect(seen).toHaveLength(1);
        await vi.advanceTimersByTimeAsync(1200);
        const mouse = rightClick(target, 5, 6);
        expect(mouse.defaultPrevented).toBe(true);
        expect(seen).toHaveLength(2);

        // A finger that wanders is scrolling, not asking for a menu.
        touch('touchstart', target, 30, 40);
        touch('touchmove', target, 30, 80);
        await vi.advanceTimersByTimeAsync(700);
        expect(seen).toHaveLength(2);
    });

    it('ignores a long press that is off an item or while disabled', async () => {
        vi.useFakeTimers();
        const page = await mount(`${MENU}<ge-tree-context-menu for="menu">${TREE}<p id="blank">blank</p></ge-tree-context-menu>`);
        const seen = log(page);
        const hold = async (target: Element) => {
            touch('touchstart', target, 20, 20);
            await vi.advanceTimersByTimeAsync(600);
            touch('touchend', target, 20, 20);
        };
        await hold(page.querySelector('#blank')!);
        wrapper(page).disabled = true;
        await wrapper(page).updateComplete;
        await hold(row(item(page, 'readme')));
        expect(seen).toEqual([]);
        expect(menu(page).open).toBe(false);
    });
});
