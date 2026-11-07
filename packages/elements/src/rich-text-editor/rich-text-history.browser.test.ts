
import { afterEach, describe, expect, it, vi } from 'vitest';
import { editableOf, editorIn, placeCaret, record, typeHtml } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';

afterEach(() => {
    vi.useRealTimers();
});

const ONE = '<ge-rich-text-editor mode="html" value="<p>one</p>"></ge-rich-text-editor>';

interface StackInternals {
    stack: { entries: { selection: unknown }[] };
}

const internalsOf = (editor: GeRichTextEditor): StackInternals => editor.provider('history') as unknown as StackInternals;

/**
 * Mounts an editor whose history controller has recorded the initial document. With `caretAt`, the caret is
 * placed in the first paragraph and recorded in that first entry, as if the user had placed it before it was taken.
 */
async function historyIn(markup = ONE, caretAt?: number) {
    const editor = await editorIn(markup);
    const editable = editableOf(editor);
    if (caretAt !== undefined) {
        placeCaret(editable.querySelector('p')!.firstChild!, caretAt);
        internalsOf(editor).stack.entries[0]!.selection = { startPath: [0, 0], startOffset: caretAt, endPath: [0, 0], endOffset: caretAt };
    }
    return { editor, editable };
}

const keydown = (editable: HTMLElement, init: KeyboardEventInit): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
    editable.dispatchEvent(event);
    return event;
};
const undoKey = (editable: HTMLElement) => keydown(editable, { key: 'z', ctrlKey: true });
const redoKey = (editable: HTMLElement) => keydown(editable, { key: 'z', ctrlKey: true, shiftKey: true });

const length = (editor: GeRichTextEditor) => editor.historyEntries().length;
const previews = (editor: GeRichTextEditor) => editor.historyEntries().map((entry) => entry.preview);

async function write(editor: GeRichTextEditor, html: string): Promise<void> {
    editor.value = html;
    await editor.updateComplete;
}

describe('history controller basics', () => {
    it('provides the history, records the initial document and detaches cleanly', async () => {
        const { editor } = await historyIn();

        expect(previews(editor)).toEqual(['one']);
        expect(editor.currentHistoryIndex()).toBe(0);
        expect(editor.canUndo).toBe(false);
        expect(editor.canRedo).toBe(false);

        editor.remove();
        expect(editor.canUndo).toBe(false);
        expect(editor.historyEntries()).toEqual([]);
    });

    it('restoreHistoryEntry ignores an out-of-range index', async () => {
        const { editor, editable } = await historyIn();
        await write(editor, '<p>two</p>');
        editor.pushHistory();
        const before = editor.currentHistoryIndex();

        editor.restoreHistoryEntry(length(editor));
        editor.restoreHistoryEntry(-1);

        expect(editor.currentHistoryIndex()).toBe(before);
        expect(editable.textContent).toBe('two');
    });

    it('is a no-op to restore a selection whose path no longer resolves', async () => {
        const { editor, editable } = await historyIn();
        const { stack } = internalsOf(editor);
        stack.entries[0]!.selection = { startPath: [0, 99], startOffset: 0, endPath: [0, 99], endOffset: 0 };
        await write(editor, '<p>two</p>');
        editor.pushHistory();

        expect(() => editor.restoreHistoryEntry(0)).not.toThrow();
        expect(editable.textContent).toBe('one');
    });

    it('is a no-op to restore a selection while the document has none', async () => {
        const { editor, editable } = await historyIn(ONE, 1);
        await write(editor, '<p>two</p>');
        editor.pushHistory();
        const spy = vi.spyOn(editor, 'getSelection').mockReturnValue(null);

        expect(() => editor.restoreHistoryEntry(0)).not.toThrow();
        spy.mockRestore();
        expect(editable.textContent).toBe('one');
    });

    it('restores the caret on undo and redo', async () => {
        const { editor, editable } = await historyIn(ONE, 1);

        const text = editable.querySelector('p')!.firstChild as Text;
        text.data = 'oneXYZ';
        placeCaret(text, text.length);
        editor.commit();
        expect(editable.textContent).toBe('oneXYZ');

        undoKey(editable);
        expect(editable.textContent).toBe('one');
        expect(document.getSelection()!.anchorOffset).toBe(1);

        keydown(editable, { key: 'y', ctrlKey: true });
        expect(editable.textContent).toBe('oneXYZ');
        expect(document.getSelection()!.anchorOffset).toBe(6);
    });
});

