import { describe, expect, it, vi } from 'vitest';
import { editableOf, editorIn, placeCaret, record } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';

async function editorWith(content: string): Promise<{ editor: GeRichTextEditor; root: HTMLDivElement }> {
    const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
    editor.value = content;
    await editor.updateComplete;
    return { editor, root: editableOf(editor) };
}

/** Tells the editor the selection moved, as the keyup or mouseup that follows a real move does. */
const selectionMoved = (root: HTMLElement): void => {
    root.dispatchEvent(new Event('keyup'));
};

function select(start: Node, startOffset: number, end: Node = start, endOffset = startOffset): void {
    const range = new Range();
    range.setStart(start, startOffset);
    range.setEnd(end, endOffset);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

const selectContents = (node: Node): void => select(node, 0, node, node.childNodes.length);

function rawCommands(run: () => void): string[] {
    const calls: string[] = [];
    const original = document.execCommand;
    document.execCommand = (id: string, ui?: boolean, value?: string) => {
        calls.push(`${id}=${value}`);
        return original.call(document, id, ui, value);
    };
    try {
        run();
    } finally {
        document.execCommand = original;
    }
    return calls;
}

describe('inline code', () => {
    it('wraps a partial multi-node selection', async () => {
        const { editor, root } = await editorWith('<p>Hello <b>World</b></p>');
        const p = root.querySelector('p')!;
        select(p.firstChild!, 2, p.querySelector('b')!.firstChild!, 3);

        editor.format('code');

        expect(Array.from(root.querySelectorAll('code'), (code) => code.textContent).join('')).toBe('llo Wor');
        expect(p.textContent).toBe('Hello World');
    });

    it('unwraps on a second apply instead of nesting, keeping the text selected', async () => {
        const { editor, root } = await editorWith('<p>hello world</p>');
        select(root.querySelector('p')!.firstChild!, 0, root.querySelector('p')!.firstChild!, 5);

        editor.format('code');
        expect(root.querySelector('code')!.textContent).toBe('hello');
        expect(document.getSelection()?.toString()).toBe('hello');

        editor.format('code');
        expect(root.querySelectorAll('code')).toHaveLength(0);
        expect(root.textContent).toBe('hello world');
    });

    it('opens an empty run at a collapsed caret, with the caret inside it', async () => {
        const { editor, root } = await editorWith('<p>ab</p>');
        placeCaret(root.querySelector('p')!.firstChild!, 1);

        editor.format('code');

        const code = root.querySelector('p > code')!;
        expect(code.textContent).toBe('​');
        expect(code.contains(document.getSelection()?.anchorNode ?? null)).toBe(true);
        expect(root.textContent?.replaceAll('​', '')).toBe('ab');
    });

    it('reads pressed in activeFormats after the wrap (Angular spec 2328)', async () => {
        const { editor, root } = await editorWith('<p>hello world</p>');
        const text = root.querySelector('p')!.firstChild!;
        select(text, 0, text, 5);

        editor.format('code');

        expect(editor.activeFormats.has('code')).toBe(true);
    });
});

describe('bold, italic, underline, strikethrough', () => {
    it.each([
        ['bold', 'b, strong'],
        ['italic', 'i, em'],
        ['underline', 'u'],
        ['strikethrough', 's, strike'],
    ] as const)('%s wraps the selection', async (command, selector) => {
        const { editor, root } = await editorWith('<p>format me</p>');
        const text = root.querySelector('p')!.firstChild!;
        select(text, 0, text, 6);

        editor.format(command);

        expect(root.querySelector(selector)?.textContent).toBe('format');
    });

    it('formats the live selection, not a stale range saved on the last blur', async () => {
        const { editor, root } = await editorWith('<p>make me bold</p>');
        const p = root.querySelector('p')!;
        placeCaret(p.firstChild!, 4);
        root.dispatchEvent(new FocusEvent('blur'));

        selectContents(p);
        editor.format('bold');

        expect(root.querySelector('b, strong')?.textContent).toBe('make me bold');
        expect(document.getSelection()?.toString()).toBe('make me bold');
    });

    it('bolds the range saved before focus left, and returns focus to the editor', async () => {
        const { editor, root } = await editorWith('<p>Hello</p>');
        selectContents(root.querySelector('p')!);
        editor.saveSelection();
        document.getSelection()!.removeAllRanges();

        editor.format('bold');

        expect(root.querySelector('b, strong')?.textContent).toBe('Hello');
        expect(document.activeElement).toBe(root);
    });

    it('Ctrl+B, Ctrl+I, Ctrl+U format the selection (Angular spec 7145-7167)', async () => {
        const { editor, root } = await editorWith('<p>format me</p>');
        for (const [key, selector] of [['b', 'b, strong'], ['i', 'i, em'], ['u', 'u']] as const) {
            selectContents(root.querySelector('p')!);
            root.dispatchEvent(new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true }));
            expect(root.querySelector(selector)).toBeTruthy();
        }
    });

    it('records exactly one history entry and updates activeFormats (Angular spec 11013-11026)', async () => {
        const { editor, root } = await editorWith('<p>Hello</p>');
        selectContents(root.querySelector('p')!);
        editor.saveSelection();
        const before = editor.historyEntries().length;

        editor.format('bold');

        expect(editor.historyEntries().length - before).toBe(1);
        expect(editor.activeFormats.has('bold')).toBe(true);
        expect(document.activeElement).toBe(root);
    });

    it('a format inside existing bold parks the caret past the innermost formatting node (Angular spec 7581-7604)', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" toolbar="floating"></ge-rich-text-editor>');
        editor.value = '<p><b>already bold</b></p>';
        await editor.updateComplete;
        const root = editableOf(editor);
        root.focus();
        const boldText = root.querySelector('b')!.firstChild!;
        select(boldText, 2, boldText, 6);
        selectionMoved(root);
        await editor.updateComplete;
        const bubble = () => editor.shadowRoot!.querySelector('[data-slot="rich-text-floating-toolbar"]');
        expect(bubble()).not.toBeNull();

        editor.format('italic');
        await editor.updateComplete;

        const inner = root.querySelector('b i')!;
        expect(inner.textContent).toBe('read');
        const selection = document.getSelection()!;
        expect(selection.isCollapsed).toBe(true);
        expect(selection.anchorNode).toBe(inner.parentNode);
        expect(selection.anchorOffset).toBe(Array.from(inner.parentNode!.childNodes).indexOf(inner) + 1);
        expect(bubble()).toBeNull();
    });

    it('the clear command on the floating toolbar removes formatting (Angular spec 7622-7635)', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" toolbar="floating"></ge-rich-text-editor>');
        editor.value = '<p><b>bold</b></p>';
        await editor.updateComplete;
        const root = editableOf(editor);
        selectContents(root.querySelector('b')!);
        selectionMoved(root);
        await editor.updateComplete;
        const bar = editor.shadowRoot!.querySelector('[data-slot="rich-text-floating-toolbar"] ge-rich-text-toolbar')!;
        await (bar as { updateComplete: Promise<unknown> }).updateComplete;

        bar.shadowRoot!.querySelector<HTMLButtonElement>('[data-toolbar-item="clear"]')!.click();

        expect(root.querySelector('b')).toBeNull();
        expect(root.textContent).toBe('bold');
    });
});

