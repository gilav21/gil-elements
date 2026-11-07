import { describe, expect, it } from 'vitest';
import { editableOf, editorIn, placeCaret } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';

async function setup(html: string): Promise<{ editor: GeRichTextEditor; root: HTMLElement }> {
    const editor = await editorIn('<ge-rich-text-editor mode="html"></ge-rich-text-editor>');
    editor.value = html;
    await editor.updateComplete;
    return { editor, root: editableOf(editor) };
}

const press = (root: HTMLElement, key: string, shiftKey = false): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true });
    root.dispatchEvent(event);
    return event;
};

const enterAt = (root: HTMLElement, node: Node, offset: number, shiftKey = false): KeyboardEvent => {
    placeCaret(node, offset);
    return press(root, 'Enter', shiftKey);
};

const enterAfter = (root: HTMLElement, element: Element): KeyboardEvent =>
    enterAt(root, element, element.childNodes.length);

describe('keyboard: Enter inside a blockquote', () => {
    it('leaves the quote on Enter from any plain quoted line, text kept whole', async () => {
        const { root } = await setup('<blockquote><p>hello world</p></blockquote>');
        const event = enterAt(root, root.querySelector('blockquote p')!.firstChild!, 5);

        expect(event.defaultPrevented).toBe(true);
        expect(root.querySelector('blockquote')?.textContent).toBe('hello world');
        const next = root.querySelector('blockquote + p');
        expect(next).not.toBeNull();
        expect(next?.contains(document.getSelection()?.anchorNode ?? null)).toBe(true);
    });

    it('leaves Shift+Enter to the browser, which adds a row inside the quote', async () => {
        const { root } = await setup('<blockquote><p>hello</p></blockquote>');
        const event = enterAt(root, root.querySelector('blockquote p')!.firstChild!, 5, true);

        expect(event.defaultPrevented).toBe(false);
        expect(root.querySelector('blockquote + p')).toBeNull();
    });

    it('leaves a quote that arrived as bare text too', async () => {
        const { root } = await setup('<p>x</p>');
        const quote = document.createElement('blockquote');
        quote.textContent = 'bare';
        root.replaceChildren(quote);
        const event = enterAt(root, quote.firstChild!, 4);

        expect(event.defaultPrevented).toBe(true);
        expect(root.querySelector('blockquote + p')).not.toBeNull();
    });

    it('leaves a quoted list item to the list handler', async () => {
        const { root } = await setup('<blockquote><ul><li>alpha</li></ul></blockquote>');
        const event = enterAt(root, root.querySelector('li')!.firstChild!, 5);

        expect(event.defaultPrevented).toBe(false);
        expect(root.querySelector('blockquote ul')).toBeTruthy();
    });

    it('leaves a quoted table cell alone', async () => {
        const { root } = await setup('<blockquote><table><tbody><tr><td>a</td></tr></tbody></table></blockquote>');
        const event = enterAt(root, root.querySelector('td')!.firstChild!, 1);

        expect(event.defaultPrevented).toBe(false);
        expect(root.querySelector('blockquote + p')).toBeNull();
        expect(root.querySelector('blockquote table td')?.textContent).toBe('a');
    });

    it('exits from a blank line in the middle of a quote, dropping only that line', async () => {
        const { root } = await setup('<blockquote><p>first</p><p><br></p><p>third</p></blockquote>');
        const event = enterAt(root, root.querySelectorAll('blockquote p')[1]!, 0);

        expect(event.defaultPrevented).toBe(true);
        expect([...root.querySelectorAll('blockquote p')].map((p) => p.textContent)).toEqual(['first', 'third']);
        expect(root.querySelector('blockquote + p')).not.toBeNull();
    });

    it('still exits the quote on a blank quoted line', async () => {
        const { root } = await setup('<blockquote><p></p></blockquote>');
        const event = enterAt(root, root.querySelector('blockquote p')!, 0);

        expect(event.defaultPrevented).toBe(true);
        expect(root.querySelector('blockquote')).toBeNull();
        expect(root.querySelector('p')).toBeTruthy();
    });

    it('keeps the image in the last quoted line', async () => {
        const { root } = await setup('<blockquote><p>q</p><p><img src="/x.png" alt="pic"></p></blockquote>');
        enterAfter(root, root.querySelectorAll('blockquote p')[1]!);

        expect(root.querySelector('blockquote img')).not.toBeNull();
    });
});

