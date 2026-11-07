import { afterEach, describe, expect, it, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { shortcutBindings } from '../../../shared/shortcut-bindings.js';
import { editableOf, editorIn, placeCaret, record, selectBetween, typeHtml } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import '../../locales/he.js';
import './define.js';
import { RICH_TEXT_HISTORY_LOCALES } from './index.js';

const EN = RICH_TEXT_HISTORY_LOCALES.en;

afterEach(() => {
    vi.useRealTimers();
    document.getSelection()?.removeAllRanges();
});

async function historyEditor(content = '', attrs = ''): Promise<GeRichTextEditor> {
    const value = content ? `value="${content}"` : '';
    return editorIn(`<ge-rich-text-editor mode="html" addons="history" ${value} ${attrs}></ge-rich-text-editor>`);
}

async function write(editor: GeRichTextEditor, html: string): Promise<void> {
    editor.value = html;
    await editor.updateComplete;
}

async function pushEntry(editor: GeRichTextEditor, html: string): Promise<void> {
    await write(editor, html);
    editor.pushHistory();
}

const cornerOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<HTMLElement>('[data-slot="rte-history-panel"]');
const popoverOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<HTMLElement & { open: boolean; updateComplete: Promise<unknown> }>('ge-popover');
const dialogs = (editor: GeRichTextEditor) => [...editor.shadowRoot!.querySelectorAll<HTMLElement & { open: boolean; updateComplete: Promise<unknown> }>('ge-dialog')];
const rowOf = (editor: GeRichTextEditor, list: 'popover' | 'dialog', index: number) =>
    editor.shadowRoot!.querySelector<HTMLElement>(`[data-history-list="${list}"] [data-history-entry-index="${index}"]`);

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await editor.updateComplete;
    await popoverOf(editor)?.updateComplete;
    await Promise.all(dialogs(editor).map((dialog) => dialog.updateComplete));
    await new Promise((resolve) => requestAnimationFrame(resolve));
}

const shortcut = (editor: GeRichTextEditor, init: KeyboardEventInit) =>
    editableOf(editor).dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

describe('history addon: lifecycle', () => {
    it('removes the corner live when switched off, and restores it', async () => {
        const editor = await historyEditor();
        expect(cornerOf(editor)).not.toBeNull();

        editor.addonOptions = { history: false };
        await settle(editor);
        expect(cornerOf(editor)).toBeNull();

        editor.addonOptions = {};
        await settle(editor);
        expect(cornerOf(editor)).not.toBeNull();
    });

    it('keeps the shortcut and drops only the button with toolbar:false', async () => {
        const editor = await historyEditor('', '');
        editor.addonOptions = { history: { toolbar: false } };
        await settle(editor);
        expect(cornerOf(editor)).toBeNull();

        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);
        expect(dialogs(editor)[1]!.open).toBe(true);
    });

    it('hides the corner while readonly', async () => {
        const editor = await historyEditor('', 'readonly');
        expect(cornerOf(editor)).toBeNull();
    });

    it('labels the button with the revision count and follows new entries', async () => {
        const editor = await historyEditor('<p>one</p>');
        const button = () => cornerOf(editor)!.querySelector('ge-button')!.textContent!.trim();
        expect(button()).toBe('History (1)');

        await pushEntry(editor, '<p>two</p>');
        await settle(editor);
        expect(button()).toBe('History (2)');
    });

    it('localizes the panel strings (he)', async () => {
        const editor = await historyEditor('', 'locale="he"');
        expect(cornerOf(editor)!.querySelector('ge-button')!.textContent!.trim()).toBe('היסטוריה (1)');
        expect(cornerOf(editor)!.querySelector('ge-button')!.getAttribute('aria-label')).toBe(RICH_TEXT_HISTORY_LOCALES.he!.ariaOpen);
    });

    it('takes a locale from the addon options', async () => {
        const editor = await historyEditor();
        editor.addonOptions = { history: { locale: 'de' } };
        await settle(editor);
        expect(cornerOf(editor)!.querySelector('ge-button')!.textContent!.trim()).toBe('Verlauf (1)');
    });

    it('disables the corner button while the editor is disabled', async () => {
        const editor = await historyEditor('', 'disabled');
        expect(cornerOf(editor)!.querySelector('ge-button')!.hasAttribute('disabled')).toBe(true);
    });
});

