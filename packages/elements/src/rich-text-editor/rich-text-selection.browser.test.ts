import { afterEach, describe, expect, it, vi } from 'vitest';
import { editableOf, editorIn, placeCaret } from './rich-text-editor.fixture.test.js';

async function setup() {
    const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
    const controller = editor.provider('selection')!;
    const editable = editableOf(editor);
    const moved = (): void => {
        editable.dispatchEvent(new Event('keyup', { bubbles: true }));
    };
    const load = (markup: string): void => {
        editable.innerHTML = markup;
    };
    /** Loads `markup`, puts the caret at the end of `selector`'s text and reports what is active there. */
    const caretIn = (markup: string, selector: string): ReadonlySet<string> => {
        load(markup);
        const target = editable.querySelector(selector)!;
        const text = document.createTreeWalker(target, NodeFilter.SHOW_TEXT).nextNode() as Text | null;
        if (text) placeCaret(text, text.data.length);
        else placeCaret(target, 0);
        moved();
        return editor.activeFormats;
    };
    return { editor, controller, editable, moved, load, caretIn };
}

function selectRange(start: Node, from: number, end: Node, to: number): void {
    const range = new Range();
    range.setStart(start, from);
    range.setEnd(end, to);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

afterEach(() => {
    vi.restoreAllMocks();
});

describe('SelectionController block-state activeFormats', () => {
    it("reports heading1/2/3 for the caret's heading level", async () => {
        const { caretIn } = await setup();
        expect(caretIn('<h1>a</h1>', 'h1')).toContain('heading1');
        expect(caretIn('<h2>a</h2>', 'h2')).toContain('heading2');
        expect(caretIn('<h3>a</h3>', 'h3')).toContain('heading3');
    });

    it('reports paragraph in a plain block, and not alongside a heading', async () => {
        const { caretIn } = await setup();
        expect(caretIn('<p>a</p>', 'p')).toContain('paragraph');
        expect(caretIn('<h1>a</h1>', 'h1')).not.toContain('paragraph');
    });

    it('adds nothing for h4-h6, which have no toolbar button', async () => {
        const { caretIn } = await setup();
        const formats = caretIn('<h4>a</h4>', 'h4');
        for (const format of ['heading1', 'heading2', 'heading3', 'paragraph']) expect(formats).not.toContain(format);
    });

    it('reports blockquote, codeBlock and inline code', async () => {
        const { caretIn } = await setup();
        expect(caretIn('<blockquote>a</blockquote>', 'blockquote')).toContain('blockquote');
        const inPre = caretIn('<pre><code>a</code></pre>', 'code');
        expect(inPre).toContain('codeBlock');
        expect(inPre).not.toContain('code');
        expect(caretIn('<p><code>a</code></p>', 'code')).toContain('code');
    });

    it('reports bulletList, orderedList and taskList', async () => {
        const { caretIn } = await setup();
        const bullet = caretIn('<ul><li>a</li></ul>', 'li');
        expect(bullet).toContain('bulletList');
        expect(bullet).not.toContain('paragraph');
        expect(bullet).not.toContain('taskList');
        expect(caretIn('<ol><li>a</li></ol>', 'li')).toContain('orderedList');
        const task = caretIn('<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>a</span></li></ul>', 'span');
        expect(task).toContain('taskList');
        expect(task).not.toContain('bulletList');
    });

    it('tells the weight a heading inherits apart from bold formatting', async () => {
        const { caretIn } = await setup();
        // The browser answers queryCommandState only for a focused document, so answer as it would.
        const original = document.queryCommandState.bind(document);
        vi.spyOn(document, 'queryCommandState').mockImplementation((command) => {
            if (command !== 'bold') return original(command);
            const node = document.getSelection()?.getRangeAt(0).startContainer;
            const start = node?.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement | null);
            return !!start?.closest('h1, h2, h3, h4, h5, h6, b, strong, [style*="font-weight"]');
        });
        expect(caretIn('<h2>title</h2>', 'h2')).not.toContain('bold');
        expect(caretIn('<h2>a <b>bb</b></h2>', 'b')).toContain('bold');
        expect(caretIn('<h3><span style="font-weight:700">xx</span></h3>', 'span')).toContain('bold');
        expect(caretIn('<p><strong>xx</strong></p>', 'strong')).toContain('bold');
        expect(caretIn('<p>plain</p>', 'p')).not.toContain('bold');
    });

    it('reports alignCenter for a centred block', async () => {
        const { caretIn } = await setup();
        expect(caretIn('<p style="text-align: center">a</p>', 'p')).toContain('alignCenter');
    });

    it('maps physical left/right to alignLeft/alignRight in an LTR locale', async () => {
        const { caretIn } = await setup();
        expect(caretIn('<p style="text-align: left">a</p>', 'p')).toContain('alignLeft');
        expect(caretIn('<p style="text-align: right">a</p>', 'p')).toContain('alignRight');
    });

    it('mirrors physical left/right under an RTL locale', async () => {
        const { editor, caretIn } = await setup();
        editor.dir = 'rtl';
        await editor.updateComplete;
        expect(caretIn('<p style="text-align: right">a</p>', 'p')).toContain('alignLeft');
        expect(caretIn('<p style="text-align: left">a</p>', 'p')).toContain('alignRight');
    });

    it('resolves logical start/end to the same button in either direction', async () => {
        const { editor, caretIn } = await setup();
        expect(caretIn('<p style="text-align: start">a</p>', 'p')).toContain('alignLeft');
        expect(caretIn('<p style="text-align: end">a</p>', 'p')).toContain('alignRight');
        editor.dir = 'rtl';
        await editor.updateComplete;
        expect(caretIn('<p style="text-align: start">a</p>', 'p')).toContain('alignLeft');
        expect(caretIn('<p style="text-align: end">a</p>', 'p')).toContain('alignRight');
    });

    it('reports no alignment for justify', async () => {
        const { caretIn } = await setup();
        const formats = caretIn('<p style="text-align: justify">a</p>', 'p');
        for (const format of ['alignLeft', 'alignCenter', 'alignRight']) expect(formats).not.toContain(format);
    });

    it('reads the align attribute when no inline style is present', async () => {
        const { caretIn } = await setup();
        expect(caretIn('<p align="center">a</p>', 'p')).toContain('alignCenter');
    });

    it('reports indent for a nested list item and not for a top-level one', async () => {
        const { caretIn } = await setup();
        expect(caretIn('<ul><li>a</li></ul>', 'li')).not.toContain('indent');
        expect(caretIn('<ul><li>a<ul><li id="deep">b</li></ul></li></ul>', '#deep')).toContain('indent');
    });

    it('re-detects on the selection topic and publishes through the state topic', async () => {
        const { editor, caretIn } = await setup();
        let states = 0;
        editor.subscribe('state', () => states++);
        caretIn('<h1>a</h1>', 'h1');
        const afterFirst = states;
        expect(afterFirst).toBeGreaterThan(0);
        caretIn('<h1>b</h1>', 'h1');
        expect(states).toBe(afterFirst);
        caretIn('<h2>b</h2>', 'h2');
        expect(states).toBeGreaterThan(afterFirst);
    });

    it('stops detecting after detach', async () => {
        const { editor, caretIn } = await setup();
        editor.remove();
        expect(caretIn('<h1>a</h1>', 'h1')).not.toContain('heading1');
    });
});