describe('keyboard: Enter in details and summary', () => {
    it('inside a summary with no content sibling creates a paragraph', async () => {
        const { root } = await setup('<details><summary>title</summary></details>');
        const summary = root.querySelector('summary')!;
        enterAt(root, summary.firstChild ?? summary, 0);

        expect(root.querySelector('details > p')).toBeTruthy();
    });

    it('inside a summary moves the caret into the details content', async () => {
        const { root } = await setup('<details open><summary>Title</summary><p>body</p></details>');
        const event = enterAt(root, root.querySelector('summary')!.firstChild!, 5);

        expect(event.defaultPrevented).toBe(true);
        const body = root.querySelector('details > p')!;
        const anchor = document.getSelection()?.anchorNode ?? null;
        expect(body === anchor || body.contains(anchor)).toBe(true);
    });

    it('at the end of a bold run in a details block does not leave the block', async () => {
        const { root } = await setup('<details><summary>head</summary><p><b>bold</b> more</p></details>');
        const event = enterAt(root, root.querySelector('b')!.firstChild!, 4);

        expect(event.defaultPrevented).toBe(false);
        expect(root.querySelector('details')).not.toBeNull();
        expect(root.querySelector('details p')).not.toBeNull();
    });

    it('on the empty last line of a details block still leaves it', async () => {
        const { root } = await setup('<details><summary>head</summary><p><br></p></details>');
        const event = enterAt(root, root.querySelector('details p')!, 0);

        expect(event.defaultPrevented).toBe(true);
        expect(root.querySelector('details p')).toBeNull();
        expect([...root.children].map((el) => el.tagName)).toEqual(['DETAILS', 'P']);
    });
});

describe('keyboard: Enter in inline code', () => {
    it('inside a table cell leaves the code span', async () => {
        const { root } = await setup('<table><tbody><tr><td><code>fn()</code></td></tr></tbody></table>');
        const event = enterAt(root, root.querySelector('code')!.firstChild!, 4);

        expect(event.defaultPrevented).toBe(true);
        const cell = root.querySelector('td')!;
        const lines = [...cell.querySelectorAll(':scope > p')];
        expect(lines).toHaveLength(2);
        expect(lines[0]?.querySelector('code')?.textContent).toBe('fn()');
        expect(lines[1]?.querySelector('code')).toBeNull();
        expect([...cell.childNodes].every((node) => node.nodeName === 'P')).toBe(true);
    });

    it('in a paragraph opens a plain paragraph after it', async () => {
        const { root } = await setup('<p>a <code>b</code></p>');
        const event = enterAt(root, root.querySelector('code')!.firstChild!, 1);

        expect(event.defaultPrevented).toBe(true);
        expect([...root.children].map((el) => el.tagName)).toEqual(['P', 'P']);
        expect(root.children[1]?.querySelector('code')).toBeNull();
    });
});

describe('keyboard: Enter in a code block', () => {
    it('exits it, leaving the content untouched', async () => {
        const { root } = await setup('<pre><code>line1</code></pre>');
        const event = enterAt(root, root.querySelector('code')!.firstChild!, 5);

        expect(event.defaultPrevented).toBe(true);
        expect(root.querySelector('code')?.textContent).toBe('line1');
        expect(root.querySelector('pre + p')).toBeTruthy();
    });

    it('after a Shift+Enter break at the end drops that break as it leaves', async () => {
        const { root } = await setup('<p>x</p>');
        root.innerHTML = '<pre><code>one<br>two<br></code></pre>';
        const code = root.querySelector('code')!;
        enterAt(root, code, code.childNodes.length);

        expect(code.innerHTML).toBe('one<br>two');
        expect(root.querySelector('pre + p')).toBeTruthy();
    });

    it('at the end of content ending with a newline exits the block', async () => {
        const { root } = await setup('<pre><code>done\n</code></pre>');
        const text = root.querySelector('code')!.firstChild as Text;
        enterAt(root, text, text.length);

        expect(root.querySelector('code')?.textContent).toBe('done\n');
        expect(root.querySelector('pre + p')).toBeTruthy();
    });

    it('without a <code> child exits the pre', async () => {
        const { root } = await setup('<pre>abc</pre>');
        enterAt(root, root.querySelector('pre')!.firstChild!, 3);

        expect(root.querySelector('pre')!.textContent).toBe('abc');
        expect(root.querySelector('pre + p')).toBeTruthy();
    });
});

describe('keyboard: Enter edges', () => {
    it('is a no-op without a selection', async () => {
        const { editor, root } = await setup('<p>text</p>');
        placeCaret(root.querySelector('p')!.firstChild!, 1);
        const original = editor.getSelection.bind(editor);
        editor.getSelection = () => null;
        try {
            const event = press(root, 'Enter');
            expect(event.defaultPrevented).toBe(false);
        } finally {
            editor.getSelection = original;
        }
    });

    it('records a handled Enter as one content change', async () => {
        const { editor, root } = await setup('<blockquote><p>q</p></blockquote>');
        enterAt(root, root.querySelector('p')!.firstChild!, 1);

        expect(editor.value).toContain('</blockquote><p>');
    });

    it('stops handling once detached', async () => {
        const { editor, root } = await setup('<pre><code>x</code></pre>');
        editor.remove();
        const event = enterAt(root, root.querySelector('code')!.firstChild!, 1);

        expect(event.defaultPrevented).toBe(false);
    });
});

describe('keyboard: owned by markdown-shortcuts', () => {
    it.skip('turns ``` plus Enter into a plain pre > code and prevents the Enter', () => undefined); // needs markdown-shortcuts (spec 9672)
    it.skip('removes only the fence characters when Enter completes it', () => undefined); // needs markdown-shortcuts (spec 9954)
    it.skip('leaves a code block created by the rule on Enter, dropping its seed newline', () => undefined); // needs markdown-shortcuts (spec 9977)
});