describe('history addon: the revision list', () => {
    it('opens the popover from the button and lists the revisions newest first', async () => {
        const editor = await historyEditor('<p>one</p>');
        await pushEntry(editor, '<p>two</p>');
        cornerOf(editor)!.querySelector<HTMLElement>('ge-button')!.click();
        await settle(editor);

        expect(popoverOf(editor)!.open).toBe(true);
        const rows = [...editor.shadowRoot!.querySelectorAll('[data-history-list="popover"] [data-history-entry-index]')];
        expect(rows.map((row) => row.getAttribute('data-history-entry-index'))).toEqual(['1', '0']);
        expect(rows[0]!.hasAttribute('data-active')).toBe(true);
    });

    it('flushes a pending debounced snapshot when the panel opens', async () => {
        const editor = await historyEditor('<p>one</p>');
        await typeHtml(editor, '<p>draft</p>');
        expect(editor.historyEntries()).toHaveLength(1);

        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        expect(editor.historyEntries()).toHaveLength(2);
        await settle(editor);
        expect(popoverOf(editor)!.open).toBe(true);
    });

    it('restores an earlier revision from its row, keeps forward entries for redo and emits history-restore', async () => {
        const editor = await historyEditor('<p>one</p>');
        await pushEntry(editor, '<p>two</p>');
        await pushEntry(editor, '<p>three</p>');
        const restored = record<number>(editor, 'history-restore');
        const before = editor.historyEntries().length;
        const oneIndex = editor.historyEntries().findIndex((entry) => entry.preview === 'one');

        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);
        rowOf(editor, 'popover', oneIndex)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await settle(editor);

        expect(editableOf(editor).textContent).toBe('one');
        expect(editor.currentHistoryIndex()).toBe(oneIndex);
        expect(editor.historyEntries()).toHaveLength(before);
        expect(restored).toEqual([oneIndex]);

        editor.redo();
        expect(editableOf(editor).textContent).toBe('two');
    });

    it('keeps the popover open after a quick apply by click', async () => {
        const editor = await historyEditor('<p>one</p>');
        await pushEntry(editor, '<p>two</p>');
        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);

        rowOf(editor, 'popover', 0)!.click();
        await settle(editor);

        expect(popoverOf(editor)!.open).toBe(true);
        expect(editableOf(editor).textContent).toBe('one');
        expect(editor.shadowRoot!.querySelector('.history-applied')).not.toBeNull();
    });

    it('closes the popover from its close button', async () => {
        const editor = await historyEditor();
        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);
        editor.shadowRoot!.querySelector<HTMLElement>('.history-close')!.click();
        await settle(editor);
        expect(popoverOf(editor)!.open).toBe(false);
    });
});

describe('history addon: the shortcut', () => {
    it('opens the revision list on Ctrl+Shift+H', async () => {
        const editor = await historyEditor('<p>one</p>');
        expect(popoverOf(editor)!.open).toBe(false);

        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);
        expect(popoverOf(editor)!.open).toBe(true);
    });

    it('opens the browser dialog when the button is hidden', async () => {
        const editor = await historyEditor();
        editor.addonOptions = { history: { toolbar: false } };
        await settle(editor);

        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);
        const [, browser] = dialogs(editor);
        expect(browser!.open).toBe(true);
        expect(browser!.querySelector('[data-history-list="dialog"]')).not.toBeNull();
    });

    it('honours a shortcut-binding override for the history action', async () => {
        const editor = await historyEditor();
        shortcutBindings.setShortcutOverride('rich-text.history', 'Ctrl+Shift+J');
        try {
            shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
            await settle(editor);
            expect(popoverOf(editor)!.open).toBe(false);

            shortcut(editor, { key: 'j', ctrlKey: true, shiftKey: true });
            await settle(editor);
            expect(popoverOf(editor)!.open).toBe(true);
        } finally {
            shortcutBindings.clearShortcutOverride('rich-text.history');
        }
    });

    it('does nothing while readonly', async () => {
        const editor = await historyEditor('', 'readonly');
        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);
        expect(dialogs(editor).every((dialog) => !dialog.open)).toBe(true);
    });
});