describe('SelectionController text style availability', () => {
    const place = (selector: string, endSelector: string | undefined, s: Awaited<ReturnType<typeof setup>>, markup: string): void => {
        const { editable, load, moved } = s;
        load(markup);
        const start = editable.querySelector(selector)!.firstChild!;
        if (endSelector) {
            const end = editable.querySelector(endSelector)!.firstChild!;
            selectRange(start, 0, end, end.textContent!.length);
        } else {
            placeCaret(start, 1);
        }
        moved();
    };

    it.each([
        ['a paragraph', '<p>text</p>', 'p', true],
        ['a heading', '<h2>text</h2>', 'h2', true],
        ['a task row', '<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>text</span></li></ul>', 'li[data-task] > span', false],
        ['a list item', '<ul><li>text</li></ul>', 'li', false],
        ['a paragraph inside a list item', '<ul><li><p>text</p></li></ul>', 'li > p', false],
        ['a table cell', '<table><tbody><tr><td>text</td></tr></tbody></table>', 'td', false],
        ['a summary', '<details><summary>text</summary><p>body</p></details>', 'summary', false],
        ['a code block', '<pre><code>text</code></pre>', 'code', false],
        ['a quoted paragraph', '<blockquote><p>text</p></blockquote>', 'blockquote p', true],
        ['a nested list item', '<ul><li>top<ul><li>text</li></ul></li></ul>', 'li li', false],
        ['a heading inside a cell', '<table><tbody><tr><td><h2>text</h2></td></tr></tbody></table>', 'td h2', false],
        ['a paragraph in a details body', '<details><summary>head</summary><p>text</p></details>', 'details > p', true],
    ] as const)('is %s available: %s', async (...[, markup, selector, applies]) => {
        const s = await setup();
        const { controller } = s;
        place(selector, undefined, s, markup);
        expect(controller.textStyleAvailable).toBe(applies);
    });

    it.each([
        ['a selection from a paragraph into a list', '<p>text</p><ul><li>item</li></ul>', 'p', 'li', true],
        ['a selection from a list into a paragraph', '<ul><li>text</li></ul><p>after</p>', 'li', 'p', false],
    ] as const)('counts the lines of the first container for %s', async (...[, markup, selector, endSelector, applies]) => {
        const s = await setup();
        const { controller } = s;
        place(selector, endSelector, s, markup);
        expect(controller.textStyleAvailable).toBe(applies);
    });

    it('comes back after a task row, on the next paragraph', async () => {
        const s = await setup();
        const { controller } = s;
        const markup = '<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>todo</span></li></ul><p>text</p>';
        place('li[data-task] > span', undefined, s, markup);
        expect(controller.textStyleAvailable).toBe(false);
        place('p', undefined, s, markup);
        expect(controller.textStyleAvailable).toBe(true);
    });

    it('stays available with no selection in the editor', async () => {
        const { controller, load, moved } = await setup();
        load('<ul><li>text</li></ul>');
        document.getSelection()!.removeAllRanges();
        moved();
        expect(controller.textStyleAvailable).toBe(true);
    });

    it.each([
        ['a paragraph', '<p>text</p>', 'p', undefined],
        ['a heading', '<h2>text</h2>', 'h2', undefined],
        ['a task row', '<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"><span>text</span></li></ul>', 'li[data-task] > span', undefined],
        ['a list item', '<ul><li>text</li></ul>', 'li', undefined],
        ['a paragraph inside a list item', '<ul><li><p>text</p></li></ul>', 'li > p', undefined],
        ['a table cell', '<table><tbody><tr><td>text</td></tr></tbody></table>', 'td', undefined],
        ['a summary', '<details><summary>text</summary><p>body</p></details>', 'summary', undefined],
        ['a code block', '<pre><code>text</code></pre>', 'code', undefined],
        ['a quoted paragraph', '<blockquote><p>text</p></blockquote>', 'blockquote p', undefined],
        ['a nested list item', '<ul><li>top<ul><li>text</li></ul></li></ul>', 'li li', undefined],
        ['a heading inside a cell', '<table><tbody><tr><td><h2>text</h2></td></tr></tbody></table>', 'td h2', undefined],
        ['a paragraph in a details body', '<details><summary>head</summary><p>text</p></details>', 'details > p', undefined],
        ['a selection from a paragraph into a list', '<p>text</p><ul><li>item</li></ul>', 'p', 'li'],
        ['a selection from a list into a paragraph', '<ul><li>text</li></ul><p>after</p>', 'li', 'p'],
    ] as const)('the select agrees with the heading command in %s (Angular spec 5723-5766)', async (...[, markup, selector, endSelector]) => {
        const s = await setup();
        place(selector, endSelector, s, markup);
        const available = s.controller.textStyleAvailable;
        const before = s.editable.innerHTML;

        s.editor.format('heading1');

        expect(s.editable.innerHTML !== before).toBe(available);
    });

    // needs the toolbar wired into the shell: Angular spec 10449-10516
    it.skip('presses the heading button matching the caret block and shows it in the select', () => undefined);
});

