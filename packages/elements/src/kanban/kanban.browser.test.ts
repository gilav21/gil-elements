import { shortcutBindings } from '../shared/shortcut-bindings.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import '@gilav21/elements-base/tokens.css';
import './define.js';
import { mount } from '../test-utils.js';
import type { GeContextMenu } from '../context-menu/index.js';
import type { GeKanban, KanbanCard, KanbanCardAddEvent, KanbanCardMoveEvent, KanbanColumn, KanbanColumnDeleteEvent, KanbanHistoryState } from './index.js';

const COLUMNS: KanbanColumn[] = [
    { id: 'todo', title: 'To do', order: 0, wipLimit: 2 },
    { id: 'doing', title: 'In progress', order: 1 },
    { id: 'done', title: 'Done', order: 2 },
];
const CARDS: KanbanCard[] = [
    { id: 'c1', columnId: 'todo', title: 'Write the spec', order: 0, priority: 'high', labels: [{ text: 'docs', color: '#3b82f6' }], assignees: [{ name: 'Ada' }] },
    { id: 'c2', columnId: 'todo', title: 'Review the pull request', description: 'Check the tests', order: 1 },
    { id: 'c3', columnId: 'todo', title: 'Plan the launch', order: 2 },
    { id: 'c4', columnId: 'doing', title: 'Build the board', order: 0, priority: 'urgent' },
];

const board = (page: HTMLElement) => page.querySelector<GeKanban>('ge-kanban')!;
const walk = (root: ParentNode, out: Element[] = []): Element[] => {
    for (const el of root.querySelectorAll('*')) {
        out.push(el);
        if (el.shadowRoot) walk(el.shadowRoot, out);
    }
    return out;
};
const settle = async (page: HTMLElement) => {
    for (let round = 0; round < 4; round++) {
        for (const el of walk(page) as (Element & { updateComplete?: Promise<boolean> })[]) await el.updateComplete;
        if (!vi.isFakeTimers()) await new Promise((resolve) => setTimeout(resolve, 0));
    }
};
const inBoard = <T extends Element>(page: HTMLElement, selector: string) => board(page).shadowRoot!.querySelector<T>(selector)!;
const columnEl = (page: HTMLElement, id: string) => board(page).shadowRoot!.querySelector<HTMLElement>(`ge-kanban-column[column-id="${id}"]`)!;
const cardEl = (page: HTMLElement, id: string) => columnEl(page, board(page).cards.find((c) => c.id === id)!.columnId).shadowRoot!.querySelector<HTMLElement>(`ge-kanban-card[card-id="${id}"]`)!;
const titles = (page: HTMLElement, column: string) => [...columnEl(page, column).shadowRoot!.querySelectorAll('ge-kanban-card')].map((c) => (c as HTMLElement & { card: KanbanCard }).card.title);
const log = <T>(el: Element, name: string) => {
    const seen: T[] = [];
    el.addEventListener(name, (event) => seen.push((event as CustomEvent<T>).detail));
    return seen;
};
const mountBoard = async (attrs = '', cards = CARDS, columns = COLUMNS) => {
    const page = await mount(`<ge-kanban ${attrs}></ge-kanban>`);
    board(page).columns = columns;
    board(page).cards = cards;
    await settle(page);
    return page;
};
const rightClick = (target: Element, x = 40, y = 30) => target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: x, clientY: y }));
const menuItems = (page: HTMLElement, name: string) => {
    const menu = inBoard<GeContextMenu>(page, `ge-context-menu[data-menu="${name}"]`);
    const content = menu.shadowRoot!.querySelector('ge-context-menu-content');
    return [...(content?.children ?? [])]
        .map((el) => (el.localName === 'ge-context-menu-sub' ? el.querySelector('ge-context-menu-sub-trigger')! : el))
        .filter((el) => el.localName !== 'ge-context-menu-separator') as HTMLElement[];
};
const itemWith = (page: HTMLElement, menu: string, label: string) => menuItems(page, menu).find((i) => i.textContent?.trim() === label)!;
const dragEvent = (type: string, init: DragEventInit = {}) => new DragEvent(type, { bubbles: true, composed: true, cancelable: true, ...init });
/** The full pointer drag of a card onto a column at height `y`, the way a browser sends it. */
const dragCard = async (page: HTMLElement, cardId: string, columnId: string, y: number) => {
    const transfer = new DataTransfer();
    const card = cardEl(page, cardId);
    const column = columnEl(page, columnId);
    card.dispatchEvent(dragEvent('dragstart', { dataTransfer: transfer }));
    await settle(page);
    column.dispatchEvent(dragEvent('dragenter', { dataTransfer: transfer }));
    column.dispatchEvent(dragEvent('dragover', { dataTransfer: transfer, clientY: y }));
    await settle(page);
    return { transfer, column, card, drop: () => column.dispatchEvent(dragEvent('drop', { dataTransfer: transfer, clientY: y })) };
};

afterEach(() => vi.useRealTimers());