describe('clear formatting', () => {
    it('clears inline formatting from the selection', async () => {
        const { editor, root } = await editorWith('<p><b>bold text</b></p>');
        selectContents(root.querySelector('b')!);

        editor.format('clear');

        expect(root.querySelector('b')).toBeNull();
        expect(root.textContent).toBe('bold text');
    });

    it('clears the formatted run around a collapsed caret, keeping the caret in place', async () => {
        const { editor, root } = await editorWith('<p>plain <i><b>bold text</b></i> tail</p>');
        placeCaret(root.querySelector('b')!.firstChild!, 4);

        editor.format('clear');

        expect(root.querySelector('b, i')).toBeNull();
        expect(root.textContent).toBe('plain bold text tail');
        const selection = document.getSelection()!;
        expect(selection.isCollapsed).toBe(true);
        const before = new Range();
        before.setStart(root.querySelector('p')!, 0);
        before.setEnd(selection.anchorNode!, selection.anchorOffset);
        expect(before.toString()).toBe('plain bold');
    });

    it('keeps a link when clearing the formatting around a caret inside it', async () => {
        const { editor, root } = await editorWith('<p><b><a href="https://x.test/">link <u>text</u></a></b></p>');
        placeCaret(root.querySelector('u')!.firstChild!, 1);

        editor.format('clear');

        expect(root.querySelector('b, u')).toBeNull();
        expect(root.querySelector('a')?.textContent).toBe('link text');
    });

    it('leaves plain text alone when the caret is not in a formatted run', async () => {
        const { editor, root } = await editorWith('<p>plain <b>bold</b></p>');
        placeCaret(root.querySelector('p')!.firstChild!, 2);

        editor.format('clear');

        expect(root.querySelector('b')?.textContent).toBe('bold');
    });

    it('clears a formatted run holding only an image, leaving the caret after the image', async () => {
        const { editor, root } = await editorWith('<p><b><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt=""></b></p>');
        placeCaret(root.querySelector('b')!, 1);

        editor.format('clear');

        const paragraph = root.querySelector('p')!;
        expect(root.querySelector('b')).toBeNull();
        expect(paragraph.querySelector(':scope > img')).toBeTruthy();
        expect(document.getSelection()?.anchorNode).toBe(paragraph);
    });

    it("keeps a task row's text in its span", async () => {
        const { editor, root } = await editorWith(
            '<ul data-task-list><li data-task data-checked="true"><input type="checkbox"><span>plain <b>bold</b></span></li></ul>',
        );
        placeCaret(root.querySelector('li[data-task] b')!.firstChild!, 2);

        editor.format('clear');

        const row = root.querySelector('li[data-task]')!;
        expect(Array.from(row.children).map((el) => el.tagName)).toEqual(['INPUT', 'SPAN']);
        expect(row.querySelector(':scope > span')?.textContent).toBe('plain bold');
        expect(row.querySelector('b')).toBeNull();
    });

    it("leaves a task row's plain text as it is", async () => {
        const { editor, root } = await editorWith(
            '<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>todo</span></li></ul>',
        );
        placeCaret(root.querySelector('li[data-task] > span')!.firstChild!, 2);

        editor.format('clear');

        expect(root.querySelector('li[data-task] > span')?.textContent).toBe('todo');
    });
});