describe('SelectionController inline style', () => {
    async function styledSelection(markup: string) {
        const setupResult = await setup();
        setupResult.load(markup);
        const span = setupResult.editable.querySelector('span')!;
        const range = new Range();
        range.selectNodeContents(span);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        setupResult.moved();
        return setupResult.controller.inlineStyle;
    }

    it('reflects the selection computed colour (raw)', async () => {
        const style = await styledSelection('<span style="color:#2563eb">SLA</span>');
        expect(style.color).toContain('rgb(37, 99, 235)');
    });

    it('reflects the selection computed background colour (raw)', async () => {
        const style = await styledSelection('<span style="background-color:#f97316">SLA</span>');
        expect(style.backgroundColor).toContain('rgb(249, 115, 22)');
    });

    it('exposes a transparent background as a raw transparent value', async () => {
        const style = await styledSelection('<span>Plain</span>');
        expect(style.backgroundColor).toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    });

    it('reflects the selection font size and family', async () => {
        const style = await styledSelection('<span style="font-size:20px;font-family:Georgia">SLA</span>');
        expect(style.fontSize).toBe('20');
        expect(style.fontFamily).toBe('Georgia');
    });

    it('detects the font family at the caret', async () => {
        const { controller, editable, load, moved } = await setup();
        load('<span style="font-family: Georgia">Styled text</span>');
        placeCaret(editable.querySelector('span')!.firstChild!, 2);
        moved();
        expect(controller.inlineStyle.fontFamily).toBe('Georgia');
    });

    it('ignores a selection that has collapsed outside the editor', async () => {
        const { controller, editable, load, moved } = await setup();
        load('<p><span style="color:#2563eb;background-color:#f97316">tinted</span></p>');
        const span = editable.querySelector('span')!;
        const range = new Range();
        range.selectNodeContents(span);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);
        moved();
        const reflected = controller.inlineStyle;

        const outside = document.createElement('p');
        outside.textContent = 'Presets';
        outside.style.color = 'rgb(1, 2, 3)';
        outside.style.backgroundColor = 'rgb(4, 5, 6)';
        document.body.append(outside);
        try {
            placeCaret(outside.firstChild!, 3);
            moved();
            expect(controller.inlineStyle).toEqual(reflected);
        } finally {
            outside.remove();
        }
    });
});