describe('ge-kanban rendering', () => {
    it('draws the columns in order with their cards sorted, counts, WIP state and an empty state', async () => {
        const page = await mountBoard('', [...CARDS].reverse(), [...COLUMNS].reverse());
        expect([...board(page).shadowRoot!.querySelectorAll('ge-kanban-column')].map((c) => c.getAttribute('heading'))).toEqual(['To do', 'In progress', 'Done']);
        expect(titles(page, 'todo')).toEqual(['Write the spec', 'Review the pull request', 'Plan the launch']);
        const badge = (id: string) => columnEl(page, id).shadowRoot!.querySelector('.count')!;
        expect(badge('todo').getAttribute('label')).toBe('3');
        expect(badge('todo').getAttribute('variant')).toBe('destructive');
        expect(columnEl(page, 'todo').hasAttribute('data-over-limit')).toBe(true);
        expect(columnEl(page, 'todo').shadowRoot!.querySelector('.limit')!.textContent).toContain('2');
        expect(badge('doing').getAttribute('variant')).toBe('secondary');
        expect(columnEl(page, 'done').shadowRoot!.querySelector('[data-slot="kanban-empty-state"]')!.textContent).toContain('No cards yet');
    });

    it('draws a card with its labels, title, description, assignee and priority border', async () => {
        const page = await mountBoard();
        const card = cardEl(page, 'c1');
        expect(card.dataset.priority).toBe('high');
        expect(card.shadowRoot!.querySelector('.title')!.textContent).toBe('Write the spec');
        expect(card.shadowRoot!.querySelector('ge-badge.label')!.getAttribute('label')).toBe('docs');
        expect(card.shadowRoot!.querySelector('ge-avatar')!.getAttribute('fallback')).toBe('A');
        expect(cardEl(page, 'c2').shadowRoot!.querySelector('.description')!.textContent).toBe('Check the tests');
        expect(getComputedStyle(card).borderInlineStartWidth).toBe('3px');
        expect(getComputedStyle(cardEl(page, 'c2')).borderInlineStartWidth).toBe('1px');
    });

    it('filters by title, description and label text, and the count follows', async () => {
        const page = await mountBoard();
        board(page).searchTerm = 'DOCS';
        await settle(page);
        expect(titles(page, 'todo')).toEqual(['Write the spec']);
        board(page).searchTerm = 'tests';
        await settle(page);
        expect(titles(page, 'todo')).toEqual(['Review the pull request']);
        expect(columnEl(page, 'todo').shadowRoot!.querySelector('.count')!.getAttribute('label')).toBe('1');
        expect(columnEl(page, 'todo').hasAttribute('data-over-limit')).toBe(false);
    });

    it('collapses a column to its header', async () => {
        const page = await mountBoard();
        const toggle = columnEl(page, 'todo').shadowRoot!.querySelector<HTMLElement>('[aria-expanded]')!;
        toggle.click();
        await settle(page);
        expect(columnEl(page, 'todo').shadowRoot!.querySelector('.cards')).toBeNull();
        expect(toggle.getAttribute('aria-label')).toBe('Expand column');
    });

    it('mirrors for a right-to-left locale', async () => {
        const page = await mountBoard('locale="he"');
        expect(inBoard(page, 'div[dir]').getAttribute('dir')).toBe('rtl');
    });
});

describe('ge-kanban drag and drop', () => {
    it('drops a card into the gap under the pointer, reports the move and leaves cards alone', async () => {
        const page = await mountBoard();
        const moved = log<KanbanCardMoveEvent>(board(page), 'card-moved');
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        const target = cardEl(page, 'c4').getBoundingClientRect();
        const { card, column, drop } = await dragCard(page, 'c1', 'doing', target.top + 2);
        expect(card.hasAttribute('data-dragging')).toBe(true);
        expect(column.hasAttribute('data-drag-over')).toBe(true);
        expect(column.shadowRoot!.querySelector('.indicator')!.hasAttribute('data-active')).toBe(true);
        drop();
        await settle(page);
        expect(moved).toEqual([{ cardId: 'c1', fromColumnId: 'todo', toColumnId: 'doing', newOrder: 0 }]);
        const next = changed[0]!;
        expect(next.find((c) => c.id === 'c1')).toMatchObject({ columnId: 'doing', order: 0 });
        expect(next.find((c) => c.id === 'c4')).toMatchObject({ columnId: 'doing', order: 1 });
        expect(board(page).cards.find((c) => c.id === 'c1')!.columnId).toBe('todo');
        expect(card.hasAttribute('data-dragging')).toBe(false);
        expect(column.hasAttribute('data-drag-over')).toBe(false);
    });

    it('drops after the last card when the pointer is below every card, and into an empty column at 0', async () => {
        const page = await mountBoard();
        const moved = log<KanbanCardMoveEvent>(board(page), 'card-moved');
        const last = cardEl(page, 'c4').getBoundingClientRect();
        let drag = await dragCard(page, 'c1', 'doing', last.bottom + 20);
        drag.drop();
        expect(moved[0]?.newOrder).toBe(1);
        board(page).endDrag();
        await settle(page);
        drag = await dragCard(page, 'c2', 'done', 0);
        drag.drop();
        expect(moved[1]).toMatchObject({ toColumnId: 'done', newOrder: 0 });
    });

    it('ignores things dragged over the board that are not cards, and drops without a card id', async () => {
        const page = await mountBoard();
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        const column = columnEl(page, 'doing');
        const over = dragEvent('dragover', { dataTransfer: new DataTransfer() });
        column.dispatchEvent(dragEvent('dragenter'));
        column.dispatchEvent(over);
        expect(over.defaultPrevented).toBe(false);
        expect(column.hasAttribute('data-drag-over')).toBe(false);
        column.dispatchEvent(dragEvent('drop', { dataTransfer: new DataTransfer() }));
        expect(changed).toHaveLength(0);
    });

    it('keeps the highlight while the pointer crosses between cards and clears it once it leaves the column', async () => {
        const page = await mountBoard();
        const { column, transfer } = await dragCard(page, 'c1', 'doing', 10);
        column.dispatchEvent(dragEvent('dragenter', { dataTransfer: transfer }));
        column.dispatchEvent(dragEvent('dragleave'));
        await settle(page);
        expect(column.hasAttribute('data-drag-over')).toBe(true);
        column.dispatchEvent(dragEvent('dragleave'));
        await settle(page);
        expect(column.hasAttribute('data-drag-over')).toBe(false);
        expect(column.shadowRoot!.querySelector('.indicator')!.hasAttribute('data-active')).toBe(false);
        cardEl(page, 'c1').dispatchEvent(dragEvent('dragend'));
        await settle(page);
        expect(board(page).draggedCardId).toBeNull();
    });
});