describe('history addon: the restore dialog', () => {
    async function openPreview(editor: GeRichTextEditor, index: number): Promise<void> {
        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);
        rowOf(editor, 'popover', index)!.querySelector<HTMLElement>('.history-preview-button')!.click();
        await settle(editor);
    }

    it('renders the revision html and markdown, sanitized', async () => {
        const editor = await historyEditor('<p>alpha</p>');
        await pushEntry(editor, '<p>beta</p>');
        await openPreview(editor, 0);

        const [preview] = dialogs(editor);
        expect(preview!.open).toBe(true);
        expect([...preview!.querySelector('.history-rendered')!.children].map((child) => child.outerHTML)).toEqual(['<p>alpha</p>']);
        expect(preview!.querySelector('pre')?.textContent).toBe('alpha');
    });

    it('restores the revision on confirm and closes', async () => {
        const editor = await historyEditor('<p>alpha</p>');
        await pushEntry(editor, '<p>beta</p>');
        const restored = record<number>(editor, 'history-restore');
        await openPreview(editor, 0);

        const confirm = [...dialogs(editor)[0]!.querySelectorAll<HTMLElement>('.history-footer ge-button')].at(-1)!;
        expect(confirm.textContent?.trim()).toBe(EN.restore);
        confirm.click();
        await settle(editor);

        expect(editableOf(editor).textContent).toBe('alpha');
        expect(restored).toEqual([0]);
        expect(dialogs(editor)[0]!.open).toBe(false);
    });

    it('leaves the document alone on cancel', async () => {
        const editor = await historyEditor('<p>alpha</p>');
        await pushEntry(editor, '<p>beta</p>');
        const restored = record<number>(editor, 'history-restore');
        await openPreview(editor, 0);

        dialogs(editor)[0]!.querySelector<HTMLElement>('.history-footer ge-button')!.click();
        await settle(editor);

        expect(editableOf(editor).textContent).toBe('beta');
        expect(restored).toEqual([]);
        expect(dialogs(editor)[0]!.open).toBe(false);
    });
});

describe('history addon: floating toolbar', () => {
    it('keeps the corner button, the shortcut and the editor selection when the bubble is the toolbar', async () => {
        const editor = await historyEditor('<p>Hello world</p>', 'toolbar="floating"');
        await pushEntry(editor, '<p>Hello there</p>');
        const text = editableOf(editor).querySelector('p')!.firstChild as Text;
        selectBetween(text, 0, text, 5);
        editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
        await editor.updateComplete;

        cornerOf(editor)!.querySelector<HTMLElement>('ge-button')!.click();
        await settle(editor);
        expect(popoverOf(editor)!.open).toBe(true);

        rowOf(editor, 'popover', 0)!.click();
        await settle(editor);
        expect(editableOf(editor).textContent).toBe('Hello world');
    });
});

describe('history addon: touch targets', () => {
    afterEach(() => cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 }));

    async function closeRect(touch: boolean): Promise<DOMRect> {
        await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 1 });
        const editor = await historyEditor();
        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);
        await Promise.all(document.getAnimations().map((animation) => animation.finished));
        return editor.shadowRoot!.querySelector<HTMLElement>('.history-close')!.getBoundingClientRect();
    }

    it('grows the close button to a 44x44 target on a coarse pointer only', async () => {
        const fine = await closeRect(false);
        const coarse = await closeRect(true);

        expect([fine.width, fine.height]).toEqual([28, 28]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });
});

describe('history addon: caret', () => {
    it('does not move the caret out of the editor when the list opens', async () => {
        const editor = await historyEditor('<p>one</p>');
        const text = editableOf(editor).querySelector('p')!.firstChild!;
        placeCaret(text, 1);
        shortcut(editor, { key: 'h', ctrlKey: true, shiftKey: true });
        await settle(editor);
        expect(editableOf(editor).textContent).toBe('one');
    });
});