describe('history keyboard', () => {
    it('undoes on Ctrl+Z and Cmd+Z, redoes on Ctrl+Shift+Z, Cmd+Shift+Z and Ctrl+Y, and consumes the event', async () => {
        const { editor, editable } = await historyIn();
        await write(editor, '<p>two</p>');
        editor.pushHistory();

        expect(undoKey(editable).defaultPrevented).toBe(true);
        expect(editable.textContent).toBe('one');
        redoKey(editable);
        expect(editable.textContent).toBe('two');
        keydown(editable, { key: 'z', metaKey: true });
        expect(editable.textContent).toBe('one');
        keydown(editable, { key: 'Z', metaKey: true, shiftKey: true });
        expect(editable.textContent).toBe('two');
        undoKey(editable);
        keydown(editable, { key: 'y', ctrlKey: true });
        expect(editable.textContent).toBe('two');
    });

    it('ignores other keys, bare Z, and Alt combinations', async () => {
        const { editor, editable } = await historyIn();
        await write(editor, '<p>two</p>');
        editor.pushHistory();

        for (const init of [{ key: 'z' }, { key: 'b', ctrlKey: true }, { key: 'z', ctrlKey: true, altKey: true }]) {
            expect(keydown(editable, init).defaultPrevented).toBe(false);
        }
        expect(editable.textContent).toBe('two');
    });

    it('swallows the shortcut without acting while readonly', async () => {
        const { editor, editable } = await historyIn();
        await write(editor, '<p>two</p>');
        editor.pushHistory();
        editor.readonly = true;
        await editor.updateComplete;

        expect(undoKey(editable).defaultPrevented).toBe(true);
        expect(editable.textContent).toBe('two');
    });
});

describe('history recording', () => {
    it('debounces snapshots for rapid typing', async () => {
        const { editor } = await historyIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        editor.history = { debounceMs: 200 };
        vi.useFakeTimers();

        await typeHtml(editor, 'a');
        await typeHtml(editor, 'ab');
        await typeHtml(editor, 'abc');
        expect(length(editor)).toBe(1);

        vi.advanceTimersByTime(199);
        expect(length(editor)).toBe(1);

        vi.advanceTimersByTime(1);
        expect(length(editor)).toBe(2);
        expect(editor.historyEntries().at(-1)?.preview).toBe('abc');
    });

    it('flushPendingHistoryPush records the pending burst now and only once', async () => {
        const { editor } = await historyIn();
        await typeHtml(editor, '<p>one typed</p>');
        expect(length(editor)).toBe(1);

        editor.flushPendingHistoryPush();
        editor.flushPendingHistoryPush();

        expect(previews(editor)).toEqual(['one', 'one typed']);
    });

    it('does not let redo resurrect a branch the user typed over', async () => {
        const { editor, editable } = await historyIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
        editor.history = { debounceMs: 10 };
        vi.useFakeTimers();
        const type = async (text: string) => {
            await typeHtml(editor, `${editable.textContent ?? ''}${text}`);
            vi.advanceTimersByTime(40);
        };

        await type('A');
        await type('B');
        expect(editable.textContent).toBe('AB');

        editor.undo();
        expect(editable.textContent).toBe('A');

        await type('C');
        expect(editable.textContent).toBe('AC');

        editor.redo();
        expect(editable.textContent).toBe('AC');
    });

    it('records typing after an undo as a new edit', async () => {
        const { editor, editable } = await historyIn('<ge-rich-text-editor mode="html" value="<p>seed</p>"></ge-rich-text-editor>');
        await typeHtml(editor, '<p>seed edited</p>');
        editor.flushPendingHistoryPush();

        editor.undo();
        expect(editable.textContent).not.toContain('edited');

        await typeHtml(editor, '<p>seed again</p>');
        editor.flushPendingHistoryPush();

        expect(editor.htmlOutput).toContain('seed again');
        editor.undo();
        expect(editable.textContent).not.toContain('again');
    });

    it('records mutateContent as one undoable entry', async () => {
        const { editor, editable } = await historyIn();
        editor.mutateContent((root) => {
            root.innerHTML = '<p>abc</p>';
        });
        const before = editable.innerHTML;
        editor.mutateContent((root) => {
            const span = document.createElement('span');
            span.textContent = 'X';
            root.querySelector('p')!.append(span);
        });
        expect(editable.querySelector('span')).not.toBeNull();

        editor.undo();

        expect(editable.innerHTML).toBe(before);
    });

    it('stores multiline preview lines and bullets for list items', async () => {
        const { editor } = await historyIn();
        await write(editor, '<p>Line one</p><p>Line two</p><p>Line three</p><p>Line four</p>');
        editor.pushHistory();
        expect(editor.historyEntries().at(-1)).toMatchObject({
            lineCount: 4,
            previewLines: ['Line one', 'Line two', 'Line three'],
        });

        await write(editor, '<ul><li>First item</li><li>Second item</li></ul>');
        editor.pushHistory();
        expect(editor.historyEntries().at(-1)?.previewLines).toEqual(['• First item', '• Second item']);
    });
});