describe('ge-kanban card menu', () => {
    it('opens on right-click and moves the card to the end of another column', async () => {
        const page = await mountBoard();
        const moved = log<KanbanCardMoveEvent>(board(page), 'card-moved');
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        rightClick(cardEl(page, 'c2'));
        await settle(page);
        const menu = inBoard<GeContextMenu>(page, 'ge-context-menu[data-menu="card"]');
        expect(menu.open).toBe(true);
        expect(menuItems(page, 'card').map((i) => i.textContent?.trim())).toEqual(['Edit Card', 'Duplicate Card', 'Move to', 'Set Priority', 'Delete Card']);
        expect(inBoard<GeContextMenu>(page, 'ge-context-menu[data-menu="column"]').open).toBe(false);
        const sub = [...menu.shadowRoot!.querySelectorAll('ge-context-menu-sub')][0]!;
        const entries = [...sub.querySelectorAll('ge-context-menu-item')];
        expect(entries.map((e) => [e.textContent?.trim(), e.hasAttribute('disabled')])).toEqual([['To do', true], ['In progress', false], ['Done', false]]);
        (entries[1] as HTMLElement).click();
        await settle(page);
        expect(moved).toEqual([{ cardId: 'c2', fromColumnId: 'todo', toColumnId: 'doing', newOrder: 1 }]);
        expect(changed[0]!.find((c) => c.id === 'c2')).toMatchObject({ columnId: 'doing', order: 1 });
    });

    it('does nothing when asked to move a card to the column it is in', async () => {
        const page = await mountBoard();
        const moved = log<KanbanCardMoveEvent>(board(page), 'card-moved');
        rightClick(cardEl(page, 'c2'));
        await settle(page);
        const sub = [...inBoard<GeContextMenu>(page, 'ge-context-menu[data-menu="card"]').shadowRoot!.querySelectorAll('ge-context-menu-sub')][0]!;
        (sub.querySelectorAll('ge-context-menu-item')[0] as HTMLElement).click();
        expect(moved).toHaveLength(0);
    });

    it('sets and clears the priority, and duplicates with a (copy) title', async () => {
        const page = await mountBoard();
        const updated = log<KanbanCard>(board(page), 'card-updated');
        const added = log<KanbanCardAddEvent>(board(page), 'card-added');
        rightClick(cardEl(page, 'c1'));
        await settle(page);
        const menu = inBoard<GeContextMenu>(page, 'ge-context-menu[data-menu="card"]');
        const priorityItems = [...menu.shadowRoot!.querySelectorAll('ge-context-menu-sub')][1]!.querySelectorAll<HTMLElement>('ge-context-menu-item');
        priorityItems[3]!.click();
        priorityItems[4]!.click();
        itemWith(page, 'card', 'Duplicate Card').click();
        expect(updated.map((c) => c.priority)).toEqual(['urgent', undefined]);
        expect(added[0]).toMatchObject({ columnId: 'todo', title: 'Write the spec (copy)', priority: 'high', labels: [{ text: 'docs', color: '#3b82f6' }] });
    });

    describe('with a finger', () => {
        const touch = (target: Element, type: string, x: number, y: number) => {
            const finger = new Touch({ identifier: 1, target, clientX: x, clientY: y });
            const list = type === 'touchend' ? [] : [finger];
            target.dispatchEvent(new TouchEvent(type, { bubbles: true, composed: true, cancelable: true, touches: list, changedTouches: [finger] }));
        };
        const centreOf = (el: Element) => {
            const r = el.getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        };
        const cardMenu = (page: HTMLElement) => inBoard<GeContextMenu>(page, 'ge-context-menu[data-menu="card"]');

        it('lifts a held card, and a drop on another column moves it there without opening the menu', async () => {
            const page = await mountBoard();
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            const moved = log<KanbanCardMoveEvent>(board(page), 'card-moved');
            const card = cardEl(page, 'c2');
            const from = centreOf(card);
            touch(card, 'touchstart', from.x, from.y);
            // The hold is the browser's long-press too, which raises `contextmenu`; it must not open the menu.
            const native = new MouseEvent('contextmenu', { bubbles: true, composed: true, cancelable: true, clientX: from.x, clientY: from.y });
            card.dispatchEvent(native);
            expect(native.defaultPrevented).toBe(true);
            await vi.advanceTimersByTimeAsync(600);
            expect(board(page).draggedCardId).toBe('c2');
            expect(document.querySelector('[data-slot="kanban-touch-ghost"]')).not.toBeNull();
            // A scroll the browser has begun cannot be cancelled, so the board is held still for the length of the drag.
            const surface = inBoard<HTMLElement>(page, '[data-surface]');
            expect(surface.style.overflow).toBe('hidden');

            const target = centreOf(columnEl(page, 'doing'));
            touch(card, 'touchmove', target.x, target.y);
            await settle(page);
            expect(columnEl(page, 'doing').shadowRoot!.querySelector('[data-slot="kanban-drop-indicator"][data-active]')).not.toBeNull();
            touch(card, 'touchend', target.x, target.y);
            await vi.advanceTimersByTimeAsync(0);

            expect(moved).toHaveLength(1);
            expect(moved[0]).toMatchObject({ cardId: 'c2', fromColumnId: 'todo', toColumnId: 'doing' });
            expect(board(page).draggedCardId).toBeNull();
            expect(document.querySelector('[data-slot="kanban-touch-ghost"]')).toBeNull();
            expect(surface.style.overflow).toBe('');
            expect(cardMenu(page).open).toBe(false);
            // The click that follows a release is swallowed for a moment; let that pass so it cannot reach later tests.
            await vi.advanceTimersByTimeAsync(500);
        });

        it('opens the card menu when a held card is let go without moving, and not while it is held', async () => {
            const page = await mountBoard();
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            const card = cardEl(page, 'c2');
            const at = centreOf(card);
            touch(card, 'touchstart', at.x, at.y);
            await vi.advanceTimersByTimeAsync(900);
            expect(cardMenu(page).open).toBe(false);
            // The board's own long-press is listening too, and a hold on a card is not a hold on empty board space.
            expect(inBoard<GeContextMenu>(page, 'ge-context-menu[data-menu="board"]').open).toBe(false);
            touch(card, 'touchend', at.x, at.y);
            await vi.advanceTimersByTimeAsync(0);
            expect(cardMenu(page).open).toBe(true);
            expect(board(page).draggedCardId).toBeNull();
            await vi.advanceTimersByTimeAsync(500);
        });

        it('leaves a finger that moves before the hold is up to scroll the board', async () => {
            const page = await mountBoard();
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            const moved = log<KanbanCardMoveEvent>(board(page), 'card-moved');
            const card = cardEl(page, 'c2');
            const at = centreOf(card);
            touch(card, 'touchstart', at.x, at.y);
            touch(card, 'touchmove', at.x, at.y + 40);
            await vi.advanceTimersByTimeAsync(900);
            touch(card, 'touchend', at.x, at.y + 40);
            await vi.advanceTimersByTimeAsync(0);
            expect(board(page).draggedCardId).toBeNull();
            expect(document.querySelector('[data-slot="kanban-touch-ghost"]')).toBeNull();
            expect(cardMenu(page).open).toBe(false);
            expect(moved).toHaveLength(0);
        });
    });
});

