import { describe, expect, it } from 'vitest';
import { editableOf, editorIn, placeCaret, record } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';
import { MAX_NESTING_DEPTH } from './rich-text-lines.js';

async function setup(attributes = 'mode="html"') {
    const editor = await editorIn(`<ge-rich-text-editor ${attributes}></ge-rich-text-editor>`);
    const root = editableOf(editor);
    const seed = (html: string): HTMLElement => {
        root.innerHTML = html;
        return root.firstElementChild as HTMLElement;
    };
    return { editor, root, seed };
}

const inputEvent = (inputType = 'insertText', data: string | null = ' ') =>
    new InputEvent('input', { bubbles: true, composed: true, inputType, data });

/** Types `text` at the end of the block's leading text node, as a keystroke would, and raises `input`. */
function typeInto(root: HTMLElement, block: HTMLElement, text: string, inputType = 'insertText'): void {
    const existing = block.firstChild;
    const textNode = existing instanceof Text ? existing : block.insertBefore(document.createTextNode(''), block.firstChild);
    textNode.data += text;
    placeCaret(textNode, textNode.data.length);
    root.dispatchEvent(inputEvent(inputType, text.at(-1) ?? ''));
}

/** A marker typed before existing text, caret just after it. */
function typeMarkerBefore(root: HTMLElement, block: HTMLElement, full: string, caretOffset: number): void {
    const textNode = block.firstChild as Text;
    textNode.data = full;
    placeCaret(textNode, caretOffset);
    root.dispatchEvent(inputEvent());
}

/** A block holding `text` with the caret after it, then a bare `input` event. */
function seedText(block: HTMLElement, text: string, caret = text.length): Text {
    const textNode = block.insertBefore(document.createTextNode(text), block.firstChild);
    placeCaret(textNode, caret);
    return textNode;
}

const caretElement = (): HTMLElement | null => {
    const node = document.getSelection()?.getRangeAt(0).startContainer;
    return node instanceof Text ? node.parentElement : (node as HTMLElement | null) ?? null;
};
const stripped = (root: HTMLElement) => root.textContent?.replaceAll('​', '');
const press = (root: HTMLElement, key: string): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    root.dispatchEvent(event);
    return event;
};

