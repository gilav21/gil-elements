import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createEditor, editableOf, load, placeCaret, record, selectContents } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import '../../locales/he.js';
import type { GeRichTextToolbar } from '../../toolbar-index.js';
import './define.js';
import { TABLES_COMMAND_ID, type RichTextTableInsert } from './tables.js';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const make = (setup?: (editor: GeRichTextEditor) => void): Promise<GeRichTextEditor> =>
    createEditor((editor) => {
        editor.mode = 'html';
        editor.addons = 'tables';
        setup?.(editor);
    });

const topBar = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('.toolbar ge-rich-text-toolbar');
const bubbleBar = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('[data-slot="rich-text-floating-toolbar"] ge-rich-text-toolbar');
const slotOf = (bar: GeRichTextToolbar | null) => bar?.shadowRoot!.querySelector<HTMLElement>('[data-addon-slot="tables.insert"]') ?? null;
const triggerOf = (bar: GeRichTextToolbar | null) => slotOf(bar)!.querySelector<HTMLButtonElement>('ge-popover-trigger button')!;
const popoverOf = (bar: GeRichTextToolbar | null) => slotOf(bar)!.querySelector('ge-popover')!;
const cell = (bar: GeRichTextToolbar | null, size: string) => slotOf(bar)!.querySelector<HTMLButtonElement>(`[data-grid-cell][aria-label="${size}"]`)!;

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await (topBar(editor) ?? bubbleBar(editor))?.updateComplete;
}

async function openPanel(editor: GeRichTextEditor, bar = topBar(editor)): Promise<void> {
    triggerOf(bar).click();
    await popoverOf(bar).updateComplete;
    await wait(0);
}

async function withCaret(html = '<p>start</p>', offset = 5): Promise<GeRichTextEditor> {
    const editor = await make();
    await load(editor, html);
    placeCaret(editableOf(editor).querySelector('p')!.firstChild!, offset);
    return editor;
}

async function insertGrid(editor: GeRichTextEditor, size: string): Promise<void> {
    await openPanel(editor);
    cell(topBar(editor), size).click();
    await settle(editor);
}