describe('history navigation', () => {
    it('selecting an entry restores its content and keeps forward history for redo', async () => {
        const { editor, editable } = await historyIn();
        for (const text of ['two', 'three']) {
            await write(editor, `<p>${text}</p>`);
            editor.pushHistory();
        }
        const baseline = previews(editor);
        expect(baseline).toEqual(['one', 'two', 'three']);

        editor.restoreHistoryEntry(0);

        expect(editable.textContent).toBe('one');
        expect(editor.currentHistoryIndex()).toBe(0);
        expect(previews(editor)).toEqual(baseline);
        expect(editor.canRedo).toBe(true);
    });

    it('reconstructs content from delta entries across many snapshots, undo and redo walking exactly', async () => {
        const { editor, editable } = await historyIn();
        const docs = Array.from({ length: 13 }, (_, i) => `<p>v${i}</p>`);
        for (const doc of docs) {
            await write(editor, doc);
            editor.pushHistory();
        }

        const undone: string[] = [];
        for (let i = 0; i < 12; i++) {
            undoKey(editable);
            undone.push(editable.innerHTML);
        }
        expect(undone).toEqual(docs.slice(0, 12).reverse());

        const redone: string[] = [];
        for (let i = 0; i < 12; i++) {
            keydown(editable, { key: 'y', ctrlKey: true });
            redone.push(editable.innerHTML);
        }
        expect(redone).toEqual(docs.slice(1));
    });

    it('trims to the configured limit, keeping the newest entries undoable', async () => {
        const { editor, editable } = await historyIn();
        editor.history = { limit: 10 };
        for (let i = 0; i < 15; i++) {
            await write(editor, `<p>entry ${i}</p>`);
            editor.pushHistory();
        }
        expect(length(editor)).toBe(10);

        const undone: string[] = [];
        for (let i = 0; i < 10; i++) {
            editor.undo();
            undone.push(editable.innerHTML);
        }
        expect(undone).toEqual([
            ...Array.from({ length: 9 }, (_, k) => `<p>entry ${13 - k}</p>`),
            '<p>entry 5</p>',
        ]);
    });

    it('projects the stack through the host surface', async () => {
        const { editor } = await historyIn();
        editor.mutateContent((root) => {
            root.innerHTML = '<p>second</p>';
        });

        const entries = editor.historyEntries();
        expect(editor.currentHistoryIndex()).toBe(entries.length - 1);
        expect(editor.reconstructHistoryEntry(entries.length - 1)?.html).toContain('second');
        expect(editor.reconstructHistoryEntry(entries.length - 1)?.markdown).toContain('second');
        expect(editor.reconstructHistoryEntry(-1)).toBeNull();
        expect(editor.reconstructHistoryEntry(999)).toBeNull();
    });

    it('drops a stale image selection when undo replaces the content', async () => {
        const { editor, editable } = await historyIn(
            '<ge-rich-text-editor mode="html" value="<p><img src=&quot;data:image/gif;base64,R0lGODlhAQABAAAAACw=&quot; alt=&quot;a&quot;></p>"></ge-rich-text-editor>',
        );
        const img = editable.querySelector('img')!;
        img.click();
        expect(editor.selectedImage).toBe(img);

        await typeHtml(editor, '<p>replaced</p>');
        editor.flushPendingHistoryPush();
        editor.undo();

        expect(img.isConnected).toBe(false);
        expect(editor.selectedImage).toBeNull();
    });
});