describe('markdown shortcuts: block rules', () => {
    it('turns "# " in an empty paragraph into an h1 holding the caret, with no marker text', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '# ');

        const heading = root.querySelector('h1');
        expect(heading).not.toBeNull();
        expect(root.querySelector('p')).toBeNull();
        expect(stripped(heading!)?.trim()).toBe('');
        expect(heading?.contains(caretElement())).toBe(true);
    });

    it('turns "## " into an h2 and "### " into an h3', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '## ');
        expect(root.querySelector('h2')).not.toBeNull();

        typeInto(root, seed('<p><br></p>'), '### ');
        expect(root.querySelector('h3')).not.toBeNull();
    });

    it('keeps text that already followed the caret: "# " before "Title" yields <h1>Title</h1>', async () => {
        const { root, seed } = await setup();
        typeMarkerBefore(root, seed('<p>Title</p>'), '# Title', 2);

        expect(root.querySelector('h1')?.textContent).toBe('Title');
    });

    it('wraps the paragraph in ul > li for "- " and puts the caret in the item', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '- ');

        const item = root.querySelector('ul > li');
        expect(item?.contains(caretElement())).toBe(true);
    });

    it('wraps the paragraph in ol > li for "1. "', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '1. ');

        expect(root.querySelector('ol > li')?.contains(caretElement())).toBe(true);
    });

    it('wraps the paragraph in a blockquote for "> ", keeping it as the quote\'s line', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '> ');

        const line = root.querySelector('blockquote > p');
        expect(root.querySelectorAll('blockquote')).toHaveLength(1);
        expect(line?.contains(caretElement())).toBe(true);
    });

    it('builds one quote per ">" in the run', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '>> ');
        expect(root.querySelectorAll('blockquote')).toHaveLength(2);
        expect(root.querySelector('blockquote > blockquote > p')).not.toBeNull();

        typeInto(root, seed('<p><br></p>'), '>>> ');
        expect(root.querySelectorAll('blockquote')).toHaveLength(3);
        expect(root.querySelector('blockquote > blockquote > blockquote > p')?.contains(caretElement())).toBe(true);
    });

    it('keeps the text that followed the markers', async () => {
        const { root, seed } = await setup();
        typeMarkerBefore(root, seed('<p>hello</p>'), '>> hello', 3);

        expect(root.querySelectorAll('blockquote')).toHaveLength(2);
        expect(root.querySelector('blockquote > blockquote > p')?.textContent).toBe('hello');
    });

    it('nests one level deeper when ">" is typed inside a quote', async () => {
        const { root, seed } = await setup();
        seed('<blockquote><p><br></p></blockquote>');
        typeInto(root, root.querySelector('p')!, '> ');

        expect(root.querySelectorAll('blockquote')).toHaveLength(2);
    });

    it('puts every marker back on an immediate Backspace, not just the last', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '>>> ');
        press(root, 'Backspace');

        expect(root.querySelector('blockquote')).toBeNull();
        expect(root.textContent).toBe('>>> ');
    });

    it("stops at the reader's nesting ceiling rather than building a level it would unwrap", async () => {
        const { root, seed } = await setup();
        seed('<blockquote>'.repeat(31) + '<p><br></p>' + '</blockquote>'.repeat(31));
        typeInto(root, root.querySelector('p')!, '>>> ');

        expect(root.querySelectorAll('blockquote')).toHaveLength(MAX_NESTING_DEPTH);
        expect(stripped(root)).toBe('');
    });

    it('creates an unchecked task item for "[] "', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '[] ');

        const item = root.querySelector<HTMLElement>('ul[data-task-list] > li[data-task]')!;
        expect(item.dataset['checked']).toBe('false');
        expect(item.querySelector('input[type="checkbox"]')).not.toBeNull();
    });

    it('creates a checked task item with a checked box for "[x] "', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '[x] ');

        const item = root.querySelector<HTMLElement>('ul[data-task-list] > li[data-task]')!;
        expect(item.dataset['checked']).toBe('true');
        expect(item.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(true);
    });

    it('keeps trailing text as the task item text', async () => {
        const { root, seed } = await setup();
        typeMarkerBefore(root, seed('<p>buy milk</p>'), '[] buy milk', 3);

        const item = root.querySelector('ul[data-task-list] > li[data-task]');
        expect(item?.textContent?.replaceAll(' ', '').trim()).toBe('buy milk');
    });

    it('replaces the paragraph with an hr plus an empty paragraph holding the caret for "---"', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '---');

        expect(root.querySelector('hr')).not.toBeNull();
        expect(root.querySelector('hr + p')?.contains(caretElement())).toBe(true);
        expect(stripped(root)).not.toContain('-');
    });

    it('turns "```ts" plus a space into a pre > code carrying the language', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '```ts ');

        const code = root.querySelector<HTMLElement>('pre > code')!;
        expect(code.dataset['language']).toBe('ts');
        expect(code.className).toContain('language-ts');
    });

    it('turns "```" plus Enter into a plain pre > code and prevents the Enter', async () => {
        const { root, seed } = await setup();
        seedText(seed('<p><br></p>'), '```');
        const enter = press(root, 'Enter');

        expect(enter.defaultPrevented).toBe(true);
        expect(root.querySelector<HTMLElement>('pre > code')?.dataset['language']).toBeUndefined();
    });

    it('removes only the fence characters when Enter completes it, keeping the text after', async () => {
        const { root, seed } = await setup();
        seedText(seed('<p><br></p>'), '```code', 3);
        press(root, 'Enter');

        expect(root.querySelector('pre > code')?.textContent).toBe('code');
    });

    it('seeds an empty rule-created code block with a newline', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '``` ');

        expect(root.querySelector('pre > code')?.textContent).toBe('\n');
    });

    it('leaves a code block created by the rule on Enter, dropping its seed newline', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '``` ');
        const code = root.querySelector('code')!;
        placeCaret(code.firstChild!, (code.firstChild as Text).data.length);

        const enter = press(root, 'Enter');

        expect(enter.defaultPrevented).toBe(true);
        expect(code.textContent).toBe('');
        expect(root.querySelector('pre + p')?.contains(caretElement())).toBe(true);
    });
});