describe('ge-kanban delete with undo', () => {
    const deleteCard = async (page: HTMLElement, id: string) => {
        rightClick(cardEl(page, id));
        await settle(page);
        itemWith(page, 'card', 'Delete Card').click();
        await settle(page);
    };

    it('removes the card at once, shows a toast, and reports the delete only when the countdown ends', async () => {
        const page = await mountBoard();
        vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        const deleted = log<string>(board(page), 'card-deleted');
        await deleteCard(page, 'c2');
        expect(changed[0]!.map((c) => c.id)).toEqual(['c1', 'c3', 'c4']);
        const toast = inBoard(page, '[data-slot="kanban-delete-toast"]');
        expect(toast.textContent).toContain('Review the pull request');
        expect(toast.textContent).toContain('(6s)');
        await vi.advanceTimersByTimeAsync(3000);
        await settle(page);
        expect(inBoard(page, '[data-slot="kanban-delete-toast"]').textContent).toContain('(3s)');
        expect(deleted).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(3100);
        await settle(page);
        expect(deleted).toEqual(['c2']);
        expect(board(page).shadowRoot!.querySelector('[data-slot="kanban-delete-toast"]')).toBeNull();
    });

    it('puts the card back on Undo without ever reporting the delete, and the close button reports it at once', async () => {
        const page = await mountBoard();
        board(page).addEventListener('cards-change', (e) => (board(page).cards = (e as CustomEvent<KanbanCard[]>).detail));
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        const history = log<KanbanHistoryState>(board(page), 'history-change');
        const deleted = log<string>(board(page), 'card-deleted');
        await deleteCard(page, 'c2');
        expect(history.at(-1)!.canUndo).toBe(true);
        inBoard<HTMLElement>(page, '[data-slot="kanban-delete-toast"] ge-button').click();
        await settle(page);
        expect(changed.at(-1)!.map((c) => c.id)).toContain('c2');
        expect(history.at(-1)!.canUndo).toBe(false);
        expect(deleted).toHaveLength(0);
        await deleteCard(page, 'c3');
        inBoard<HTMLElement>(page, '.toast-close').click();
        await settle(page);
        expect(deleted).toEqual(['c3']);
    });

    it('finalizes the first delete when a second one starts, so the app still hears about it', async () => {
        const page = await mountBoard();
        vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
        const deleted = log<string>(board(page), 'card-deleted');
        await deleteCard(page, 'c2');
        await deleteCard(page, 'c3');
        expect(deleted).toEqual(['c2']);
        await vi.advanceTimersByTimeAsync(6100);
        expect(deleted).toEqual(['c2', 'c3']);
    });
});