describe('history and the document model', () => {
    const loaded = async () => {
        const context = await historyIn();
        context.editor.markClean();
        return context;
    };

    it('setContent flushes an in-flight typing burst as its own entry', async () => {
        const { editor, editable } = await loaded();
        await typeHtml(editor, '<p>one typed</p>');

        editor.setContent('<p>loaded</p>');

        expect(editable.textContent).toBe('loaded');
        undoKey(editable);
        expect(editable.textContent).toBe('one typed');
    });

    it('setContent records one entry by default and undo/redo round-trips', async () => {
        const { editor, editable } = await loaded();
        const values = record<{ value: string }>(editor, 'value-change');
        const before = length(editor);

        editor.setContent('<p>two</p>');

        expect(length(editor) - before).toBe(1);
        expect(values.at(-1)?.value).toContain('two');
        expect(editor.canUndo).toBe(true);

        undoKey(editable);
        expect(editable.textContent).toBe('one');
        expect(values.at(-1)?.value).toContain('one');
        redoKey(editable);
        expect(editable.textContent).toBe('two');
    });

    it('setContent with recordHistory:false leaves the stack length unchanged', async () => {
        const { editor, editable } = await loaded();
        const before = length(editor);

        editor.setContent('<p>two</p>', { recordHistory: false });

        expect(length(editor)).toBe(before);
        expect(editable.textContent).toBe('two');
    });

    it('an external value write records nothing by default', async () => {
        const { editor, editable } = await loaded();
        const values = record(editor, 'value-change');
        const before = length(editor);

        await write(editor, '<p>three</p>');

        expect(length(editor)).toBe(before);
        expect(values).toHaveLength(0);
        expect(editable.textContent).toBe('three');
    });

    it('recordExternalWrites makes a value write one entry that undo reverses', async () => {
        const { editor, editable } = await loaded();
        editor.history = { recordExternalWrites: true };
        const before = length(editor);

        await write(editor, '<p>draft</p>');

        expect(length(editor) - before).toBe(1);
        undoKey(editable);
        expect(editable.textContent).toBe('one');
    });

    it('recordExternalWrites flushes an in-flight typing burst before the write', async () => {
        const { editor, editable } = await loaded();
        editor.history = { recordExternalWrites: true };
        await typeHtml(editor, '<p>one typed</p>');

        await write(editor, '<p>loaded</p>');

        expect(editable.textContent).toBe('loaded');
        undoKey(editable);
        expect(editable.textContent).toBe('one typed');
    });

    it('history-change reports canUndo and canRedo on push, undo, redo and restore', async () => {
        const { editor, editable } = await loaded();
        const seen = record<{ canUndo: boolean; canRedo: boolean }>(editor, 'history-change');

        editor.setContent('<p>two</p>');
        expect(seen.at(-1)).toEqual({ canUndo: true, canRedo: false });

        undoKey(editable);
        expect(seen.at(-1)?.canRedo).toBe(true);

        redoKey(editable);
        expect(seen.at(-1)).toEqual({ canUndo: true, canRedo: false });

        const count = seen.length;
        editor.restoreHistoryEntry(0);
        expect(seen.length).toBeGreaterThan(count);
        expect(seen.at(-1)).toEqual({ canUndo: false, canRedo: true });
    });

    it('history-change still fires when the stack trims', async () => {
        const { editor } = await loaded();
        editor.history = { limit: 10 };
        const seen = record<{ canUndo: boolean; canRedo: boolean }>(editor, 'history-change');

        for (let i = 0; i < 15; i++) editor.setContent(`<p>v${i}</p>`);

        expect(seen).toHaveLength(15);
        expect(length(editor)).toBeLessThanOrEqual(11);
        expect(seen.at(-1)).toEqual({ canUndo: true, canRedo: false });
    });

    it('canUndo and canRedo mirror the last history-change', async () => {
        const { editor, editable } = await loaded();
        const seen = record<{ canUndo: boolean; canRedo: boolean }>(editor, 'history-change');
        const state = () => ({ canUndo: editor.canUndo, canRedo: editor.canRedo });

        editor.setContent('<p>two</p>');
        expect(state()).toEqual(seen.at(-1));
        undoKey(editable);
        expect(state()).toEqual(seen.at(-1));
        redoKey(editable);
        expect(state()).toEqual(seen.at(-1));
    });

    it('isDirty is true after typing and false after undoing back to the loaded content', async () => {
        const { editor, editable } = await loaded();
        await typeHtml(editor, '<p>one changed</p>');
        editor.flushPendingHistoryPush();
        expect(editor.isDirty).toBe(true);

        undoKey(editable);

        expect(editable.textContent).toBe('one');
        expect(editor.isDirty).toBe(false);
    });

    it('setContent does not reset isDirty; a value write does', async () => {
        const { editor } = await loaded();
        await typeHtml(editor, '<p>edited</p>');
        editor.flushPendingHistoryPush();
        expect(editor.isDirty).toBe(true);

        editor.setContent('<p>programmatic</p>');
        expect(editor.isDirty).toBe(true);

        await write(editor, '<p>loaded</p>');
        expect(editor.isDirty).toBe(false);
    });
});

