import { describe, expect, it } from 'vitest';
import { blockEditor, editableOf, placeCaret, record, selectBetween, tagsOf } from './rich-text-editor.fixture.test.js';

const textOf = (root: Element) => root.querySelector('p')!.firstChild as Text;

/** The caret at the end of "Hello", saved as the blurred caret. */
async function helloEditor(attrs?: (editor: Awaited<ReturnType<typeof blockEditor>>) => void) {
    const editor = await blockEditor('<p>Hello</p>');
    attrs?.(editor);
    await editor.updateComplete;
    const text = textOf(editableOf(editor));
    placeCaret(text, text.length);
    editor.saveSelection();
    return editor;
}

describe('insertText and insertHtml', () => {
    it('insertText from a blurred editor inserts at the saved caret, publishes once and focuses', async () => {
        const editor = await helloEditor();
        editableOf(editor).blur();
        const seen = record(editor, 'value-change');

        editor.insertText(' world');

        expect(editableOf(editor).textContent).toBe('Hello world');
        expect(seen).toHaveLength(1);
        expect(document.activeElement).toBe(editableOf(editor));
    });

    it("insertText('') is a no-op", async () => {
        const editor = await helloEditor();
        const seen = record(editor, 'value-change');

        editor.insertText('');

        expect(editableOf(editor).textContent).toBe('Hello');
        expect(seen).toHaveLength(0);
    });

    it.each([
        ['readonly', (editor: Awaited<ReturnType<typeof blockEditor>>) => { editor.readonly = true; }],
        ['disabled', (editor: Awaited<ReturnType<typeof blockEditor>>) => { editor.disabled = true; }],
    ])('insertText, insertHtml and the addon inserts are no-ops while %s', async (...[, apply]) => {
        const editor = await helloEditor(apply);
        const seen = record(editor, 'value-change');

        editor.insertText(' world');
        editor.insertHtml('<b>x</b>');
        editor.insertTextAtCaret('!');
        editor.insertHtmlAtCaret('<b>y</b>');
        editor.insertBlockAtCaret('<hr>');
        editor.insertTextFromOverlay('z');

        expect(editableOf(editor).textContent).toBe('Hello');
        expect(seen).toHaveLength(0);
    });

    it('insertText and insertHtml do not throw before the view exists', () => {
        const fresh = document.createElement('ge-rich-text-editor') as Awaited<ReturnType<typeof blockEditor>>;

        expect(() => fresh.insertText('x')).not.toThrow();
        expect(() => fresh.insertHtml('<b>x</b>')).not.toThrow();
    });

    it('insertHtml sanitizes and publishes once', async () => {
        const editor = await helloEditor();
        editableOf(editor).blur();
        const seen = record(editor, 'value-change');

        editor.insertHtml('<b>bold</b><script>alert(1)</script>');

        const root = editableOf(editor);
        expect(root.querySelector('b')?.textContent).toBe('bold');
        expect(root.querySelector('script')).toBeNull();
        expect(root.innerHTML).not.toContain('alert');
        expect(seen).toHaveLength(1);
    });

    it('insertHtml is a no-op when nothing survives sanitization', async () => {
        const editor = await helloEditor();
        const seen = record(editor, 'value-change');

        editor.insertHtml('<script>alert(1)</script>');

        expect(editableOf(editor).textContent).toBe('Hello');
        expect(seen).toHaveLength(0);
    });

    it('consecutive inserts append instead of stacking at the same spot', async () => {
        const editor = await helloEditor();
        editableOf(editor).blur();

        editor.insertText(' a');
        editableOf(editor).blur();
        editor.insertText('b');

        expect(editableOf(editor).textContent).toBe('Hello ab');
    });

    it('replaces the selected text', async () => {
        const editor = await blockEditor('<p>Hello world</p>');
        selectBetween(textOf(editableOf(editor)), 6, textOf(editableOf(editor)), 11);

        editor.insertText('there');

        expect(editableOf(editor).textContent).toBe('Hello there');
    });

    it('appends text to the editor when there is no selection', async () => {
        const editor = await blockEditor('<p>existing</p>');
        document.getSelection()?.removeAllRanges();

        editor.insertText('appended-text');

        expect(editableOf(editor).textContent).toBe('existingappended-text');
    });

    it('appends HTML to the editor end when there is no selection', async () => {
        const editor = await blockEditor('<p>existing</p>');
        document.getSelection()?.removeAllRanges();

        editor.insertHtml('<strong>appended-html</strong>');

        const root = editableOf(editor);
        expect(root.textContent).toBe('existingappended-html');
        expect(root.lastElementChild?.outerHTML).toBe('<strong>appended-html</strong>');
    });

    it('splits the paragraph at the caret when the inserted markup carries blocks', async () => {
        const editor = await blockEditor('<p>headtail</p>');
        placeCaret(textOf(editableOf(editor)), 4);

        editor.insertHtml('<p>one</p><p>two</p>');

        expect(tagsOf(editableOf(editor))).toEqual(['P:head', 'P:one', 'P:two', 'P:tail']);
    });

    it('leaves a paragraph whole for inline markup, and keeps a paste inside a cell where it is', async () => {
        const editor = await blockEditor('<p>headtail</p><table><tbody><tr><td>cell</td></tr></tbody></table>');
        const root = editableOf(editor);
        placeCaret(textOf(root), 4);
        editor.insertHtml('<b>mid</b>');
        expect(root.querySelector('p')?.innerHTML).toBe('head<b>mid</b>tail');

        placeCaret(root.querySelector('td')!.firstChild!, 2);
        editor.insertHtml('<p>x</p>');
        expect(root.querySelectorAll('table')).toHaveLength(1);
        expect(root.querySelector('td')?.textContent).toContain('x');
    });

    it('drops the empty shell left when the caret sat at the end of the block', async () => {
        const editor = await blockEditor('<p>one</p>');
        const text = textOf(editableOf(editor));
        placeCaret(text, text.length);

        editor.insertHtml('<p>two</p><p>three</p>');

        expect(tagsOf(editableOf(editor))).toEqual(['P:one', 'P:two', 'P:three']);
    });

    it('puts the caret after what was inserted', async () => {
        const editor = await blockEditor('<p>ab</p>');
        placeCaret(textOf(editableOf(editor)), 1);

        editor.insertHtml('<b>X</b>');
        editor.insertText('Y');

        expect(editableOf(editor).querySelector('p')?.textContent).toBe('aXYb');
    });

    it('restores the keyboard hint after rapid consecutive inserts', async () => {
        const editor = await helloEditor();

        editor.insertText('a');
        expect(editableOf(editor).inputMode).toBe('none');
        editor.insertText('b');
        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(editableOf(editor).inputMode).toBe('');
    });

    it('stops providing inserts once detached', async () => {
        const editor = await blockEditor('<p>Hello</p>');
        placeCaret(textOf(editableOf(editor)), 5);
        editor.remove();

        editor.insertText('!');

        expect(editableOf(editor).textContent).toBe('Hello');
    });
});