describe('mention chips', () => {
    const CHIP = '<p><span data-mention="jane" contenteditable="false">@Jane</span></p>';

    it('bold toggles fontWeight on the chips in the selection', async () => {
        const { editor, root } = await editorWith(CHIP);
        selectContents(root);
        editor.format('bold');
        expect(root.querySelector<HTMLElement>('[data-mention]')!.style.fontWeight).toBe('bold');

        selectContents(root);
        editor.format('bold');
        expect(root.querySelector<HTMLElement>('[data-mention]')!.style.fontWeight).toBe('normal');
    });

    it('a chip follows the text: bold text and a bold chip turn plain together', async () => {
        const { editor, root } = await editorWith('<p><b>bold </b><span data-mention="jane" contenteditable="false" style="font-weight: bold">@Jane</span></p>');
        selectContents(root);
        editor.format('bold');
        expect(getComputedStyle(root.querySelector('[data-mention]')!).fontWeight).toBe('400');
    });

    it('a chip follows the text: bold text next to a plain chip turns both bold', async () => {
        const { editor, root } = await editorWith('<p><b>bold </b><span data-mention="jane" contenteditable="false">@Jane</span></p>');
        selectContents(root);
        editor.format('bold');
        expect(root.querySelector<HTMLElement>('[data-mention]')!.style.fontWeight).toBe('bold');
    });

    it('a chip follows the text: plain text next to a bold chip turns both bold', async () => {
        const { editor, root } = await editorWith('<p>plain <span data-mention="jane" contenteditable="false" style="font-weight: bold">@Jane</span></p>');
        selectContents(root);
        editor.format('bold');
        expect(root.querySelector<HTMLElement>('[data-mention]')!.style.fontWeight).toBe('bold');
    });

    it('italic toggles fontStyle', async () => {
        const { editor, root } = await editorWith(CHIP);
        selectContents(root);
        editor.format('italic');
        expect(root.querySelector<HTMLElement>('[data-mention]')!.style.fontStyle).toBe('italic');
    });

    it('underline toggled twice removes the text decoration', async () => {
        const { editor, root } = await editorWith(CHIP);
        const chip = () => root.querySelector<HTMLElement>('[data-mention]')!;
        selectContents(root);
        editor.format('underline');
        expect(chip().style.textDecoration).toContain('underline');

        selectContents(root);
        editor.format('underline');
        expect(chip().style.textDecoration).not.toContain('underline');
    });

    it('strikethrough adds line-through', async () => {
        const { editor, root } = await editorWith(CHIP);
        selectContents(root);
        editor.format('strikethrough');
        expect(root.querySelector<HTMLElement>('[data-mention]')!.style.textDecoration).toContain('line-through');
    });

    it('leaves chips alone when the live selection is outside the editor', async () => {
        const { editor, root } = await editorWith(CHIP);
        const outside = document.createElement('p');
        outside.textContent = 'outside';
        document.body.append(outside);
        try {
            selectContents(outside);
            (editor as unknown as { commandTable: Map<string, () => void> }).commandTable.get('bold')!();
            expect(root.querySelector<HTMLElement>('[data-mention]')!.style.fontWeight).toBe('');
        } finally {
            outside.remove();
        }
    });

    it('font colour sets the colour on the chips', async () => {
        const { editor, root } = await editorWith(CHIP);
        selectContents(root);
        editor.applyInlineStyle({ color: '#123456' });
        expect(root.querySelector<HTMLElement>('[data-mention]')!.style.color).toMatch(/rgb\(18,\s*52,\s*86\)|#123456/);
    });

    it('font size and family style the chips the browser command skips', async () => {
        const { editor, root } = await editorWith(CHIP);
        selectContents(root);
        editor.applyInlineStyle({ fontSize: '30' });
        editor.applyInlineStyle({ fontFamily: 'Georgia' });
        const chip = root.querySelector<HTMLElement>('[data-mention]')!;
        expect(chip.style.fontSize).toBe('30px');
        expect(chip.style.fontFamily).toContain('Georgia');
    });

    it('font family restyles a selected font already in that face, not the part left unselected', async () => {
        const { editor, root } = await editorWith('<p>x</p>');
        // Set directly: the sanitizer would turn a <font> into a span on the way in.
        root.innerHTML = '<p><font face="Arial">hello world</font></p>';
        const text = root.querySelector('font')!.firstChild!;
        select(text, 0, text, 5);
        editor.applyInlineStyle({ fontFamily: 'Arial' });
        expect(root.querySelector('font[face]')?.textContent ?? '').not.toContain('hello');
        expect(root.textContent).toBe('hello world');
    });

    it('clear formatting removes the inline styles from chips', async () => {
        const { editor, root } = await editorWith(CHIP);
        const chip = root.querySelector<HTMLElement>('[data-mention]')!;
        chip.style.fontWeight = 'bold';
        chip.style.color = 'red';
        selectContents(root);

        editor.format('clear');

        expect(chip.style.fontWeight).toBe('');
        expect(chip.style.color).toBe('');
    });
});

describe('colour', () => {
    const caretInHello = async (): Promise<{ editor: GeRichTextEditor; root: HTMLDivElement }> => {
        const fixture = await editorWith('<p>hello</p>');
        fixture.root.focus();
        placeCaret(fixture.root.querySelector('p')!.firstChild!, 5);
        return fixture;
    };

    it('applies a colour to the selection and keeps it selected for the next pick', async () => {
        const { editor, root } = await editorWith('<p>Recolor me</p>');
        selectContents(root.querySelector('p')!);

        editor.applyInlineStyle({ color: '#ff0000' });
        expect(root.innerHTML).toContain('rgb(255, 0, 0)');
        expect(document.getSelection()?.isCollapsed).toBe(false);

        editor.applyInlineStyle({ color: '#0000ff' });
        expect(root.innerHTML).toContain('rgb(0, 0, 255)');
        expect(document.getSelection()?.isCollapsed).toBe(false);
    });

    it('applies a background colour', async () => {
        const { editor, root } = await editorWith('<p>highlight</p>');
        selectContents(root.querySelector('p')!);

        editor.applyInlineStyle({ backgroundColor: '#00ff00' });

        expect(getComputedStyle(root.querySelector<HTMLElement>('[style*="background"]')!).backgroundColor).toBe('rgb(0, 255, 0)');
    });

    it('falls back to backColor when hiliteColor is unsupported', async () => {
        const { editor, root } = await editorWith('<p>highlight</p>');
        selectContents(root.querySelector('p')!);
        const original = document.execCommand;
        document.execCommand = (id: string, ui?: boolean, value?: string) => id !== 'hiliteColor' && original.call(document, id, ui, value);
        try {
            editor.applyInlineStyle({ backgroundColor: '#123456' });
        } finally {
            document.execCommand = original;
        }

        const highlighted = root.querySelector<HTMLElement>('[style*="background"]');
        expect(highlighted?.textContent).toBe('highlight');
        expect(getComputedStyle(highlighted!).backgroundColor).toBe('rgb(18, 52, 86)');
    });

    it('applies to the range saved on blur when the live selection is collapsed', async () => {
        const { editor, root } = await editorWith('<p>colored</p>');
        const p = root.querySelector('p')!;
        selectContents(p);
        root.dispatchEvent(new FocusEvent('blur'));
        placeCaret(p.firstChild!, 0);

        editor.applyInlineStyle({ color: '#00ffaa' });

        const colored = root.querySelector<HTMLElement>('[style*="color"]');
        expect(colored?.textContent).toBe('colored');
        expect(getComputedStyle(colored!).color).toBe('rgb(0, 255, 170)');
    });

    it('does nothing without a selection, so it cannot clobber the model on init', async () => {
        const { editor, root } = await editorWith('<p>Seeded content</p>');
        document.getSelection()!.removeAllRanges();
        const changes = record(editor, 'value-change');

        editor.applyInlineStyle({ color: '#000000' });

        expect(changes).toEqual([]);
        expect(root.innerHTML).toContain('Seeded content');
    });

    it('issues no command from an editor whose view has not rendered, even with a selection elsewhere', async () => {
        const { root } = await editorWith('<p>other editor</p>');
        const unrendered = document.createElement('ge-rich-text-editor') as GeRichTextEditor;
        selectContents(root.querySelector('p')!);

        const issued = rawCommands(() => unrendered.applyInlineStyle({ color: '#ff0000' }));

        expect(issued).toEqual([]);
        expect(root.innerHTML).toBe('<p>other editor</p>');
    });

    it('does not throw when the document reports no selection', async () => {
        const { editor, root } = await editorWith('<p>text</p>');
        selectContents(root.querySelector('p')!);
        root.dispatchEvent(new FocusEvent('blur'));
        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);
        try {
            expect(() => editor.applyInlineStyle({ color: '#654321' })).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('keeps a highlight when a text colour is chosen at the same caret, and the reverse', async () => {
        const { editor } = await caretInHello();

        editor.applyInlineStyle({ backgroundColor: '#ffff00' });
        editor.applyInlineStyle({ color: '#9333ea' });
        expect(editor.selectionInlineStyle.backgroundColor).toBe('#ffff00');
        expect(editor.selectionInlineStyle.color).toBe('#9333ea');

        editor.applyInlineStyle({ backgroundColor: '#00ffff' });
        expect(editor.selectionInlineStyle.color).toBe('#9333ea');
        expect(editor.selectionInlineStyle.backgroundColor).toBe('#00ffff');
    });

    it('leaves styleWithCSS on while a caret holds a pending colour', async () => {
        const { editor } = await caretInHello();

        const calls = rawCommands(() => editor.applyInlineStyle({ color: '#9333ea' }));

        expect(calls).toContain('styleWithCSS=true');
        expect(calls).not.toContain('styleWithCSS=false');
    });

    it('restores styleWithCSS once the caret leaves the pending colour', async () => {
        const { editor, root } = await caretInHello();
        editor.applyInlineStyle({ color: '#9333ea' });

        const calls = rawCommands(() => {
            placeCaret(root.querySelector('p')!.firstChild!, 1);
            root.dispatchEvent(new Event('keyup'));
        });

        expect(calls).toContain('styleWithCSS=false');
    });

    it('restores styleWithCSS immediately when colouring a selection', async () => {
        const { editor, root } = await editorWith('<p><span>ranged</span></p>');
        selectContents(root.querySelector('span')!);

        const calls = rawCommands(() => editor.applyInlineStyle({ color: '#9333ea' }));

        expect(calls).toContain('styleWithCSS=false');
    });

    it('keeps the pending colour while the caret has not moved, and drops it once it moves', async () => {
        const { editor, root } = await caretInHello();
        editor.applyInlineStyle({ color: '#9333ea' });

        root.dispatchEvent(new Event('keyup'));
        expect(editor.selectionInlineStyle.color).toBe('#9333ea');

        placeCaret(root.querySelector('p')!.firstChild!, 1);
        root.dispatchEvent(new Event('keyup'));
        expect(editor.selectionInlineStyle.color).not.toBe('#9333ea');
    });

    it('ignores a pending colour when the selection is no longer collapsed', async () => {
        const { editor, root } = await editorWith('<p><span style="color:#2563eb">ranged</span></p>');
        const text = root.querySelector('span')!.firstChild as Text;
        root.focus();
        placeCaret(text, 2);
        const original = document.execCommand;
        document.execCommand = () => true;
        try {
            editor.applyInlineStyle({ color: '#9333ea' });
        } finally {
            document.execCommand = original;
        }
        expect(editor.selectionInlineStyle.color).toBe('#9333ea');

        document.getSelection()!.setBaseAndExtent(text, 2, text, 6);
        root.dispatchEvent(new Event('keyup'));

        expect(editor.selectionInlineStyle.color).toBe('rgb(37, 99, 235)');
    });
});

describe('selection inline style', () => {
    it.each([
        ['colour', '<span style="color:#2563eb">SLA</span>', 'color', 'rgb(37, 99, 235)'],
        ['background', '<span style="background-color:#f97316">SLA</span>', 'backgroundColor', 'rgb(249, 115, 22)'],
        ['font size', '<span style="font-size:20px">SLA</span>', 'fontSize', '20'],
        ['font family', '<span style="font-family:Georgia">SLA</span>', 'fontFamily', 'Georgia'],
    ] as const)('reflects the selection %s', async (_name, markup, prop, expected) => {
        const { editor, root } = await editorWith(markup);
        selectContents(root.querySelector('span')!);
        selectionMoved(root);

        expect(editor.selectionInlineStyle[prop]).toContain(expected);
    });

    it('exposes a transparent background as a raw transparent value', async () => {
        const { editor, root } = await editorWith('<span>Plain</span>');
        selectContents(root.querySelector('span')!);
        selectionMoved(root);

        expect(editor.selectionInlineStyle.backgroundColor).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    });

    it('detects the font family at the caret', async () => {
        const { editor, root } = await editorWith('<span style="font-family: Georgia">Styled text</span>');
        placeCaret(root.querySelector('span')!.firstChild!, 2);
        selectionMoved(root);

        expect(editor.selectionInlineStyle.fontFamily).toBe('Georgia');
    });

    it('keeps the last in-editor style when the selection collapses outside the editor', async () => {
        const { editor, root } = await editorWith('<p><span style="color:#2563eb;background-color:#f97316">tinted</span></p>');
        selectContents(root.querySelector('span')!);
        selectionMoved(root);
        const reflected = { ...editor.selectionInlineStyle };

        const outside = document.createElement('p');
        outside.textContent = 'Presets';
        outside.style.color = 'rgb(1, 2, 3)';
        outside.style.backgroundColor = 'rgb(4, 5, 6)';
        document.body.append(outside);
        try {
            placeCaret(outside.firstChild!, 3);
            selectionMoved(root);

            expect(editor.selectionInlineStyle).toEqual(reflected);
        } finally {
            outside.remove();
        }
    });
});

describe('font size and family', () => {
    it('applies a font size as a styled span', async () => {
        const { editor, root } = await editorWith('<p>Resize me</p>');
        selectContents(root.querySelector('p')!);

        editor.applyInlineStyle({ fontSize: '24' });

        expect(root.querySelectorAll('font[size="7"]')).toHaveLength(0);
        expect(Array.from(root.querySelectorAll('span')).some((span) => span.style.fontSize === '24px')).toBe(true);
    });

    it('keeps an explicit px unit', async () => {
        const { editor, root } = await editorWith('<p>sized</p>');
        selectContents(root.querySelector('p')!);

        editor.applyInlineStyle({ fontSize: '20px' });

        expect(root.innerHTML).toContain('20px');
        expect(root.innerHTML).not.toContain('20pxpx');
    });

    it('applies a font family as a styled span', async () => {
        const { editor, root } = await editorWith('<p>Restyle me</p>');
        selectContents(root.querySelector('p')!);

        editor.applyInlineStyle({ fontFamily: 'Georgia' });

        expect(root.querySelectorAll('font[face]')).toHaveLength(0);
        expect(Array.from(root.querySelectorAll('span')).some((span) => span.style.fontFamily.includes('Georgia'))).toBe(true);
    });

    it('styles a family whose name holds quotes and commas', async () => {
        const { editor, root } = await editorWith('<p>hello world</p>');
        select(root.querySelector('p')!.firstChild!, 0, root.querySelector('p')!.firstChild!, 5);

        editor.applyInlineStyle({ fontFamily: '"Comic Sans MS", cursive' });

        const span = root.querySelector<HTMLElement>('p > span');
        expect(span?.textContent).toBe('hello');
        expect(span?.style.fontFamily).toContain('Comic Sans MS');
        expect(root.querySelector('font[face]')).toBeNull();
    });

    it('lets a second pick restyle the same still-selected text', async () => {
        const { editor, root } = await editorWith('<p>again</p>');
        selectContents(root.querySelector('p')!);

        editor.applyInlineStyle({ fontSize: '20' });
        editor.applyInlineStyle({ fontSize: '30' });

        expect(root.querySelector('span')!.style.fontSize).toBe('30px');
    });

    it('keeps a bare caret as the restore point when a size pick styles no text', async () => {
        const { editor, root } = await editorWith('<p>hello</p>');
        const text = root.querySelector('p')!.firstChild!;
        placeCaret(text, 2);
        const original = document.execCommand;
        document.execCommand = () => true;
        try {
            editor.applyInlineStyle({ fontSize: '20' });
        } finally {
            document.execCommand = original;
        }
        document.getSelection()!.removeAllRanges();
        editor.restoreSelection();

        const selection = document.getSelection()!;
        expect(selection.anchorNode).toBe(text);
        expect(selection.anchorOffset).toBe(2);
    });
});

describe('lifecycle', () => {
    it('removes its commands and provider on detach', async () => {
        const { editor } = await editorWith('<p>x</p>');
        const table = (editor as unknown as { commandTable: Map<string, () => void> }).commandTable;
        expect(['bold', 'italic', 'underline', 'strikethrough', 'code', 'clear'].every((name) => table.has(name))).toBe(true);

        editor.remove();

        expect(['bold', 'italic', 'underline', 'strikethrough', 'code', 'clear'].some((name) => table.has(name))).toBe(false);
        editor.applyInlineStyle({ color: '#ff0000' });
        expect(editableOf(editor).innerHTML).toBe('<p>x</p>');
    });
});