describe('history with inserts', () => {
    const typeHello = async () => {
        const { editor, editable } = await historyIn('<ge-rich-text-editor mode="html" value="<p>hi</p>"></ge-rich-text-editor>');
        const text = editable.querySelector('p')!.firstChild as Text;
        placeCaret(text, text.length);
        editor.saveSelection();
        return { editor, editable, before: length(editor) };
    };

    it('insertTextFromOverlay records its own entry; one undo removes only the inserted text (Angular spec 10646-10662)', async () => {
        const { editor, editable, before } = await typeHello();

        editor.insertTextFromOverlay('!');

        expect(length(editor) - before).toBe(1);
        expect(editable.textContent).toBe('hi!');
        editor.undo();
        expect(editable.textContent).toBe('hi');
    });

    it('insertText records one entry, is a no-op when empty, readonly or disabled (Angular spec 10901-10960)', async () => {
        const { editor, editable, before } = await typeHello();

        editor.insertText(' there');
        expect(length(editor) - before).toBe(1);
        expect(editable.textContent).toBe('hi there');

        editor.insertText('');
        editor.readonly = true;
        editor.insertText('x');
        editor.readonly = false;
        editor.disabled = true;
        editor.insertText('x');
        expect(length(editor) - before).toBe(1);
        expect(editable.textContent).toBe('hi there');
    });
});

describe('history cases that need other controllers', () => {
    // needs clipboard (L) (Angular spec 1102-1135): undo after a truncated paste
    it.skip('supports undo after a truncated paste', () => undefined);
    // needs clipboard (L) (Angular spec 1286-1314): caret restore around a paste; the caret half runs above
    it.skip('restores the caret across a real paste', () => undefined);
    // needs find (Angular spec 4999-5030): replaceAll flushes pending typing and records exactly one entry
    it.skip('replaceAll is one undo step', () => undefined);
    // needs markdown-shortcuts (Angular spec 10137-10181): transform is one undo step, Backspace reverts
    it.skip('a markdown shortcut transform is one undo step and Backspace reverts it', () => undefined);
    // needs code-highlight (Angular spec 4865-4880): highlighting never enters history
    it.skip('code highlighting never enters history', () => undefined);
    // needs table-interaction (Angular spec 4365): a menu action whose target was detached by an undo
    it.skip('ignores a table menu action whose target was detached by undo', () => undefined);
});