describe('markdown shortcuts: guards', () => {
    it('does not fire when the marker is not the whole prefix ("foo - ")', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p>foo </p>'), '- ');

        expect(root.querySelector('ul')).toBeNull();
        expect(root.textContent).toContain('foo -');
    });

    it.each([
        ['a table cell', '<table><tbody><tr><td><p><br></p></td></tr></tbody></table>'],
        ['a table header cell', '<table><thead><tr><th><p><br></p></th></tr></thead></table>'],
        ['a pre', '<pre><p><br></p></pre>'],
        ['a summary', '<details><summary><p><br></p></summary><p>body</p></details>'],
    ])('does not fire in a paragraph inside %s', async (_name, html) => {
        const { root, seed } = await setup();
        const paragraph = seed(html).querySelector('p')!;
        typeInto(root, paragraph, '# ');

        expect(root.querySelector('h1')).toBeNull();
        expect(paragraph.isConnected).toBe(true);
        expect(paragraph.textContent).toBe('# ');
    });

    it('does not fire inside an existing heading', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<h2><br></h2>'), '# ');

        expect(root.querySelector('h1')).toBeNull();
        expect(root.querySelector('h2')?.textContent).toContain('#');
    });

    it('does not fire in a paragraph nested inside a list item', async () => {
        const { root, seed } = await setup();
        const paragraph = seed('<ul><li><p><br></p></li></ul>').querySelector('p')!;
        typeInto(root, paragraph, '# ');

        expect(root.querySelector('h1')).toBeNull();
        expect(root.querySelector('li')?.textContent).toContain('#');
    });

    it('does not fire when markdown-shortcuts is off', async () => {
        const { editor, root, seed } = await setup();
        editor.markdownShortcuts = false;
        await editor.updateComplete;
        typeInto(root, seed('<p><br></p>'), '# ');

        expect(root.querySelector('h1')).toBeNull();
        expect(root.textContent).toContain('#');
    });

    it.each(['readonly', 'disabled'] as const)('does not fire while %s', async (flag) => {
        const { editor, root, seed } = await setup();
        editor[flag] = true;
        await editor.updateComplete;
        seedText(seed('<p><br></p>'), '# ');

        root.dispatchEvent(inputEvent());

        expect(root.querySelector('h1')).toBeNull();
    });

    it('does not fire when the space arrived by a drop rather than a keystroke', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '- ', 'insertFromDrop');

        expect(root.querySelector('ul')).toBeNull();
        expect(root.textContent).toContain('-');
    });

    it('does not fire when insertText carried data other than a space', async () => {
        const { root, seed } = await setup();
        seedText(seed('<p><br></p>'), '- ');
        root.dispatchEvent(inputEvent('insertText', 'x'));

        expect(root.querySelector('ul')).toBeNull();
    });

    it('accepts a non-breaking space as the terminating space', async () => {
        const { root, seed } = await setup();
        seedText(seed('<p><br></p>'), '# ');
        root.dispatchEvent(inputEvent());

        expect(root.querySelector('h1')).not.toBeNull();
    });

    it('does not fire while a range is selected rather than a caret', async () => {
        const { root, seed } = await setup();
        const textNode = seed('<p>abc</p>').firstChild as Text;
        textNode.data = '# abc';
        const range = new Range();
        range.setStart(textNode, 2);
        range.setEnd(textNode, 4);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        root.dispatchEvent(inputEvent());

        expect(root.querySelector('h1')).toBeNull();
        expect(root.innerHTML).toBe('<p># abc</p>');
    });

    it.each(['deleteContentBackward', 'historyUndo', 'formatBold', 'insertCompositionText'])(
        'does not fire for inputType %s',
        async (inputType) => {
            const { root, seed } = await setup();
            typeInto(root, seed('<p><br></p>'), '# ', inputType);

            expect(root.querySelector('h1')).toBeNull();
            expect(root.textContent).toContain('#');
        },
    );

    it('fires for a plain Event with no inputType', async () => {
        const { root, seed } = await setup();
        seedText(seed('<p><br></p>'), '# ');
        root.dispatchEvent(new Event('input', { bubbles: true }));

        expect(root.querySelector('h1')).not.toBeNull();
    });

    it('transforms a block whose only content is an element', async () => {
        const { root, seed } = await setup();
        seedText(seed('<p><img alt=""></p>'), '# ');
        root.dispatchEvent(inputEvent());

        const heading = root.querySelector('h1');
        expect(heading?.querySelector('img')).not.toBeNull();
        expect(document.getSelection()?.rangeCount).toBe(1);
    });

    it('wraps a bare top-level text node in a paragraph before transforming it', async () => {
        const { root } = await setup();
        root.replaceChildren(document.createTextNode('# '));
        placeCaret(root.firstChild!, 2);
        root.dispatchEvent(inputEvent());

        expect(root.querySelector('h1')).not.toBeNull();
    });

});

