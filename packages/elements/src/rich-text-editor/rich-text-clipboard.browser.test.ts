import { describe, expect, it } from 'vitest';
import { blockEditor, editableOf, placeCaret, selectBetween } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';

/** An html-mode editor with the caret at the end of its first text node. */
async function clipboardEditor(html: string, maxLength?: number): Promise<GeRichTextEditor> {
    const editor = await blockEditor(html);
    if (maxLength !== undefined) {
        editor.maxLength = maxLength;
        await editor.updateComplete;
    }
    const text = firstText(editor);
    if (text) placeCaret(text, text.length);
    return editor;
}

const firstText = (editor: Element): Text | null =>
    document.createTreeWalker(editableOf(editor), NodeFilter.SHOW_TEXT).nextNode() as Text | null;

function transfer(data: Record<string, string>): DataTransfer {
    const dataTransfer = new DataTransfer();
    for (const [type, value] of Object.entries(data)) dataTransfer.setData(type, value);
    return dataTransfer;
}

function paste(editor: Element, data: Record<string, string>): ClipboardEvent {
    const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: transfer(data) });
    editableOf(editor).dispatchEvent(event);
    return event;
}

function beforeInput(editor: Element, init: InputEventInit & { dataTransfer?: DataTransfer }): InputEvent {
    const event = new InputEvent('beforeinput', { bubbles: true, cancelable: true, ...init });
    editableOf(editor).dispatchEvent(event);
    return event;
}

function drop(editor: Element, data: Record<string, string>): DragEvent {
    const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer(data) });
    editableOf(editor).dispatchEvent(event);
    return event;
}

const undo = (editor: Element) =>
    editableOf(editor).dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));

describe('paste insertion', () => {
    it('inserts the clipboard HTML sanitized, and cancels the native paste', async () => {
        const editor = await clipboardEditor('<p>ab</p>');

        const event = paste(editor, { 'text/html': '<b>cd</b><script>alert(1)</script>' });

        expect(event.defaultPrevented).toBe(true);
        expect(editableOf(editor).textContent).toBe('abcd');
        expect(editableOf(editor).querySelector('script')).toBeNull();
        expect(editableOf(editor).querySelector('b, strong')?.textContent).toBe('cd');
    });

    it('falls back to the plain text flavour', async () => {
        const editor = await clipboardEditor('<p>ab</p>');

        paste(editor, { 'text/plain': 'cd' });

        expect(editableOf(editor).textContent).toBe('abcd');
    });

    it('converts a markdown clipboard to formatted content', async () => {
        const editor = await clipboardEditor('<p>ab</p>');

        paste(editor, { 'text/plain': '# Title\n\n- one\n- two' });

        expect(editableOf(editor).querySelector('h1')?.textContent).toBe('Title');
        expect(editableOf(editor).querySelectorAll('li')).toHaveLength(2);
    });

    it('does not nest pasted paragraphs inside the current one', async () => {
        const editor = await clipboardEditor('<p>hello</p>');

        paste(editor, { 'text/html': '<p>one</p><p>two</p>' });

        const root = editableOf(editor);
        expect(root.querySelector('p p')).toBeNull();
        expect(root.textContent).toContain('one');
        expect(root.textContent).toContain('two');
    });

    it('does not split the table when pasting a block into a cell', async () => {
        const editor = await clipboardEditor('<table><tbody><tr><td>A1</td><td>B1</td></tr><tr><td>A2</td><td>B2</td></tr></tbody></table>');
        placeCaret(editableOf(editor).querySelector('td')!.firstChild!, 2);

        paste(editor, { 'text/html': '<p>X</p>' });

        const root = editableOf(editor);
        expect(root.querySelectorAll('table')).toHaveLength(1);
        expect(root.querySelectorAll('td')).toHaveLength(4);
        expect(root.textContent).toContain('X');
    });

    it('does not put a paragraph directly inside a list', async () => {
        const editor = await clipboardEditor('<ul><li>alpha</li><li>beta</li></ul>');
        placeCaret(editableOf(editor).querySelector('li')!.firstChild!, 5);

        paste(editor, { 'text/html': '<p>one</p><p>two</p>' });

        expect(editableOf(editor).querySelector('ul > p')).toBeNull();
        expect(editableOf(editor).textContent).toContain('one');
    });
});

describe('paste interceptors and guards', () => {
    it('leaves the paste to an interceptor that consumes it', async () => {
        const editor = await clipboardEditor('<p>ab</p>');
        const off = editor.registerPasteInterceptor(() => true);

        paste(editor, { 'text/plain': 'cd' });
        expect(editableOf(editor).textContent).toBe('ab');

        off();
        paste(editor, { 'text/plain': 'cd' });
        expect(editableOf(editor).textContent).toBe('abcd');
    });

    it('continues past an interceptor that returns false', async () => {
        const editor = await clipboardEditor('<p>ab</p>');
        let seen = 0;
        editor.registerPasteInterceptor(() => {
            seen++;
            return false;
        });

        paste(editor, { 'text/plain': 'cd' });

        expect(seen).toBe(1);
        expect(editableOf(editor).textContent).toBe('abcd');
    });

    it('inserts nothing while readonly or disabled', async () => {
        const editor = await clipboardEditor('<p>ab</p>');

        editor.readonly = true;
        await editor.updateComplete;
        paste(editor, { 'text/plain': 'cd' });
        editor.readonly = false;
        editor.disabled = true;
        await editor.updateComplete;
        const event = paste(editor, { 'text/plain': 'cd' });

        expect(event.defaultPrevented).toBe(true);
        expect(editableOf(editor).textContent).toBe('ab');
    });
});