describe('maxLength', () => {
    it('refuses addon inserts once maxLength is exhausted', async () => {
        const editor = await blockEditor('<p>0123456789</p>');
        editor.maxLength = 10;
        await editor.updateComplete;
        const text = textOf(editableOf(editor));
        placeCaret(text, 10);

        editor.insertTextAtCaret('OVERFLOW');
        editor.insertHtmlAtCaret('<strong>OVERFLOW</strong>');
        editor.insertTextFromOverlay('OVERFLOW');
        editor.insertText('OVERFLOW');
        editor.insertHtml('<b>OVERFLOW</b>');
        editor.insertBlockAtCaret('<p>OVERFLOW</p>');

        expect(editableOf(editor).textContent).toBe('0123456789');
    });

    it('lets an insert through that fits, counting the text it replaces as freed', async () => {
        const editor = await blockEditor('<p>0123456789</p>');
        editor.maxLength = 10;
        await editor.updateComplete;
        const text = textOf(editableOf(editor));
        selectBetween(text, 0, text, 4);

        editor.insertText('abcd');

        expect(editableOf(editor).textContent).toBe('abcd456789');
    });

    it('counts an emoji as one character', async () => {
        const editor = await blockEditor('<p></p>');
        editor.maxLength = 3;
        await editor.updateComplete;
        placeCaret(editableOf(editor).querySelector('p')!, 0);

        editor.insertText('\u{1F600}\u{1F601}\u{1F602}');
        editor.insertText('\u{1F603}');

        expect([...(editableOf(editor).textContent ?? '')]).toHaveLength(3);
    });
});