describe('ge-kanban column menu and dialogs', () => {
    const headerOf = (page: HTMLElement, id: string) => columnEl(page, id).shadowRoot!.querySelector<HTMLElement>('.header')!;
    const dialogShadow = (page: HTMLElement, name: string) => inBoard(page, `[data-dialog="${name}"]`).shadowRoot!;
    const typeInto = async (page: HTMLElement, root: ShadowRoot, selector: string, text: string) => {
        const field = root.querySelector<HTMLElement & { value: string }>(selector)!;
        field.value = text;
        field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        await settle(page);
    };
    const press = async (page: HTMLElement, root: ShadowRoot, label: string) => {
        [...root.querySelectorAll<HTMLElement>('ge-button')].find((b) => b.textContent?.trim() === label)!.click();
        await settle(page);
    };

    it('opens the column menu from the header, and the move entries disable at the edges', async () => {
        const page = await mountBoard();
        rightClick(headerOf(page, 'todo'));
        await settle(page);
        expect(menuItems(page, 'column').map((i) => i.textContent?.trim())).toEqual(['Add Card', 'Rename Column', 'Set WIP Limit', 'Move Left', 'Move Right', 'Delete Column']);
        expect(itemWith(page, 'column', 'Move Left').hasAttribute('disabled')).toBe(true);
        expect(itemWith(page, 'column', 'Move Right').hasAttribute('disabled')).toBe(false);
        expect(inBoard<GeContextMenu>(page, 'ge-context-menu[data-menu="board"]').open).toBe(false);
    });

    it('swaps the order with the neighbour on Move right', async () => {
        const page = await mountBoard();
        const changed = log<KanbanColumn[]>(board(page), 'columns-change');
        rightClick(headerOf(page, 'todo'));
        await settle(page);
        itemWith(page, 'column', 'Move Right').click();
        expect(changed[0]!.map((c) => [c.id, c.order])).toEqual([['todo', 1], ['doing', 0], ['done', 2]]);
    });

    it('opens the board menu on empty board space and adds a column named in the dialog', async () => {
        const page = await mountBoard();
        const added = log<Omit<KanbanColumn, 'id'>>(board(page), 'column-added');
        rightClick(inBoard(page, '.strip'));
        await settle(page);
        itemWith(page, 'board', 'Add Column').click();
        await settle(page);
        const root = dialogShadow(page, 'column');
        const submit = [...root.querySelectorAll<HTMLElement>('ge-button')].find((b) => b.textContent?.trim() === 'Add Column')!;
        expect(submit.hasAttribute('disabled')).toBe(true);
        await typeInto(page, root, 'ge-input', '  Review  ');
        await typeInto(page, root, 'ge-input[type="number"]', '4');
        await press(page, root, 'Add Column');
        expect(added).toEqual([{ title: 'Review', wipLimit: 4, order: 3 }]);
    });

    it('renames a column and clears or sets its WIP limit, turning zero and junk into no limit', async () => {
        const page = await mountBoard();
        const updated = log<KanbanColumn>(board(page), 'column-updated');
        board(page).onRenameColumn(COLUMNS[1]);
        await settle(page);
        const root = dialogShadow(page, 'column');
        expect(root.querySelector<HTMLInputElement>('ge-input')!.value).toBe('In progress');
        expect(root.querySelector('ge-input[type="number"]')).toBeNull();
        await typeInto(page, root, 'ge-input', 'Doing');
        await press(page, root, 'Rename');
        expect(updated[0]).toEqual({ ...COLUMNS[1], title: 'Doing' });

        board(page).onSetWipLimit(COLUMNS[0]);
        await settle(page);
        expect(root.querySelector<HTMLInputElement>('ge-input[type="number"]')!.value).toBe('2');
        await typeInto(page, root, 'ge-input[type="number"]', '0');
        await press(page, root, 'Set Limit');
        expect(updated[1]!.wipLimit).toBeUndefined();
        expect(updated[1]!.title).toBe('To do');
    });

    it('adds a card from the header button with the form values, and refuses a blank title', async () => {
        const page = await mountBoard();
        const added = log<KanbanCardAddEvent>(board(page), 'card-added');
        columnEl(page, 'doing').shadowRoot!.querySelector<HTMLElement>('[data-slot="kanban-add-card-button"]')!.click();
        await settle(page);
        const root = dialogShadow(page, 'card');
        const save = () => [...root.querySelectorAll<HTMLElement>('ge-button')].find((b) => b.textContent?.trim() === 'Add Card')!;
        expect(save().hasAttribute('disabled')).toBe(true);
        await typeInto(page, root, 'ge-input', '  Ship it  ');
        await typeInto(page, root, 'ge-textarea', '   ');
        [...root.querySelectorAll<HTMLElement>('.choice')].find((b) => b.textContent?.trim() === 'High')!.click();
        await settle(page);
        root.querySelector('ge-chip-list')!.dispatchEvent(new CustomEvent('chip-added', { detail: 'bug' }));
        await settle(page);
        save().click();
        await settle(page);
        expect(added).toEqual([{ columnId: 'doing', title: 'Ship it', description: undefined, priority: 'high', labels: [{ text: 'bug', color: '#ef4444' }], assignees: undefined }]);
    });

    it('prefills an edit and reports the whole merged card', async () => {
        const page = await mountBoard();
        const updated = log<KanbanCard>(board(page), 'card-updated');
        rightClick(cardEl(page, 'c1'));
        await settle(page);
        itemWith(page, 'card', 'Edit Card').click();
        await settle(page);
        const root = dialogShadow(page, 'card');
        expect(root.querySelector<HTMLInputElement>('ge-input')!.value).toBe('Write the spec');
        expect([...root.querySelectorAll('.choice[aria-pressed="true"]')].map((b) => b.textContent?.trim())).toEqual(['High']);
        await typeInto(page, root, 'ge-input', 'Write the design doc');
        await press(page, root, 'Save Changes');
        expect(updated[0]).toEqual({ ...CARDS[0], title: 'Write the design doc', description: undefined });
    });

    it('hides the label and assignee editors when switched off', async () => {
        const page = await mountBoard('have-labels="false" have-assignees="false"');
        board(page).onAddCard('todo');
        await settle(page);
        expect(dialogShadow(page, 'card').querySelector('ge-chip-list')).toBeNull();
        expect(dialogShadow(page, 'card').querySelector('ge-autocomplete')).toBeNull();
    });

    it('asks where the cards go before a column is deleted, and reports the choice', async () => {
        const page = await mountBoard();
        const deleted = log<KanbanColumnDeleteEvent>(board(page), 'column-deleted');
        board(page).onDeleteColumn(COLUMNS[0]);
        await settle(page);
        const root = dialogShadow(page, 'delete-column');
        const options = [...root.querySelectorAll<HTMLElement>('.option')];
        expect(options.map((o) => o.textContent?.trim())).toEqual(['Move to "In progress"', 'Move to "Done"', 'Delete all cards']);
        options[1]!.click();
        await settle(page);
        await press(page, root, 'Delete Column');
        expect(deleted).toEqual([{ columnId: 'todo', moveCardsTo: 'done' }]);
    });

    it('goes straight to the confirmation for an empty column, and warns when it is the last one', async () => {
        const page = await mountBoard();
        board(page).onDeleteColumn(COLUMNS[2]);
        await settle(page);
        const root = dialogShadow(page, 'delete-column');
        expect(root.querySelector('.options')).toBeNull();
        expect(root.querySelector('ge-alert-dialog-description')!.textContent).toContain('empty');
        board(page).columns = [COLUMNS[0] as KanbanColumn];
        await settle(page);
        board(page).onDeleteColumn(COLUMNS[0]);
        await settle(page);
        expect(root.querySelector('ge-alert-dialog-description')!.textContent).toContain('only column');
    });
});

