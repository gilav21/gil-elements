import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEditor, editableOf, load } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';

const TS_BLOCK = '<pre><code data-language="ts">const a = 1;</code></pre>';

afterEach(() => {
    vi.useRealTimers();
});

async function highlighted(html: string, debounceMs = 0): Promise<{ editor: GeRichTextEditor; code: () => HTMLElement }> {
    const editor = await createEditor((el) => {
        el.mode = 'html';
        el.codeHighlightDebounceMs = debounceMs;
        el.history = { debounceMs: 0, recordExternalWrites: true };
    });
    await load(editor, html);
    return { editor, code: () => editableOf(editor).querySelector<HTMLElement>('pre > code')! };
}

const keywords = (code: HTMLElement) => Array.from(code.querySelectorAll('.token-keyword'), (el) => el.textContent);

/** Appends `text` to the end of the code block, puts the caret there and raises the input the browser would. */
function typeAtEndOfCode(editor: GeRichTextEditor, code: HTMLElement, text: string): void {
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    let last: Text | null = null;
    for (let node = walker.nextNode(); node; node = walker.nextNode()) last = node as Text;
    last!.data += text;
    const range = new Range();
    range.setStart(last!, last!.data.length);
    range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    editableOf(editor).dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text.at(-1) ?? '' }));
}

describe('live code highlighting (Angular spec 11720+)', () => {
    it('colours every code block a loaded document carries', async () => {
        const { editor } = await highlighted(`${TS_BLOCK}<pre><code data-language="python">def f(): pass</code></pre>`);

        const blocks = editableOf(editor).querySelectorAll<HTMLElement>('pre > code');
        expect(blocks).toHaveLength(2);
        expect(blocks[0]!.querySelector('.token-keyword')?.textContent).toBe('const');
        expect(blocks[1]!.querySelector('.token-keyword')?.textContent).toBe('def');
    });

    it('recolours as the author types', async () => {
        const { editor, code } = await highlighted(TS_BLOCK);
        typeAtEndOfCode(editor, code(), ' let b = 2;');

        expect(keywords(code())).toEqual(['const', 'let']);
    });

    it('keeps the spans out of the value', async () => {
        const { editor, code } = await highlighted(TS_BLOCK);
        const emitted: string[] = [];
        editor.addEventListener('value-change', (event) => emitted.push((event as CustomEvent<{ value: string }>).detail.value));

        typeAtEndOfCode(editor, code(), ' let b = 2;');

        expect(emitted.at(-1)).toContain('const a = 1; let b = 2;');
        expect(emitted.at(-1)).not.toContain('token');
    });

    it('leaves the caret where the author left it', async () => {
        const { editor, code } = await highlighted(TS_BLOCK);
        typeAtEndOfCode(editor, code(), ' let b = 2;');

        const range = document.getSelection()!.getRangeAt(0);
        expect(code().contains(range.startContainer)).toBe(true);
        const measure = new Range();
        measure.setStart(code(), 0);
        measure.setEnd(range.startContainer, range.startOffset);
        expect(measure.toString()).toBe('const a = 1; let b = 2;');
    });

    it('adds no undo step of its own', async () => {
        const { editor, code } = await highlighted(TS_BLOCK);
        typeAtEndOfCode(editor, code(), ' let b = 2;');
        await editor.updateComplete;

        editor.undo();
        await editor.updateComplete;

        expect(editableOf(editor).textContent).toBe('const a = 1;');
    });

    it('leaves a block with no language, or an unknown one, uncoloured', async () => {
        const { editor } = await highlighted('<pre><code>const a = 1;</code></pre>');
        expect(editableOf(editor).querySelectorAll('.token')).toHaveLength(0);

        await load(editor, '<pre><code data-language="klingon">const a = 1;</code></pre>');
        expect(editableOf(editor).querySelectorAll('.token')).toHaveLength(0);
    });

    it('colours and keeps the rows of lines added with a <br>', async () => {
        const { editor, code } = await highlighted(TS_BLOCK);
        code().append(document.createElement('br'), document.createTextNode('let b = 2;'));
        typeAtEndOfCode(editor, code(), '');

        expect(keywords(code())).toEqual(['const', 'let']);
    });

    it('repaints only after the debounce when one is set', async () => {
        const { editor, code } = await highlighted(TS_BLOCK, 300);
        vi.useFakeTimers();
        typeAtEndOfCode(editor, code(), ' let b = 2;');

        expect(keywords(code())).toEqual(['const']);
        vi.advanceTimersByTime(299);
        expect(keywords(code())).toEqual(['const']);
        vi.advanceTimersByTime(1);
        expect(keywords(code())).toEqual(['const', 'let']);
    });

    it('drops a pending repaint when the content is replaced', async () => {
        const { editor, code } = await highlighted(TS_BLOCK, 300);
        vi.useFakeTimers();
        typeAtEndOfCode(editor, code(), ' let b = 2;');
        vi.useRealTimers();
        const stale = code();

        await load(editor, '<p>plain</p>');

        expect(stale.isConnected).toBe(false);
        expect(editableOf(editor).querySelectorAll('.token')).toHaveLength(0);
    });
});