describe('markdown shortcuts: observers and outputs', () => {
    it('notifies input observers with the post-transform text', async () => {
        const { editor, root, seed } = await setup();
        const observed: string[] = [];
        editor.registerInputObserver((text) => observed.push(text));
        typeInto(root, seed('<p><br></p>'), '# ');

        expect(observed.length).toBeGreaterThan(0);
        expect(observed.at(-1)).not.toContain('#');
    });

    it('emits value-change once per transform, carrying the transformed html', async () => {
        const { editor, root, seed } = await setup();
        const changes = record<{ html: string }>(editor, 'value-change');
        typeInto(root, seed('<p><br></p>'), '# ');

        expect(changes).toHaveLength(1);
        expect(changes[0]?.html).toContain('<h1');
    });

    it('emits the transformed markdown in markdown mode', async () => {
        const { editor, root, seed } = await setup('mode="markdown"');
        const changes = record<{ value: string }>(editor, 'value-change');
        typeMarkerBefore(root, seed('<p>Title</p>'), '# Title', 2);

        expect(changes.at(-1)?.value.trim()).toBe('# Title');
    });
});

describe('markdown shortcuts: inline rules', () => {
    it('turns "**bold**" into a strong carrying just the body', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '**bold**');

        expect(root.querySelector('strong')?.textContent).toBe('bold');
        expect(root.textContent).not.toContain('*');
    });

    it('lands text typed after the transform outside the strong', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '**bold**');
        const strong = root.querySelector('strong')!;

        const parked = document.getSelection()!.getRangeAt(0).startContainer as Text;
        parked.insertData(parked.data.length, 'x');
        placeCaret(parked, parked.data.length);
        root.dispatchEvent(inputEvent('insertText', 'x'));

        expect(strong.textContent).toBe('bold');
        expect(stripped(root)).toBe('boldx');
    });

    it('turns "*it*" into an em', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '*it*');

        expect(root.querySelector('em')?.textContent).toBe('it');
    });

    it('turns "`c`" into a code element', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '`c`');

        expect(root.querySelector('code')?.textContent).toBe('c');
    });

    it('changes nothing when the same keystrokes land inside an inline code element', async () => {
        const { root, seed } = await setup();
        const code = seed('<p><code>x</code></p>').querySelector('code')!;
        typeInto(root, code, '**b**');

        expect(root.querySelector('strong')).toBeNull();
        expect(code.textContent).toContain('**b**');
    });

    it.each([
        ['data-mention', '<p><span data-mention="u1">@ann</span></p>'],
        ['data-tag', '<p><span data-tag="t1">#rel</span></p>'],
        ['data-action-click', '<p><span data-action-click="run">act</span></p>'],
        ['data-action-hover', '<p><span data-action-hover="peek">act</span></p>'],
    ])('does not fire inside a [%s] chip', async (attribute, html) => {
        const { root, seed } = await setup();
        const chip = seed(html).querySelector<HTMLElement>(`[${attribute}]`)!;
        typeInto(root, chip, '**b**');

        expect(root.querySelector('strong')).toBeNull();
        expect(chip.textContent).toContain('**b**');
    });

    it('does not fire inside a pre that holds no code element', async () => {
        const { root, seed } = await setup();
        const pre = seed('<pre>x</pre>');
        typeInto(root, pre, '**b**');

        expect(root.querySelector('strong')).toBeNull();
        expect(pre.textContent).toContain('**b**');
    });

    it('does not fire inside a link', async () => {
        const { root, seed } = await setup();
        const link = seed('<p><a href="https://example.com">site</a></p>').querySelector('a')!;
        typeInto(root, link, '**b**');

        expect(root.querySelector('strong')).toBeNull();
    });

    it('fires inside a plain inline formatting element', async () => {
        const { root, seed } = await setup();
        const em = seed('<p><em>x</em></p>').querySelector('em')!;
        typeInto(root, em, '`c`');

        expect(em.querySelector('code')).not.toBeNull();
    });

    it('reverts on an immediate Backspace', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '`c`');
        expect(root.querySelector('code')).not.toBeNull();

        const event = press(root, 'Backspace');

        expect(event.defaultPrevented).toBe(true);
        expect(root.querySelector('code')).toBeNull();
        expect(root.textContent).toContain('`c`');
    });
});