describe('maxLength on paste', () => {
    it('truncates an over-long paste to the remaining budget and undoes it as one step', async () => {
        const editor = await clipboardEditor('<p>abc</p>', 5);

        paste(editor, { 'text/plain': 'defgh' });
        expect(editableOf(editor).textContent).toBe('abcde');

        undo(editor);
        expect(editableOf(editor).textContent).toBe('abc');
    });

    it('truncates by graphemes, never splitting a character', async () => {
        const editor = await clipboardEditor('<p></p>', 3);
        placeCaret(editableOf(editor).querySelector('p')!, 0);

        paste(editor, { 'text/plain': '😀😁😂😃😄' });

        const text = editableOf(editor).textContent ?? '';
        expect([...text]).toHaveLength(3);
        expect(text).toBe('😀😁😂');
    });

    it('drops the paste when no budget is left', async () => {
        const editor = await clipboardEditor('<p>abc</p>', 3);

        paste(editor, { 'text/plain': 'x' });

        expect(editableOf(editor).textContent).toBe('abc');
    });

    it('lets a paste that fits through untruncated', async () => {
        const editor = await clipboardEditor('<p>ab</p>', 10);

        paste(editor, { 'text/plain': 'cd' });

        expect(editableOf(editor).textContent).toBe('abcd');
    });

    it('counts a replaced selection as freed budget', async () => {
        const editor = await clipboardEditor('<p>abcde</p>', 5);
        const text = firstText(editor)!;
        selectBetween(text, 1, text, 4);

        paste(editor, { 'text/plain': 'XY' });

        expect(editableOf(editor).textContent).toBe('aXYe');
    });

    it('budgets by the HTML flavour that is inserted, not the plain one', async () => {
        const editor = await clipboardEditor('<p>12345678</p>', 10);

        paste(editor, { 'text/plain': 'A', 'text/html': '<p>ABCDEFGHIJKLMNOP</p>' });

        expect(editableOf(editor).textContent).toBe('12345678AB');
    });
});

describe('maxLength on beforeinput and drop', () => {
    it('is inert without a maxLength', async () => {
        const editor = await clipboardEditor('<p>hello</p>');

        expect(beforeInput(editor, { data: 'more', inputType: 'insertText' }).defaultPrevented).toBe(false);
    });

    it('lets deletions and formatting edit an over-limit document back down', async () => {
        const editor = await clipboardEditor('<p>abcdef</p>', 3);

        expect(beforeInput(editor, { data: 'x', inputType: 'insertText' }).defaultPrevented).toBe(true);
        expect(beforeInput(editor, { inputType: 'deleteContentBackward' }).defaultPrevented).toBe(false);
        expect(beforeInput(editor, { inputType: 'formatBold' }).defaultPrevented).toBe(false);
    });

    it('counts a replaced selection as freed budget, in graphemes', async () => {
        const editor = await clipboardEditor('<p>😀😀😀lo</p>', 5);
        const text = firstText(editor)!;
        selectBetween(text, 6, text, 8);

        expect(beforeInput(editor, { data: 'XY', inputType: 'insertText' }).defaultPrevented).toBe(false);
        expect(beforeInput(editor, { data: 'XYZ', inputType: 'insertText' }).defaultPrevented).toBe(true);
    });

    it('budgets a native drop and an unclaimed drop by the text they would insert', async () => {
        const editor = await clipboardEditor('<p>12345678</p>', 10);
        const long = { 'text/plain': 'A', 'text/html': '<p>ABCDEFGHIJKLMNOP</p>' };

        const native = beforeInput(editor, { inputType: 'insertFromDrop', dataTransfer: transfer(long) });
        expect(native.defaultPrevented).toBe(true);

        expect(drop(editor, long).defaultPrevented).toBe(true);
        expect(drop(editor, { 'text/plain': 'AB', 'text/html': '<b>AB</b>' }).defaultPrevented).toBe(false);
    });

    it('leaves a drop an interceptor claimed alone', async () => {
        const editor = await clipboardEditor('<p>12345678</p>', 10);
        editor.registerDropInterceptor(() => true);

        expect(drop(editor, { 'text/plain': 'ABCDEFGH' }).defaultPrevented).toBe(false);
    });
});

describe('lifecycle', () => {
    it('stops handling paste once the editor is disconnected', async () => {
        const editor = await clipboardEditor('<p>ab</p>');
        editor.remove();

        paste(editor, { 'text/plain': 'cd' });

        expect(editableOf(editor).textContent).toBe('ab');
    });
});