describe('ge-kanban history', () => {
    it('undoes and redoes with the keyboard, restoring both arrays, and reports what is available', async () => {
        const page = await mountBoard();
        const history = log<KanbanHistoryState>(board(page), 'history-change');
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        const columns = log<KanbanColumn[]>(board(page), 'columns-change');
        // The board is controlled: apply what it reports, as an app does.
        board(page).addEventListener('cards-change', (e) => (board(page).cards = (e as CustomEvent<KanbanCard[]>).detail));
        board(page).moveCard('c1', 'done', 0);
        expect(history.at(-1)).toEqual({ canUndo: true, canRedo: false });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(changed.at(-1)).toEqual(CARDS);
        expect(columns.at(-1)).toEqual(COLUMNS);
        expect(history.at(-1)).toEqual({ canUndo: false, canRedo: true });
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }));
        expect(history.at(-1)).toEqual({ canUndo: true, canRedo: false });
        expect(changed.at(-1)!.find((c) => c.id === 'c1')!.columnId).toBe('done');
    });

    it('forgets the redo steps once a new change is made', async () => {
        const page = await mountBoard();
        const history = log<KanbanHistoryState>(board(page), 'history-change');
        board(page).addEventListener('cards-change', (e) => (board(page).cards = (e as CustomEvent<KanbanCard[]>).detail));
        board(page).moveCard('c1', 'done', 0);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
        expect(history.at(-1)).toEqual({ canUndo: false, canRedo: true });
        board(page).moveCard('c2', 'done', 0);
        expect(history.at(-1)).toEqual({ canUndo: true, canRedo: false });
    });

    it('lists undo and redo in the shared shortcut registry and follows a remapped key', async () => {
        const page = await mountBoard();
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        board(page).moveCard('c1', 'done', 0);
        expect(shortcutBindings.getShortcutCatalog().filter((item) => item.componentName === 'kanban').map((item) => item.actionId).sort()).toEqual(['kanban.redo', 'kanban.undo']);
        shortcutBindings.setShortcutOverride('kanban.undo', 'Alt+U');
        try {
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
            expect(changed).toHaveLength(1);
            document.dispatchEvent(new KeyboardEvent('keydown', { key: 'u', altKey: true, bubbles: true, cancelable: true }));
            expect(changed).toHaveLength(2);
        } finally {
            shortcutBindings.clearAllShortcutOverrides();
        }
    });

    it('leaves Mod+Z to a text field being typed in', async () => {
        const page = await mountBoard();
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        board(page).moveCard('c1', 'done', 0);
        const input = document.createElement('input');
        page.append(input);
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, composed: true, cancelable: true }));
        expect(changed).toHaveLength(1);
    });

    it('keeps at most 50 steps', async () => {
        const page = await mountBoard();
        const history = log<KanbanHistoryState>(board(page), 'history-change');
        for (let i = 0; i < 55; i++) board(page).moveCard('c1', 'done', 0);
        let undone = 0;
        while (history.at(-1)?.canUndo) {
            board(page).undo();
            undone++;
        }
        expect(undone).toBe(50);
    });
});