describe('SelectionController pending caret colour', () => {
    async function caretInHello() {
        const setupResult = await setup();
        setupResult.load('<p>hello</p>');
        const text = setupResult.editable.querySelector('p')!.firstChild as Text;
        placeCaret(text, 5);
        return { ...setupResult, text };
    }

    it('reflects a colour armed at the caret and keeps it while the caret has not moved', async () => {
        const { controller, moved } = await caretInHello();
        controller.armCaretStyle({ color: '#9333ea', backgroundColor: '#ffff00' });
        moved();
        expect(controller.inlineStyle.color).toBe('#9333ea');
        expect(controller.inlineStyle.backgroundColor).toBe('#ffff00');
        expect(controller.pendingCaretStyle()).toEqual({ color: '#9333ea', backgroundColor: '#ffff00' });
    });

    it('drops the pending colour and restores styleWithCSS once the caret moves', async () => {
        const { controller, text, moved } = await caretInHello();
        controller.armCaretStyle({ color: '#9333ea' });
        const exec = vi.spyOn(document, 'execCommand');
        moved();
        expect(exec).not.toHaveBeenCalled();

        placeCaret(text, 1);
        moved();

        expect(exec).toHaveBeenCalledWith('styleWithCSS', false, 'false');
        expect(controller.inlineStyle.color).not.toBe('#9333ea');
        expect(controller.pendingCaretStyle()).toEqual({});
    });

    it('ignores a pending colour when the selection is not collapsed', async () => {
        const { controller, editable, load, moved } = await setup();
        load('<p><span style="color:#2563eb">ranged</span></p>');
        const text = editable.querySelector('span')!.firstChild as Text;
        placeCaret(text, 2);
        controller.armCaretStyle({ color: '#9333ea' });
        moved();
        expect(controller.inlineStyle.color).toBe('#9333ea');

        document.getSelection()!.setBaseAndExtent(text, 2, text, 6);
        moved();

        expect(controller.inlineStyle.color).toBe('rgb(37, 99, 235)');
    });

    it('arms nothing over a selection', async () => {
        const { controller, text } = await caretInHello();
        selectRange(text, 0, text, 3);
        controller.armCaretStyle({ color: '#9333ea' });
        expect(controller.pendingCaretStyle()).toEqual({});
    });

    it('arms nothing when there is no caret', async () => {
        const { controller } = await caretInHello();
        document.getSelection()!.removeAllRanges();
        controller.armCaretStyle({ color: '#9333ea' });
        expect(controller.pendingCaretStyle()).toEqual({});
    });

    it('keeps a highlight when a text colour is chosen at the same caret, and the reverse (Angular spec 2019-2031, 2103-2113)', async () => {
        const { editor, controller } = await caretInHello();

        editor.applyInlineStyle({ backgroundColor: '#ffff00' });
        editor.applyInlineStyle({ color: '#9333ea' });
        expect(controller.pendingCaretStyle()).toEqual({ color: '#9333ea', backgroundColor: '#ffff00' });

        editor.applyInlineStyle({ backgroundColor: '#00ffff' });
        expect(controller.pendingCaretStyle()).toEqual({ color: '#9333ea', backgroundColor: '#00ffff' });
    });

    it('leaves styleWithCSS on while a caret holds a pending colour, and restores it over a selection (Angular spec 2057-2101)', async () => {
        const { editor, text } = await caretInHello();
        const issued: string[] = [];
        const original = document.execCommand;
        document.execCommand = (id: string, ui?: boolean, value?: string) => {
            issued.push(`${id}=${value}`);
            return original.call(document, id, ui, value);
        };
        try {
            editor.applyInlineStyle({ color: '#9333ea' });
            expect(issued).toContain('styleWithCSS=true');
            expect(issued).not.toContain('styleWithCSS=false');

            selectRange(text, 0, text, 5);
            editor.applyInlineStyle({ color: '#2563eb' });
            expect(issued).toContain('styleWithCSS=false');
        } finally {
            document.execCommand = original;
        }
    });
});