describe('markdown shortcuts: one undo step and the Backspace revert', () => {
    it('captures the marker state as its own history entry, so undo restores the literal text', async () => {
        const { editor, root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '# ');
        expect(root.querySelector('h1')).not.toBeNull();

        editor.undo();

        expect(root.querySelector('h1')).toBeNull();
        expect(root.textContent).toContain('#');
    });

    it('re-applies the heading on redo', async () => {
        const { editor, root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '# ');
        editor.undo();
        expect(root.querySelector('h1')).toBeNull();

        editor.redo();

        expect(root.querySelector('h1')).not.toBeNull();
    });

    it('grows the history by exactly two entries: the markers, then the transform', async () => {
        const { editor, root, seed } = await setup();
        const before = editor.historyEntries().length;
        typeInto(root, seed('<p><br></p>'), '# ');

        expect(editor.historyEntries().length - before).toBe(2);
    });

    it('reverts the transform on Backspace and prevents the default delete', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '# ');

        const event = press(root, 'Backspace');

        expect(event.defaultPrevented).toBe(true);
        expect(root.querySelector('h1')).toBeNull();
        expect(root.textContent).toContain('#');
    });

    it('does not revert when another key came between the transform and the Backspace', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '# ');
        press(root, 'a');

        expect(press(root, 'Backspace').defaultPrevented).toBe(false);
        expect(root.querySelector('h1')).not.toBeNull();
    });

    it('closes the revert window on a later input that no keydown preceded', async () => {
        const { root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '# ');
        typeInto(root, root.querySelector('h1')!, 'abc');

        expect(press(root, 'Backspace').defaultPrevented).toBe(false);
        expect(root.querySelector('h1')).not.toBeNull();
    });

    it.each([
        ['the editor has blurred', (root: HTMLElement) => root.dispatchEvent(new FocusEvent('blur'))],
        ['a mousedown in the editor', (root: HTMLElement) => root.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))],
        ['the window is reset through the provider', (_root: HTMLElement, editor: GeRichTextEditor) => editor.provider('inputRules')?.resetRevertWindow()],
    ])('does not revert after %s', async (_name, close) => {
        const { editor, root, seed } = await setup();
        typeInto(root, seed('<p><br></p>'), '# ');
        close(root, editor);

        expect(press(root, 'Backspace').defaultPrevented).toBe(false);
        expect(root.querySelector('h1')).not.toBeNull();
    });

    it('forgets the recorded rule once the caret leaves the block it produced', async () => {
        const { root, seed } = await setup();
        const block = seed('<p><br></p>');
        const outside = root.appendChild(document.createElement('p'));
        outside.append('elsewhere');
        typeInto(root, block, '# ');
        const heading = root.querySelector('h1')!;
        const caret = document.getSelection()!.getRangeAt(0).cloneRange();

        placeCaret(outside.firstChild!, 3);
        root.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true }));
        placeCaret(caret.startContainer, caret.startOffset);

        expect(press(root, 'Backspace').defaultPrevented).toBe(false);
        expect(root.querySelector('h1')).toBe(heading);
    });
});

describe('markdown shortcuts: lifecycle', () => {
    it('stops transforming once the editor is disconnected', async () => {
        const { editor, root, seed } = await setup();
        editor.remove();
        typeInto(root, seed('<p><br></p>'), '# ');

        expect(root.querySelector('h1')).toBeNull();
    });
});