describe('tables addon', () => {
    it('contributes its toolbar button, removes it when switched off and restores it when switched on', async () => {
        const editor = await make();
        await settle(editor);
        expect(triggerOf(topBar(editor)).title).toBe('Insert Table');

        editor.addonOptions = { tables: false };
        await settle(editor);
        expect(slotOf(topBar(editor))).toBeNull();

        editor.addonOptions = { tables: true };
        await settle(editor);
        expect(slotOf(topBar(editor))).not.toBeNull();
    });

    it('inserts a 3x4 table with a header row and emits table-insert', async () => {
        const editor = await withCaret();
        const inserted = record<RichTextTableInsert>(editor, 'table-insert');

        await insertGrid(editor, '3x4');

        const table = editableOf(editor).querySelector('table')!;
        expect(table.querySelectorAll('thead tr th')).toHaveLength(4);
        const bodyRows = [...table.querySelectorAll('tbody tr')];
        expect(bodyRows).toHaveLength(2);
        for (const row of bodyRows) expect(row.querySelectorAll('td')).toHaveLength(4);
        expect(inserted).toEqual([{ rows: 3, cols: 4 }]);
        expect(table.nextElementSibling?.tagName).toBe('P');
    });

    it('inserts a header-only table for a 1x1 selection', async () => {
        const editor = await withCaret('<p>x</p>', 1);

        await insertGrid(editor, '1x1');

        const table = editableOf(editor).querySelector('table')!;
        expect(table.querySelectorAll('thead tr th')).toHaveLength(1);
        expect(table.querySelectorAll('tbody tr')).toHaveLength(0);
    });

    it('inserts at the caret saved when the grid opened, after the selection has left the editor', async () => {
        const editor = await withCaret('<p>first</p><p>second</p>', 5);
        await openPanel(editor);
        const outside = document.createElement('p');
        outside.textContent = 'elsewhere';
        document.body.append(outside);
        placeCaret(outside.firstChild!, 3);

        cell(topBar(editor), '2x2').click();
        await settle(editor);
        outside.remove();

        const content = editableOf(editor);
        expect([...content.children].map((child) => child.tagName)).toEqual(['P', 'TABLE', 'P', 'P']);
        expect(content.children[0]!.textContent).toBe('first');
        expect(content.children[3]!.textContent).toBe('second');
    });

    it('shows the hovered size, resets it when the panel closes, and closes on select', async () => {
        const editor = await withCaret();
        await openPanel(editor);
        const hint = () => slotOf(topBar(editor))!.querySelector('.rte-tables-hint')?.textContent;
        expect(hint()).toBe('Insert Table');

        cell(topBar(editor), '3x4').dispatchEvent(new MouseEvent('mouseenter'));
        expect(hint()).toBe('3 x 4');
        expect(slotOf(topBar(editor))!.querySelectorAll('[data-grid-cell][data-on]')).toHaveLength(12);

        popoverOf(topBar(editor)).hide();
        await wait(0);
        await openPanel(editor);
        expect(hint()).toBe('Insert Table');

        cell(topBar(editor), '2x3').click();
        await settle(editor);
        expect(editableOf(editor).querySelector('table')).not.toBeNull();
        expect(popoverOf(topBar(editor)).open).toBe(false);
    });

    it('does not insert while the editor is disabled, and disables the button', async () => {
        const editor = await withCaret('<p>x</p>', 1);
        const inserted = record(editor, 'table-insert');
        await openPanel(editor);
        const grid = cell(topBar(editor), '2x2');
        editor.disabled = true;
        await settle(editor);

        grid.click();
        await settle(editor);

        expect(editableOf(editor).querySelector('table')).toBeNull();
        expect(inserted).toEqual([]);
        expect(triggerOf(topBar(editor)).disabled).toBe(true);
    });

    it('has no toolbar button while the editor is readonly', async () => {
        const editor = await make((el) => {
            el.readonly = true;
        });
        expect(slotOf(topBar(editor))).toBeNull();
    });

    it('localizes the tooltip from the editor locale and from its own locale option', async () => {
        const editor = await make((el) => {
            el.locale = 'he';
        });
        expect(triggerOf(topBar(editor)).title).toBe('הוספת טבלה');

        const override = await make((el) => {
            el.locale = 'he';
            el.addonOptions = { tables: { locale: 'de' } };
        });
        expect(triggerOf(topBar(override)).title).toBe('Tabelle einfügen');
    });

    it('removes its toolbar slot and slash command when the editor goes away', async () => {
        const editor = await make();
        expect(editor.toolbarSlots.slots).toHaveLength(1);
        expect(editor.commands.listCommands().map((command) => command.id)).toEqual([TABLES_COMMAND_ID]);

        editor.addons = '';
        await editor.updateComplete;
        expect(editor.toolbarSlots.slots).toHaveLength(0);
        expect(editor.commands.listCommands()).toHaveLength(0);
    });

    describe('options', () => {
        it('keeps the slash command without the button for toolbar: false, and the button without it for slashCommand: false', async () => {
            const noButton = await make((el) => {
                el.addonOptions = { tables: { toolbar: false } };
            });
            expect(noButton.toolbarSlots.slots).toHaveLength(0);
            expect(noButton.commands.listCommands()).toHaveLength(1);

            const noCommand = await make((el) => {
                el.addonOptions = { tables: { slashCommand: false } };
            });
            expect(noCommand.toolbarSlots.slots).toHaveLength(1);
            expect(noCommand.commands.listCommands()).toHaveLength(0);
        });

        it('places the button by order', async () => {
            const editor = await make((el) => {
                el.addonOptions = { tables: { order: 12 } };
            });
            expect(editor.toolbarSlots.slots[0]!.order).toBe(12);
        });
    });

    describe('/table slash command', () => {
        it('inserts a 3x3 table at the caret and announces it', async () => {
            const editor = await withCaret('<p>start</p>', 5);
            const inserted = record<RichTextTableInsert>(editor, 'table-insert');

            editor.commands.listCommands().find((command) => command.id === TABLES_COMMAND_ID)!.run({} as never);
            await editor.updateComplete;

            expect(editableOf(editor).querySelectorAll('tbody tr')).toHaveLength(2);
            expect(inserted).toEqual([{ rows: 3, cols: 3 }]);
        });

        it('is hidden while the editor is disabled or readonly', async () => {
            const editor = await make();
            const command = editor.commands.listCommands()[0]!;
            const context = { query: '', hasSelection: false };
            expect(command.when!({ ...context, disabled: false, readonly: false })).toBe(true);
            expect(command.when!({ ...context, disabled: true, readonly: false })).toBe(false);
            expect(command.when!({ ...context, disabled: false, readonly: true })).toBe(false);
        });
    });

    describe('popover behaviour in the toolbar', () => {
        it('opens one panel at a time', async () => {
            const editor = await make();
            let closed = 0;
            editor.registerExclusivePopover(() => closed++);
            await openPanel(editor);
            expect(popoverOf(topBar(editor)).open).toBe(true);
            closed = 0;

            const other = editor.registerExclusivePopover(() => popoverOf(topBar(editor)).hide());
            other.notifyOpened();
            await wait(0);
            expect(popoverOf(topBar(editor)).open).toBe(false);
            expect(closed).toBe(1);
        });

        it('draws the panel in the top layer, unclipped by the toolbar', async () => {
            const editor = await withCaret();
            await openPanel(editor);

            const panel = slotOf(topBar(editor))!.querySelector('ge-popover-content')!.shadowRoot!.querySelector<HTMLElement>('.panel')!;
            expect(panel.matches(':popover-open')).toBe(true);
            const rect = panel.getBoundingClientRect();
            expect(rect.width).toBeGreaterThan(100);
            expect(document.elementFromPoint(rect.left + 12, rect.top + 12)).not.toBeNull();
        });
    });

    describe('toolbar="floating"', () => {
        async function floating(): Promise<GeRichTextEditor> {
            const editor = await make((el) => {
                el.toolbar = 'floating';
            });
            await load(editor, '<p>Hello world</p>');
            const text = editableOf(editor).querySelector('p')!.firstChild!;
            selectContents(editableOf(editor).querySelector('p')!);
            editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
            await settle(editor);
            expect(text.textContent).toBe('Hello world');
            return editor;
        }

        it('offers the button in the bubble, and a table lands at the selection after the bubble lost focus', async () => {
            const editor = await floating();
            const bar = bubbleBar(editor);
            expect(slotOf(bar)).not.toBeNull();

            await userEvent.click(triggerOf(bar));
            await popoverOf(bar).updateComplete;
            expect(popoverOf(bar).open).toBe(true);
            await wait(400);
            expect(bubbleBar(editor)).toBe(bar);
            expect(popoverOf(bar).open).toBe(true);

            await userEvent.click(cell(bar, '2x2'));
            await settle(editor);

            expect(editableOf(editor).querySelector('table')).not.toBeNull();
            expect(editableOf(editor).textContent).toContain('Hello world');
        });
    });
});