describe('SelectionController selection helpers', () => {
    it('selectedTextInEditor reads only a selection inside the editor', async () => {
        const { controller, editable, load } = await setup();
        load('<p>select this</p>');
        const text = editable.querySelector('p')!.firstChild!;
        selectRange(text, 0, text, 6);
        expect(controller.selectedTextInEditor()).toBe('select');

        const outside = document.createElement('div');
        outside.textContent = 'elsewhere';
        document.body.append(outside);
        try {
            selectRange(outside.firstChild!, 0, outside.firstChild!, 4);
            expect(controller.selectedTextInEditor()).toBe('');
        } finally {
            outside.remove();
        }
        placeCaret(text, 2);
        expect(controller.selectedTextInEditor()).toBe('');
    });

    it('reSaveLiveSelection saves a live range inside the editor and ignores one outside', async () => {
        const { editor, controller, editable, load } = await setup();
        load('<p>alpha beta</p>');
        const text = editable.querySelector('p')!.firstChild!;
        selectRange(text, 6, text, 10);
        controller.reSaveLiveSelection();

        const outside = document.createElement('div');
        outside.textContent = 'elsewhere';
        document.body.append(outside);
        try {
            selectRange(outside.firstChild!, 0, outside.firstChild!, 4);
            controller.reSaveLiveSelection();
            const [mark] = editor.wrapSelection(() => document.createElement('mark'));
            expect(mark?.textContent).toBe('beta');
        } finally {
            outside.remove();
        }
    });

    it('reSaveLiveSelection reselects across the spans a command produced', async () => {
        const { editor, controller, editable, load } = await setup();
        load('<p><span>one</span> and <span>two</span></p>');
        const spans = [...editable.querySelectorAll<HTMLElement>('span')];
        placeCaret(editable.querySelector('p')!, 0);

        controller.reSaveLiveSelection(spans);

        expect(document.getSelection()!.toString()).toBe('one and two');
        document.getSelection()!.removeAllRanges();
        editor.restoreSelection({ preferLive: false });
        expect(document.getSelection()!.toString()).toBe('one and two');
    });
});