describe('ge-kanban swimlanes', () => {
    const LANES: KanbanCard[] = [
        { id: 'a', columnId: 'todo', title: 'A', order: 0, assignee: 'Ada' } as KanbanCard,
        { id: 'b', columnId: 'doing', title: 'B', order: 0, assignee: 'Grace' } as KanbanCard,
        { id: 'c', columnId: 'todo', title: 'C', order: 1 },
        { id: 'd', columnId: 'todo', title: 'D', order: 2, assignee: 'Ada' } as KanbanCard,
    ];

    it('draws one band per value in first-seen order, the unassigned one last, each collapsible on its own', async () => {
        const page = await mountBoard('swimlane-by="assignee"', LANES);
        const lanes = () => [...board(page).shadowRoot!.querySelectorAll('[data-slot="kanban-swimlane"]')];
        expect(lanes().map((l) => [l.getAttribute('data-swimlane-id'), l.querySelector('.lane-count')!.getAttribute('label')])).toEqual([['Ada', '2'], ['Grace', '1'], ['', '1']]);
        expect(lanes()[2]!.querySelector('.lane-name')!.textContent).toBe('Unassigned');
        expect(lanes()[0]!.querySelectorAll('ge-kanban-column')).toHaveLength(3);
        lanes()[0]!.querySelector<HTMLElement>('.lane-header')!.click();
        await settle(page);
        expect(lanes()[0]!.querySelector('ge-kanban-column')).toBeNull();
        expect(lanes()[1]!.querySelector('ge-kanban-column')).not.toBeNull();
        expect(lanes()[0]!.querySelector('.lane-header')!.getAttribute('aria-expanded')).toBe('false');
    });

    it("puts only its own lane's cards in each cell, and a drop across lanes rewrites the lane field", async () => {
        const page = await mountBoard('swimlane-by="assignee"', LANES);
        const cell = (lane: string, column: string) => board(page).shadowRoot!.querySelector<HTMLElement>(`[data-swimlane-id="${lane}"] ge-kanban-column[column-id="${column}"]`)!;
        expect([...cell('Ada', 'todo').shadowRoot!.querySelectorAll('ge-kanban-card')].map((c) => (c as HTMLElement).getAttribute('card-id'))).toEqual(['a', 'd']);
        const moved = log<KanbanCardMoveEvent>(board(page), 'card-moved');
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        const transfer = new DataTransfer();
        cell('Ada', 'todo').shadowRoot!.querySelector('ge-kanban-card')!.dispatchEvent(dragEvent('dragstart', { dataTransfer: transfer }));
        await settle(page);
        const target = cell('Grace', 'doing');
        target.dispatchEvent(dragEvent('dragenter', { dataTransfer: transfer }));
        target.dispatchEvent(dragEvent('dragover', { dataTransfer: transfer, clientY: 0 }));
        await settle(page);
        target.dispatchEvent(dragEvent('drop', { dataTransfer: transfer }));
        expect(moved[0]).toEqual({ cardId: 'a', fromColumnId: 'todo', toColumnId: 'doing', newOrder: 0, fromSwimlaneId: 'Ada', toSwimlaneId: 'Grace' });
        expect(changed[0]!.find((c) => c.id === 'a')).toMatchObject({ columnId: 'doing', assignee: 'Grace' });
    });

    it('with a derived lane function reports the lane but leaves the card in its own', async () => {
        const page = await mountBoard('', LANES);
        board(page).swimlaneBy = (card) => (card.columnId === 'todo' ? 'open' : 'active');
        await settle(page);
        const moved = log<KanbanCardMoveEvent>(board(page), 'card-moved');
        const changed = log<KanbanCard[]>(board(page), 'cards-change');
        board(page).moveCard('a', 'doing', 0, 'active');
        expect(moved[0]).toMatchObject({ fromSwimlaneId: 'open', toSwimlaneId: 'active' });
        expect(Object.keys(changed[0]!.find((c) => c.id === 'a')!)).not.toContain('open');
    });

    it('starts with the named lanes collapsed, once', async () => {
        const page = await mount('<ge-kanban swimlane-by="assignee"></ge-kanban>');
        board(page).initiallyCollapsedSwimlanes = ['Grace'];
        board(page).columns = COLUMNS;
        board(page).cards = LANES;
        await settle(page);
        expect(board(page).isSwimlaneCollapsed('Grace')).toBe(true);
        board(page).toggleSwimlane('Grace');
        board(page).initiallyCollapsedSwimlanes = ['Grace'];
        await settle(page);
        expect(board(page).isSwimlaneCollapsed('Grace')).toBe(false);
    });

    it('names a lane with swimlaneLabel', async () => {
        const page = await mountBoard('swimlane-by="assignee"', LANES);
        board(page).swimlaneLabel = (id) => (id === '' ? 'Nobody' : id.toUpperCase());
        await settle(page);
        expect([...board(page).shadowRoot!.querySelectorAll('.lane-name')].map((n) => n.textContent)).toEqual(['ADA', 'GRACE', 'Nobody']);
    });
});