describe('insertBlockAtCaret', () => {
    it('keeps an empty table when a block is inserted from inside it', async () => {
        const editor = await blockEditor('<table><tbody><tr><td><br></td><td><br></td></tr></tbody></table>');
        const root = editableOf(editor);
        placeCaret(root.querySelector('td')!, 0);

        editor.insertBlockAtCaret('<table><tbody><tr><td><br></td></tr></tbody></table><p><br></p>');

        expect(root.querySelectorAll('table')).toHaveLength(2);
        expect(Array.from(root.children, (el) => el.tagName)).toEqual(['TABLE', 'TABLE', 'P']);
    });

    it('lands the caret in the first cell of an inserted table', async () => {
        const editor = await blockEditor('<p>intro text</p>');
        const root = editableOf(editor);
        placeCaret(textOf(root), 5);

        editor.insertBlockAtCaret('<table><tbody><tr><td><br></td><td><br></td></tr></tbody></table><p><br></p>');

        expect(root.querySelector('p')?.textContent).toBe('intro text');
        expect(Array.from(root.children, (el) => el.tagName)).toEqual(['P', 'TABLE', 'P']);
        expect(root.querySelector('td')?.contains(document.getSelection()?.anchorNode ?? null)).toBe(true);
    });

    it('appends inserted block markup at the end of the document when the caret is not in the editor', async () => {
        const editor = await blockEditor('<p>first</p><p>last</p>');
        const root = editableOf(editor);
        document.getSelection()?.removeAllRanges();

        editor.insertBlockAtCaret('<table><tbody><tr><td>cell</td></tr></tbody></table>');

        expect(Array.from(root.children, (el) => el.tagName)).toEqual(['P', 'P', 'TABLE']);
        expect(root.querySelector('td')?.contains(document.getSelection()?.anchorNode ?? null)).toBe(true);
    });

    it('sanitizes the markup it inserts', async () => {
        const editor = await blockEditor('<p>one</p>');
        placeCaret(textOf(editableOf(editor)), 1);

        editor.insertBlockAtCaret('<p>safe</p><script>alert(1)</script>');

        expect(editableOf(editor).querySelector('script')).toBeNull();
        expect(tagsOf(editableOf(editor))).toEqual(['P:one', 'P:safe']);
    });
});

describe('addon inserts at the live caret', () => {
    it('insertTextAtCaret and insertHtmlAtCaret insert at the caret and publish', async () => {
        const editor = await blockEditor('<p>ac</p>');
        const seen = record(editor, 'value-change');
        placeCaret(textOf(editableOf(editor)), 1);

        editor.insertTextAtCaret('b');
        editor.insertHtmlAtCaret('<i>d</i>');

        expect(editableOf(editor).querySelector('p')?.innerHTML).toBe('ab<i>d</i>c');
        expect(seen).toHaveLength(2);
    });

    it('insertTextFromOverlay restores the editor caret first', async () => {
        const editor = await helloEditor();
        editableOf(editor).blur();
        document.getSelection()?.removeAllRanges();

        editor.insertTextFromOverlay(' there');

        expect(editableOf(editor).textContent).toBe('Hello there');
    });

    it('ignores a live selection outside the editor and appends instead', async () => {
        const editor = await blockEditor('<p>in</p>');
        const outside = document.createElement('p');
        outside.textContent = 'outside';
        document.body.append(outside);
        placeCaret(outside.firstChild!, 3);

        editor.insertTextAtCaret('!');
        outside.remove();

        expect(outside.textContent).toBe('outside');
        expect(editableOf(editor).textContent).toBe('in!');
    });
});

describe('inserts and undo history', () => {
    it('insertText pushes one entry and one undo takes it back (Angular spec T-3, 10901-10918)', async () => {
        const editor = await helloEditor();
        editableOf(editor).blur();
        const before = editor.historyEntries().length;

        editor.insertText(' world');

        expect(editor.historyEntries().length - before).toBe(1);
        expect(editor.canUndo).toBe(true);
        editor.undo();
        expect(editableOf(editor).textContent).toBe('Hello');
    });

    it('insertHtml sanitizes and pushes one entry (Angular spec T-5, 10984-10998)', async () => {
        const editor = await helloEditor();
        const before = editor.historyEntries().length;

        editor.insertHtml('<b>bold</b><script>alert(1)</script>');

        const root = editableOf(editor);
        expect(root.querySelector('b')?.textContent).toBe('bold');
        expect(root.innerHTML).not.toContain('alert');
        expect(editor.historyEntries().length - before).toBe(1);
    });

    it("insertText(''), readonly and sanitized-away inserts push no entry (Angular spec T-3b/T-4/T-5b, 10920-11011)", async () => {
        const editor = await helloEditor();
        const before = editor.historyEntries().length;

        editor.insertText('');
        editor.insertHtml('<script>alert(1)</script>');
        editor.readonly = true;
        editor.insertText(' world');
        editor.insertHtml('<b>x</b>');

        expect(editableOf(editor).textContent).toBe('Hello');
        expect(editor.historyEntries()).toHaveLength(before);
    });

    it('insertTextFromOverlay records its own entry; one undo removes only the inserted text (Angular spec T-35, 10646-10662)', async () => {
        const editor = await helloEditor();
        const before = editor.historyEntries().length;

        editor.insertTextFromOverlay('!');

        expect(editor.historyEntries().length - before).toBe(1);
        expect(editableOf(editor).textContent).toBe('Hello!');
        editor.undo();
        expect(editableOf(editor).textContent).toBe('Hello');
    });
});