describe('ge-kanban custom mode', () => {
    const MARKUP = `<ge-kanban>
        <ge-kanban-column column-id="todo" heading="Backlog" wip-limit="1">
            <ge-kanban-card card-id="x1"><ge-kanban-card-content><b>One</b></ge-kanban-card-content></ge-kanban-card>
            <ge-kanban-card card-id="x2"><ge-kanban-card-content>Two</ge-kanban-card-content></ge-kanban-card>
        </ge-kanban-column>
        <ge-kanban-column column-id="done"><ge-kanban-column-header><span id="mine">My header</span></ge-kanban-column-header></ge-kanban-column>
    </ge-kanban>`;

    it('counts projected cards, keeps your header and content, and takes drops through the board', async () => {
        const page = await mount(MARKUP);
        board(page).cards = [{ id: 'x1', columnId: 'todo', title: 'One', order: 0 }, { id: 'x2', columnId: 'todo', title: 'Two', order: 1 }];
        await settle(page);
        const todo = page.querySelector<HTMLElement>('ge-kanban-column[column-id="todo"]')!;
        const done = page.querySelector<HTMLElement>('ge-kanban-column[column-id="done"]')!;
        expect(todo.shadowRoot!.querySelector('.count')!.getAttribute('label')).toBe('2');
        expect(todo.hasAttribute('data-over-limit')).toBe(true);
        expect(todo.shadowRoot!.querySelector('ge-kanban-card')).toBeNull();
        expect(done.shadowRoot!.querySelector('.header')).toBeNull();
        expect(page.querySelector('ge-kanban-card-content')!.getBoundingClientRect().width).toBeGreaterThan(0);
        const moved = log<KanbanCardMoveEvent>(board(page), 'card-moved');
        const transfer = new DataTransfer();
        page.querySelector('ge-kanban-card[card-id="x1"]')!.dispatchEvent(dragEvent('dragstart', { dataTransfer: transfer }));
        done.dispatchEvent(dragEvent('dragenter', { dataTransfer: transfer }));
        done.dispatchEvent(dragEvent('dragover', { dataTransfer: transfer, clientY: 0 }));
        await settle(page);
        done.dispatchEvent(dragEvent('drop', { dataTransfer: transfer }));
        expect(moved[0]).toMatchObject({ cardId: 'x1', fromColumnId: 'todo', toColumnId: 'done', newOrder: 0 });
    });
});
