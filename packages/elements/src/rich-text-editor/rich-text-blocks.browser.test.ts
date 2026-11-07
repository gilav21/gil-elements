import { describe, expect, it } from 'vitest';
import { caretTakesTextStyle, quoteBlockToDepth } from './rich-text-blocks.js';
import { blockEditor, editableOf, load, placeCaret, selectBetween, selectContents, tagsOf } from './rich-text-editor.fixture.test.js';
import { MAX_NESTING_DEPTH } from './rich-text-lines.js';

const IMG = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="x">';
const taskRow = (text: string, checked = false) =>
    `<li data-task data-checked="${checked}"><input type="checkbox"><span>${text}</span></li>`;
const kids = (root: Element) => Array.from(root.children, (el) => el.tagName);
const textAt = (root: Element, selector: string, index = 0) => root.querySelectorAll(selector)[index]!.firstChild as Text;

describe('headings and paragraphs', () => {
    it('converts the current block to a heading', async () => {
        const editor = await blockEditor('<p>title text</p>');
        selectContents(editableOf(editor));

        editor.format('heading1');

        expect(editableOf(editor).querySelector('h1')?.textContent).toBe('title text');
    });

    it('re-tagging lines keeps the selection start when the node its end sat on is replaced', async () => {
        const editor = await blockEditor('<p>one</p><p>two</p>');
        const root = editableOf(editor);
        const [first, second] = Array.from(root.querySelectorAll('p'));
        selectBetween(first!.firstChild!, 1, second!, 1);

        editor.format('heading1');

        const selection = document.getSelection()!;
        expect(Array.from(root.children, (el) => `${el.tagName}:${el.textContent}`)).toEqual(['H1:one', 'H1:two']);
        expect(selection.isCollapsed).toBe(true);
        expect(selection.anchorNode).toBe(root.querySelector('h1')!.firstChild);
        expect(selection.anchorOffset).toBe(1);
    });

    it('a block command on loose inline text beside a paragraph wraps only that text, where it lives', async () => {
        const editor = await blockEditor('');
        const root = editableOf(editor);
        root.innerHTML = '<div><b>bold</b> tail<p>para</p></div>';
        placeCaret(root.querySelector('b')!.firstChild!, 2);

        editor.format('heading1');

        expect(root.querySelector('div > h1')?.innerHTML).toBe('<b>bold</b> tail');
        expect(root.querySelector('div > p')?.textContent).toBe('para');
    });

    it('turns a heading back into a paragraph', async () => {
        const editor = await blockEditor('<h2>title</h2>');
        placeCaret(textAt(editableOf(editor), 'h2'), 2);

        editor.format('paragraph');

        expect(tagsOf(editableOf(editor))).toEqual(['P:title']);
    });

    it('a heading leaves a paragraph inside a list item as it is', async () => {
        const editor = await blockEditor('<ul><li><p>a</p><p>b</p></li></ul>');
        placeCaret(textAt(editableOf(editor), 'li > p'), 1);

        editor.format('heading1');

        const root = editableOf(editor);
        expect(root.querySelector('h1')).toBeNull();
        expect(Array.from(root.querySelectorAll('li > p'), (p) => p.textContent)).toEqual(['a', 'b']);
    });

    it('a heading picked from the slash menu on a list item leaves the item as it is', async () => {
        const editor = await blockEditor('<ul><li>one</li></ul>');
        const root = editableOf(editor);

        editor.executeToolbarCommandOnBlock('heading1', root.querySelector('li'));

        expect(root.querySelector('h1')).toBeNull();
        expect(root.querySelector('ul > li')?.textContent).toBe('one');
    });

    it('runs a block command on a block that holds only other blocks, at the end of its last line', async () => {
        const editor = await blockEditor('<p>before</p><blockquote><p>one</p><p>two</p></blockquote>');
        const root = editableOf(editor);

        editor.executeToolbarCommandOnBlock('heading1', root.querySelector('blockquote'));

        expect(Array.from(root.querySelectorAll('blockquote > *'), (el) => `${el.tagName}:${el.textContent}`)).toEqual(['P:one', 'H1:two']);
    });

    it('ignores a block that left the editor, and does nothing while readonly', async () => {
        const editor = await blockEditor('<p>one</p>');
        const root = editableOf(editor);
        const stale = root.querySelector('p')!;
        await load(editor, '<p>two</p>');

        editor.executeToolbarCommandOnBlock('heading1', stale);
        expect(root.querySelector('h1')).toBeNull();

        editor.readonly = true;
        await editor.updateComplete;
        editor.executeToolbarCommandOnBlock('heading1', root.querySelector('p'));
        editor.format('heading1');
        expect(root.querySelector('h1')).toBeNull();
    });

    it('reports whether Normal text and headings would change anything at the caret', async () => {
        const editor = await blockEditor('<p>plain</p><ul><li>item</li></ul>');
        const root = editableOf(editor);
        const selection = document.getSelection();

        placeCaret(textAt(root, 'p'), 1);
        expect(caretTakesTextStyle(selection, root)).toBe(true);
        placeCaret(textAt(root, 'li'), 1);
        expect(caretTakesTextStyle(selection, root)).toBe(false);
        selection?.removeAllRanges();
        expect(caretTakesTextStyle(selection, root)).toBe(true);
    });
});

describe('blockquote', () => {
    it('converts the current block to a blockquote', async () => {
        const editor = await blockEditor('<p>quote me</p>');
        selectContents(editableOf(editor));

        editor.format('blockquote');

        expect(editableOf(editor).querySelector('blockquote > p')?.textContent).toBe('quote me');
    });

    it("lifts the caret's quote back out on a second blockquote click", async () => {
        const editor = await blockEditor('<p>before</p><blockquote><p>quoted</p></blockquote><p>after</p>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'blockquote p'), 2);

        editor.format('blockquote');

        expect(root.querySelector('blockquote')).toBeNull();
        expect(Array.from(root.children, (el) => el.textContent)).toEqual(['before', 'quoted', 'after']);
        expect(root.children[1]!.contains(document.getSelection()?.anchorNode ?? null)).toBe(true);
    });

    it('quotes every top-level block the selection spans, wrapping bare text in a paragraph', async () => {
        const editor = await blockEditor('<p>one</p><div>two</div>');
        const root = editableOf(editor);
        root.append(document.createTextNode('three'));
        selectBetween(root.querySelector('p')!.firstChild!, 1, root.lastChild!, 2);

        editor.format('blockquote');

        expect(root.querySelectorAll('blockquote')).toHaveLength(1);
        expect(Array.from(root.querySelectorAll('blockquote > *'), (el) => `${el.tagName}:${el.textContent}`)).toEqual(['P:one', 'P:two', 'P:three']);
    });

    it('a block command stops at a container boundary instead of gutting a list', async () => {
        const editor = await blockEditor('<p>one</p><ul><li>item</li></ul>');
        const root = editableOf(editor);
        selectBetween(root.querySelector('p')!.firstChild!, 0, root.querySelector('li')!.firstChild!, 2);

        editor.format('blockquote');

        expect(root.querySelector('blockquote > p')?.textContent).toBe('one');
        expect(root.querySelector('blockquote li')).toBeNull();
        expect(root.querySelector('ul > li')?.textContent).toBe('item');
    });

    it('a quote on a numbered item splits the list, and the second half counts on', async () => {
        const editor = await blockEditor('<ol><li>a</li><li>b</li><li>c</li></ol>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li', 1), 1);

        editor.format('blockquote');

        expect(tagsOf(root)).toEqual(['OL:a', 'BLOCKQUOTE:b', 'OL:c']);
        expect(root.querySelectorAll('ol')[1]!.getAttribute('start')).toBe('2');
    });

    it('a quote on a nested row leaves the document as it was', async () => {
        const editor = await blockEditor('<ul><li>parent<ul><li>child</li><li>second</li></ul></li></ul>');
        const root = editableOf(editor);
        const before = root.innerHTML;
        placeCaret(textAt(root, 'li', 1), 2);

        editor.format('blockquote');

        expect(root.innerHTML).toBe(before);
    });

    it('quotes a block as deep as the markdown reader allows', async () => {
        const editor = await blockEditor('<p>deep</p>');
        const root = editableOf(editor);

        const quoted = quoteBlockToDepth(root.querySelector('p')!, 3, root);

        expect(quoted.textContent).toBe('deep');
        expect(root.querySelectorAll('blockquote blockquote blockquote > p')).toHaveLength(1);

        quoteBlockToDepth(quoted, 100, root);
        expect(root.querySelectorAll('blockquote')).toHaveLength(MAX_NESTING_DEPTH);
    });
});

describe('code blocks', () => {
    it('the code block toggle on a numbered list first item leaves the rest counting from one', async () => {
        const editor = await blockEditor('<ol><li>one</li><li>two</li><li>three</li></ol>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li'), 1);

        editor.format('codeBlock');

        expect(kids(root)).toEqual(['PRE', 'OL']);
        expect(root.querySelector('pre > code')?.textContent).toBe('one');
        expect(Array.from(root.querySelectorAll('ol > li'), (li) => li.textContent)).toEqual(['two', 'three']);
        expect(root.querySelector('ol')?.hasAttribute('start')).toBe(false);
    });

    it('the code block toggle keeps an empty line of code as an empty paragraph', async () => {
        const editor = await blockEditor('<pre><code>a\n\nb</code></pre>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'code'), 0);

        editor.format('codeBlock');

        expect(Array.from(root.children, (el) => `${el.tagName}:${el.innerHTML}`)).toEqual(['P:a', 'P:<br>', 'P:b']);
    });

    it("turns the caret's paragraph into a code block, and back into paragraphs", async () => {
        const editor = await blockEditor('<p>before</p><p>snippet body</p><p>after</p>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'p', 1), 3);

        editor.format('codeBlock');

        expect(kids(root)).toEqual(['P', 'PRE', 'P']);
        expect(root.querySelector('pre > code')?.textContent).toBe('snippet body');
        expect(root.querySelector('pre')?.contains(document.getSelection()?.anchorNode ?? null)).toBe(true);

        editor.format('codeBlock');

        expect(root.querySelector('pre')).toBeNull();
        expect(Array.from(root.children, (el) => el.textContent)).toEqual(['before', 'snippet body', 'after']);
    });

    it('joins several selected lines into one code block and splits it back per line', async () => {
        const editor = await blockEditor('<p>one</p><p>two</p>');
        const root = editableOf(editor);
        selectBetween(textAt(root, 'p', 0), 1, textAt(root, 'p', 1), 1);

        editor.format('codeBlock');
        expect(root.querySelectorAll('pre')).toHaveLength(1);
        expect(root.querySelector('pre > code')?.textContent).toBe('one\ntwo');

        editor.format('codeBlock');
        expect(Array.from(root.querySelectorAll('p'), (p) => p.textContent)).toEqual(['one', 'two']);
    });

    it('the code block toggle keeps a break inside a line as a new line of code', async () => {
        const editor = await blockEditor('<p><em>one<br>two</em> three</p>');
        placeCaret(textAt(editableOf(editor), 'em'), 1);

        editor.format('codeBlock');

        expect(editableOf(editor).querySelector('pre > code')?.textContent).toBe('one\ntwo three');
    });

    it("the code block toggle takes the caret's list item out, splitting the list around it", async () => {
        const editor = await blockEditor('<ul><li>one</li><li>two</li><li>three</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li', 1), 1);

        editor.format('codeBlock');

        expect(tagsOf(root)).toEqual(['UL:one', 'PRE:two', 'UL:three']);
        expect(root.querySelector('li pre')).toBeNull();
    });

    it("a code block taken from an item keeps the item's sub-list, as a list after the block", async () => {
        const editor = await blockEditor('<ul><li>text<ul><li>sub</li></ul></li></ul>');
        placeCaret(textAt(editableOf(editor), 'li'), 2);

        editor.format('codeBlock');

        expect(tagsOf(editableOf(editor))).toEqual(['PRE:text', 'UL:sub']);
    });

    it('the code block toggle leaves a table cell as it is, since a pipe table cannot hold one', async () => {
        const editor = await blockEditor('<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'td'), 1);

        editor.format('codeBlock');

        expect(root.querySelector('pre')).toBeNull();
        expect(Array.from(root.querySelectorAll('td'), (td) => td.textContent)).toEqual(['a', 'b']);
    });

    it('stands down on a line that also holds an image rather than drop it', async () => {
        const editor = await blockEditor(`<p>text${IMG}</p>`);
        const root = editableOf(editor);
        const before = root.innerHTML;
        placeCaret(textAt(root, 'p'), 1);

        editor.format('codeBlock');

        expect(root.innerHTML).toBe(before);
    });
});

describe('lists', () => {
    it.each([
        ['bulletList', `<ul><li>${IMG}</li></ul>`],
        ['orderedList', `<ol><li>${IMG}</li></ol>`],
        ['taskList', `<ul data-task-list>${taskRow(IMG)}</ul>`],
    ])('turning %s off keeps an item that holds only an image', async (command, html) => {
        const editor = await blockEditor(html);
        const root = editableOf(editor);
        placeCaret(root.querySelector('li')!, 0);

        editor.format(command as 'bulletList');

        expect(root.querySelector('ul, ol')).toBeNull();
        expect(root.querySelector('p > img')?.getAttribute('alt')).toBe('x');
    });

    it('turning bullets off keeps each sub-list below the item it belonged to', async () => {
        const editor = await blockEditor('<ul><li>parent<ul><li>child</li></ul></li><li>next</li></ul>');
        placeCaret(textAt(editableOf(editor), 'li'), 2);

        editor.format('bulletList');

        expect(tagsOf(editableOf(editor))).toEqual(['P:parent', 'UL:child', 'P:next']);
    });

    it.each(['bulletList', 'orderedList', 'taskList'] as const)('%s leaves a table cell as it is', async (command) => {
        const editor = await blockEditor('<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'td'), 1);

        editor.format(command);

        expect(root.querySelector('ul, ol')).toBeNull();
        expect(Array.from(root.querySelectorAll('td'), (td) => td.textContent)).toEqual(['a', 'b']);
    });

    it('bullets leave a list around a table cell alone, rather than un-bulleting the outer list', async () => {
        const editor = await blockEditor('<ul><li><table><tbody><tr><td>cell</td></tr></tbody></table></li><li>next</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'td'), 2);

        editor.format('bulletList');

        expect(root.querySelectorAll('ul > li')).toHaveLength(2);
        expect(root.querySelector('li table td')?.textContent).toBe('cell');
    });

    it('a task list leaves a summary as it is', async () => {
        const editor = await blockEditor('<details><summary>head</summary><p>body</p></details>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'summary'), 1);

        editor.format('taskList');

        expect(root.querySelector('ul')).toBeNull();
        expect(root.querySelector('details > summary')?.textContent).toBe('head');
    });

    it("turning bullets off moves an item's code block out as a block, never into a paragraph", async () => {
        const editor = await blockEditor('<ul><li><pre><code>x = 1</code></pre></li><li>y</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li', 1), 1);

        editor.format('bulletList');

        expect(tagsOf(root)).toEqual(['PRE:x = 1', 'P:y']);
        expect(root.querySelector('p pre')).toBeNull();
    });

    it('a task list leaves a list whose item holds a rule as it is, rather than delete the rule', async () => {
        const editor = await blockEditor('<ul><li><p>a</p><hr><p>b</p></li></ul>');
        const root = editableOf(editor);
        const before = root.innerHTML;
        placeCaret(textAt(root, 'li > p'), 1);

        editor.format('taskList');

        expect(root.innerHTML).toBe(before);
        expect(root.querySelector('li hr')).not.toBeNull();
    });

    it("a task list flattens an item's quote into the row, one space between its lines", async () => {
        const editor = await blockEditor('<ul><li><blockquote><p>one</p><p>two</p></blockquote></li><li>z</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li', 1), 1);

        editor.format('taskList');

        const span = root.querySelector('li[data-task] > span')!;
        expect(span.textContent).toBe('one two');
        expect(span.querySelector('blockquote, p')).toBeNull();
    });

    it('a task list leaves an item holding a rule inside a quote as it is, rather than delete the rule', async () => {
        const editor = await blockEditor('<ul><li><p>A</p><blockquote><ul><li><p>a</p><hr><p>b</p></li></ul></blockquote></li></ul>');
        const root = editableOf(editor);
        const before = root.innerHTML;
        placeCaret(textAt(root, 'li > p'), 1);

        editor.format('taskList');

        expect(root.innerHTML).toBe(before);
        expect(root.querySelector('hr')).not.toBeNull();
    });

    it('a task list starts the next row with the content after an item sub-list, keeping the words in order', async () => {
        const editor = await blockEditor('<ul><li><p>a</p><ul><li>b</li></ul><p>c</p></li><li>z</li></ul>');
        const root = editableOf(editor);
        placeCaret(root.querySelector('ul')!.children[1]!.firstChild!, 1);

        editor.format('taskList');

        const rows = Array.from(root.querySelector('ul[data-task-list]')!.children);
        expect(rows.map((row) => row.querySelector(':scope > span')?.textContent)).toEqual(['a', 'c', 'z']);
        expect(rows[0]!.querySelector(':scope > ul > li')?.textContent).toBe('b');
        expect(root.textContent).toBe('abcz');
    });

    it.each([
        ['bulletList', '<ul><li>parent<ul><li>child</li></ul></li><li>next</li></ul>', 'li li'],
        ['taskList', `<ul data-task-list>${taskRow('parent').replace('</li>', `<ul data-task-list>${taskRow('child')}</ul></li>`)}${taskRow('next')}</ul>`, 'li li span'],
    ])('%s off on a sub-list puts its items after the top-level item, splitting the list', async (command, html, childSelector) => {
        const editor = await blockEditor(html);
        const root = editableOf(editor);
        placeCaret(root.querySelector(childSelector)!.firstChild!, 2);

        editor.format(command as 'bulletList');

        expect(tagsOf(root)).toEqual(['UL:parent', 'P:child', 'UL:next']);
        expect(root.querySelector('li p')).toBeNull();
    });

    it('bullets off on a sub-list two levels down leave the document as it was', async () => {
        const editor = await blockEditor('<ul><li>a<ul><li>b<ul><li>c</li></ul></li><li>d</li></ul></li></ul>');
        const root = editableOf(editor);
        const before = root.innerHTML;
        placeCaret(textAt(root, 'li li li'), 1);

        editor.format('bulletList');

        expect(root.innerHTML).toBe(before);
    });

    it.each(['bulletList', 'orderedList', 'taskList'] as const)('%s leaves a code block as it is', async (command) => {
        const editor = await blockEditor('<pre><code>a\nb</code></pre>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'code'), 1);

        editor.format(command);

        expect(root.querySelector('ul, ol')).toBeNull();
        expect(root.querySelector('pre > code')?.textContent).toBe('a\nb');
    });

    it('toggles an unordered list', async () => {
        const editor = await blockEditor('<p>item one</p>');
        selectContents(editableOf(editor));

        editor.format('bulletList');

        expect(editableOf(editor).querySelector('ul li')?.textContent).toContain('item one');
    });

    it("builds the list at the paragraph's level and toggles it back to paragraphs", async () => {
        const editor = await blockEditor('<p>first</p><p>second</p><p>third</p>');
        const root = editableOf(editor);
        selectBetween(textAt(root, 'p', 0), 0, textAt(root, 'p', 1), 3);

        editor.format('bulletList');

        expect(root.querySelector('p ul')).toBeNull();
        expect(kids(root)).toEqual(['UL', 'P']);
        expect(Array.from(root.querySelectorAll('ul > li'), (li) => li.textContent)).toEqual(['first', 'second']);
        expect(root.querySelector('ul')?.contains(document.getSelection()?.anchorNode ?? null)).toBe(true);

        editor.format('orderedList');
        expect(kids(root)).toEqual(['OL', 'P']);

        editor.format('orderedList');
        expect(kids(root)).toEqual(['P', 'P', 'P']);
        expect(root.children[0]!.textContent).toBe('first');
    });

    it('inserts a task list with a checkbox and editable text span', async () => {
        const editor = await blockEditor('<p>start</p>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'p'), 0);

        editor.format('taskList');

        const item = root.querySelector('ul[data-task-list] > li[data-task]');
        expect(item?.getAttribute('data-checked')).toBe('false');
        expect(item?.querySelector('input[type="checkbox"]')).toBeTruthy();
        expect(item?.querySelector('span')?.textContent).toBe('start');
        expect(root.querySelector('p')).toBeNull();
    });

    it('keeps selected text when making a task list, and toggles back to a plain paragraph', async () => {
        const editor = await blockEditor('<p>hello world</p>');
        const root = editableOf(editor);
        selectBetween(textAt(root, 'p'), 0, textAt(root, 'p'), 5);

        editor.format('taskList');
        expect(root.querySelector('li[data-task] > span')?.textContent).toBe('hello world');
        expect(root.textContent).toBe('hello world');

        editor.format('taskList');
        expect(root.querySelector('ul')).toBeNull();
        expect(root.querySelector('input')).toBeNull();
        expect(root.querySelector('p')?.textContent).toBe('hello world');
    });

    it('converts a task list to a numbered list without its checkboxes, and a bullet list to tasks', async () => {
        const editor = await blockEditor('<p>a</p>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'p'), 1);
        editor.format('taskList');

        editor.format('orderedList');
        expect(root.querySelector('ol > li')?.textContent).toBe('a');
        expect(root.querySelector('input, [data-task-list], [data-task]')).toBeNull();

        editor.format('taskList');
        expect(root.querySelector('ul[data-task-list] > li[data-task] > input[type="checkbox"]')).not.toBeNull();
        expect(root.querySelector('li[data-task] > span')?.textContent).toBe('a');
    });

    it('block commands are no-ops without a selection', async () => {
        const editor = await blockEditor('<p>x</p>');
        const root = editableOf(editor);
        editor.getSelection = () => null;

        for (const command of ['taskList', 'bulletList', 'blockquote', 'codeBlock', 'heading1'] as const) {
            expect(() => editor.format(command)).not.toThrow();
        }

        expect(root.innerHTML).toBe('<p>x</p>');
    });
});

describe('slash-menu execution matches the toolbar', () => {
    it.each(['bulletList', 'orderedList', 'taskList', 'blockquote'])('%s on an item holding a sub-list acts on the item line', async (command) => {
        const html = '<ul><li>parent<ul><li>child</li></ul></li><li>next</li></ul>';
        const editor = await blockEditor(html);
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li'), 3);
        editor.format(command as 'bulletList');
        const byToolbar = root.innerHTML.replaceAll('​', '');

        await load(editor, html);
        editor.executeToolbarCommandOnBlock(command, root.querySelector('li'));

        expect(root.innerHTML.replaceAll('​', '')).toBe(byToolbar);
    });

    it.each(['bulletList', 'orderedList', 'blockquote'])('%s on an item whose own line is blank acts on that line', async (command) => {
        const html = '<ul><li>&nbsp;<ul><li>child</li></ul></li><li>next</li></ul>';
        const editor = await blockEditor(html);
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li'), 1);
        editor.format(command as 'bulletList');
        const byToolbar = root.innerHTML.replaceAll('​', '');

        await load(editor, html);
        editor.executeToolbarCommandOnBlock(command, root.querySelector('li'));

        expect(root.innerHTML.replaceAll('​', '')).toBe(byToolbar);
    });

    it('inline code on an item holding a sub-list goes into the item line', async () => {
        const editor = await blockEditor('<ul><li>parent<ul><li>child</li></ul></li></ul>');
        const root = editableOf(editor);

        editor.executeToolbarCommandOnBlock('code', root.querySelector('li'));

        expect(root.querySelector('code')?.closest('li')).toBe(root.querySelector(':scope > ul > li'));
        expect(root.querySelector('li li code')).toBeNull();
    });

    it('a numbered list on a task row drops the task markers, as the toolbar does', async () => {
        const editor = await blockEditor(`<ul data-task-list>${taskRow('done', true)}</ul>`);
        const root = editableOf(editor);

        editor.executeToolbarCommandOnBlock('orderedList', root.querySelector('li'));

        expect(root.querySelector('ol > li')?.textContent).toBe('done');
        expect(root.querySelector('li[data-task], input')).toBeNull();
    });

    it('inserts a collapsible toggle block with its title selected', async () => {
        const editor = await blockEditor('<p>x</p>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'p'), 1);

        editor.executeToolbarCommandOnBlock('toggle', null);

        const details = root.querySelector('details');
        expect(root.textContent).toBe('xToggle titleContent here...');
        expect(details?.open).toBe(true);
        expect(details?.querySelector(':scope > summary')?.textContent).toBe('Toggle title');
        expect(details?.querySelector(':scope > p')?.textContent).toBe('Content here...');
        expect(document.getSelection()?.toString()).toBe('Toggle title');
    });
});

describe('horizontal rule', () => {
    it("inserts the rule after the caret's line, whole, with the caret in the paragraph that follows", async () => {
        const editor = await blockEditor('<p>hello world</p><p>after</p>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'p'), 2);

        editor.format('horizontalRule');

        expect(tagsOf(root)).toEqual(['P:hello world', 'HR:', 'P:', 'P:after']);
        expect(root.children[2]!.contains(document.getSelection()?.anchorNode ?? null)).toBe(true);
    });

    it('puts the rule in the place of an empty line', async () => {
        const editor = await blockEditor('<p>hello</p><p><br></p>');
        const root = editableOf(editor);
        placeCaret(root.querySelectorAll('p')[1]!, 0);

        editor.format('horizontalRule');

        expect(kids(root)).toEqual(['P', 'HR', 'P']);
    });

    it('a rule on a list item splits the list and sits between the halves', async () => {
        const editor = await blockEditor('<ul><li>a</li><li>b</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li'), 1);

        editor.format('horizontalRule');

        expect(tagsOf(root)).toEqual(['UL:a', 'HR:', 'P:', 'UL:b']);
    });

    it('a numbered list split by a rule keeps counting in its second half', async () => {
        const editor = await blockEditor('<ol><li>a</li><li>b</li><li>c</li></ol>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li', 1), 1);

        editor.format('horizontalRule');

        const lists = root.querySelectorAll('ol');
        expect(Array.from(lists, (ol) => ol.textContent)).toEqual(['ab', 'c']);
        expect(lists[1]!.getAttribute('start')).toBe('3');
    });

    it('a rule on a task row keeps both halves task lists', async () => {
        const editor = await blockEditor(`<ul data-task-list>${taskRow('a', true)}${taskRow('b')}</ul>`);
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li[data-task] > span'), 1);

        editor.format('horizontalRule');

        expect(root.querySelectorAll('ul[data-task-list]')).toHaveLength(2);
        expect(root.querySelector(':scope > hr')).not.toBeNull();
        expect(root.querySelector('li hr, span hr')).toBeNull();
    });

    it('a rule from a cell of a table inside a list item splits the list after that item', async () => {
        const editor = await blockEditor('<ul><li>a<table><tbody><tr><td>cell</td></tr></tbody></table></li><li>b</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'td'), 2);

        editor.format('horizontalRule');

        expect(tagsOf(root)).toEqual(['UL:acell', 'HR:', 'P:', 'UL:b']);
        expect(root.querySelector('li hr, td hr')).toBeNull();
    });

    it('a rule on a nested row goes after its top-level item, and no text moves', async () => {
        const editor = await blockEditor('<ul><li>parent<ul><li>child</li><li>second</li></ul></li><li>next</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li', 1), 2);

        editor.format('horizontalRule');

        expect(tagsOf(root)).toEqual(['UL:parentchildsecond', 'HR:', 'P:', 'UL:next']);
    });

    it("a rule on an empty item takes that item's place", async () => {
        const editor = await blockEditor('<ul><li>a</li><li><br></li><li>b</li></ul>');
        const root = editableOf(editor);
        placeCaret(root.querySelectorAll('li')[1]!, 0);

        editor.format('horizontalRule');

        expect(tagsOf(root)).toEqual(['UL:a', 'HR:', 'P:', 'UL:b']);
        expect(root.querySelectorAll('li')).toHaveLength(2);
    });

    it('a rule in a summary goes to the start of the details body', async () => {
        const editor = await blockEditor('<details><summary>head</summary><p>body</p></details>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'summary'), 2);

        editor.format('horizontalRule');

        expect(tagsOf(root.querySelector('details')!)).toEqual(['SUMMARY:head', 'HR:', 'P:', 'P:body']);
    });
});

describe('alignment', () => {
    it('applies center alignment to the current block', async () => {
        const editor = await blockEditor('<p>first</p><p>centered</p>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'p', 1), 3);
        const issued: Array<{ command: string; block: string | null | undefined }> = [];
        const real = document.execCommand.bind(document);
        document.execCommand = (command: string, showUi?: boolean, value?: string) => {
            issued.push({ command, block: document.getSelection()?.anchorNode?.parentElement?.closest('p')?.textContent });
            return real(command, showUi, value);
        };

        try {
            editor.format('alignCenter');
        } finally {
            document.execCommand = real;
        }

        expect(issued).toEqual([{ command: 'justifyCenter', block: 'centered' }]);
    });

    it.each([
        ['ltr', 'alignLeft', 'justifyLeft'],
        ['ltr', 'alignRight', 'justifyRight'],
        ['rtl', 'alignLeft', 'justifyRight'],
        ['rtl', 'alignRight', 'justifyLeft'],
    ] as const)('in %s text %s issues %s', async (dir, command, expected) => {
        const editor = await blockEditor('<p>text</p>');
        editor.dir = dir;
        await editor.updateComplete;
        placeCaret(textAt(editableOf(editor), 'p'), 1);
        const issued: string[] = [];
        const real = document.execCommand.bind(document);
        document.execCommand = (name: string, showUi?: boolean, value?: string) => {
            issued.push(name);
            return real(name, showUi, value);
        };

        try {
            editor.format(command);
        } finally {
            document.execCommand = real;
        }

        expect(issued).toEqual([expected]);
    });
});

describe('lifecycle', () => {
    it('registers its commands on attach and removes them on detach', async () => {
        const editor = await blockEditor('<p>x</p>');
        const names = ['paragraph', 'heading1', 'heading2', 'heading3', 'bulletList', 'orderedList', 'taskList', 'blockquote', 'codeBlock', 'horizontalRule', 'alignLeft', 'alignCenter', 'alignRight'] as const;
        const table = (editor as unknown as { commandTable: Map<string, () => void> }).commandTable;
        expect(names.every((name) => table.has(name))).toBe(true);

        editor.remove();

        expect(names.some((name) => table.has(name))).toBe(false);
    });
});

describe('block commands beside indent and outdent', () => {
    it('outdenting the last item of a sub-list carries what its parent holds after the sub-list, keeping the words in order', async () => {
        const editor = await blockEditor('<ul><li><p>a</p><ul><li>b</li><li>c</li></ul><h2>d</h2><ol><li>e</li></ol></li><li>f</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li li', 1), 1);

        editor.format('outdent');

        const items = Array.from(root.querySelector('ul')!.children);
        expect(root.textContent).toBe('abcdef');
        expect(items.map((item) => item.textContent)).toEqual(['ab', 'cde', 'f']);
        expect(Array.from(items[1]!.children, (child) => child.nodeName)).toEqual(['P', 'H2', 'OL']);
        expect(items[1]!.querySelector(':scope > p')!.contains(document.getSelection()!.anchorNode)).toBe(true);
    });

    it('outdenting a task row out of a plain item puts what followed its list in an item after the row', async () => {
        const editor = await blockEditor(`<ul><li><p>a</p><ul data-task-list>${taskRow('b')}</ul><p>c</p></li></ul>`);
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li[data-task] > span'), 1);

        editor.format('outdent');

        expect(root.textContent).toBe('abc');
        const items = Array.from(root.querySelectorAll(':scope > ul > li'));
        expect(items.map((item) => item.textContent)).toEqual(['a', 'b', 'c']);
        expect(Array.from(items[1]!.children, (child) => child.nodeName)).toEqual(['INPUT', 'SPAN']);
        expect(items[2]!.matches('li:not([data-task])')).toBe(true);
        expect(Array.from(items[2]!.children, (child) => child.nodeName)).toEqual(['P']);
    });

    it.each([
        ['an empty numbered item', '<ol><li><br></li></ol>', ['OL']],
        ['a blank paragraph', '<p><br></p>', ['P', 'P']],
        ['an empty code block', '<pre><code></code></pre>', ['P', 'PRE']],
    ])('outdenting the last item of a sub-list carries %s after it', async (...[, trailing, children]) => {
        const editor = await blockEditor(`<ul><li><p>G</p><ul><li>X</li></ul>${trailing}</li></ul>`);
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li li'), 1);

        editor.format('outdent');

        const items = Array.from(root.querySelector('ul')!.children);
        expect(Array.from(items[0]!.children, (child) => child.nodeName)).toEqual(['P']);
        expect(Array.from(items[1]!.children, (child) => child.nodeName)).toEqual(children);
    });

    it.each([
        ['a second paragraph', 'indent', '<ul><li>A</li><li><p>W</p><p>Xray</p></li></ul>', 'p'],
        ['a code block', 'indent', '<ul><li>A</li><li><p>W</p><pre><code>Xray</code></pre></li></ul>', 'code'],
        ['a table cell', 'indent', '<ul><li>A</li><li><p>W</p><table><tbody><tr><td>Xray</td></tr></tbody></table></li></ul>', 'td'],
        ['a second paragraph, outdenting', 'outdent', '<ul><li>A<ul><li><p>W</p><p>Xray</p></li></ul></li></ul>', 'p'],
    ] as const)('keeps the caret in a later line of the moved item: %s', async (...[, command, html, tag]) => {
        const editor = await blockEditor(html);
        const root = editableOf(editor);
        const target = Array.from(root.querySelectorAll(tag)).find((el) => el.textContent === 'Xray')!;
        placeCaret(target.firstChild as Text, 2);

        editor.format(command);

        const selection = document.getSelection()!;
        expect(selection.anchorNode?.textContent).toBe('Xray');
        expect(selection.anchorOffset).toBe(2);
    });

    it.each([
        ['indenting an item holding a code block', 'indent', '<ul><li>A</li><li><p>X</p><pre><code>c</code></pre></li></ul>'],
        ['indenting an item of a loose list', 'indent', '<ul><li><p>A</p></li><li><p>X</p></li></ul>'],
        ['outdenting an item holding a code block', 'outdent', '<ul><li>A<ul><li><p>G</p><ul><li><p>X</p><pre><code>c</code></pre></li></ul></li></ul></li></ul>'],
        ['outdenting an item holding blocks that carries loose text', 'outdent', '<ul><li><p>G</p><ul><li><p>X</p><pre><code>c</code></pre></li></ul>tail</li></ul>'],
    ] as const)('%s keeps the caret in the line it was in', async (...[, command, html]) => {
        const editor = await blockEditor(html);
        const root = editableOf(editor);
        const x = Array.from(root.querySelectorAll('p')).find((p) => p.textContent === 'X')!;
        placeCaret(x.firstChild as Text, 1);

        editor.format(command);

        const selection = document.getSelection()!;
        expect(selection.anchorNode?.textContent).toBe('X');
        expect(selection.anchorOffset).toBe(1);
    });

    it('outdenting an item that holds blocks gives the loose text it carries a paragraph', async () => {
        const editor = await blockEditor('<ul><li><p>G</p><ul><li><p>X</p><pre><code>c</code></pre></li></ul>tail</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li li p'), 1);

        editor.format('outdent');

        const moved = root.querySelector('ul')!.children[1]!;
        expect(Array.from(moved.children, (child) => child.nodeName)).toEqual(['P', 'PRE', 'P']);
        expect(moved.lastElementChild?.textContent).toBe('tail');
    });

    it.each([
        ['a list', '<ul><li>Z</li></ul>', 'XZ', null],
        ['a list, then a paragraph', '<ul><li>Z</li></ul><p>t</p>', 'XZ', 't'],
    ])('outdenting a task row keeps %s after its list under the row, with no empty item', async (...[, trailing, rowText, itemText]) => {
        const editor = await blockEditor(`<ul><li><p>G</p><ul data-task-list>${taskRow('X')}</ul>${trailing}</li></ul>`);
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li[data-task] > span'), 1);

        editor.format('outdent');

        const row = root.querySelector('li[data-task]')!;
        expect(row.textContent).toBe(rowText);
        expect(row.querySelector(':scope > ul > li')?.textContent).toBe('Z');
        expect(Array.from(root.querySelectorAll('li')).filter((li) => li.firstElementChild?.matches('ul, ol'))).toHaveLength(0);
        expect(Array.from(root.querySelectorAll(':scope > ul > li'), (li) => li.textContent)).toEqual(['G', rowText, ...(itemText ? [itemText] : [])]);
    });

    it('Shift+Tab on a task row under a plain item keeps it a task row, in a task list of its own', async () => {
        const editor = await blockEditor(`<ul><li>plain<ul data-task-list>${taskRow('done', true)}</ul></li><li>next</li></ul>`);
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li[data-task] > span'), 2);

        editor.format('outdent');

        expect(tagsOf(root)).toEqual(['UL:plain', 'UL:done', 'UL:next']);
        const row = root.querySelector('li[data-task]') as HTMLElement;
        expect(row.parentElement?.dataset['taskList']).toBe('');
        expect(row.dataset['checked']).toBe('true');
    });

    it('Tab puts a plain item under a row that holds a task sub-list into a plain list of its own', async () => {
        const editor = await blockEditor(`<ul><li>a<ul data-task-list>${taskRow('t')}</ul></li><li>b</li></ul>`);
        const root = editableOf(editor);
        placeCaret(root.querySelectorAll(':scope > ul > li')[1]!.firstChild!, 1);

        editor.format('indent');

        expect(root.querySelector('li > ul:not([data-task-list]) > li')?.textContent).toBe('b');
        expect(root.querySelector('ul:not([data-task-list]) > li[data-task], ul[data-task-list] > li:not([data-task])')).toBeNull();
    });

    it('Tab joins the sub-list that ends the previous item, past blank text after it', async () => {
        const editor = await blockEditor('<ul><li>a<ul><li>sub</li></ul>\n</li><li>b</li></ul>');
        const root = editableOf(editor);
        placeCaret(root.querySelectorAll(':scope > ul > li')[1]!.firstChild!, 1);

        editor.format('indent');

        const top = root.querySelector(':scope > ul > li')!;
        expect(top.querySelectorAll(':scope > ul')).toHaveLength(1);
        expect(Array.from(top.querySelectorAll('li'), (li) => li.textContent)).toEqual(['sub', 'b']);
    });

    it('keeps the caret inside the item so a second indent still works', async () => {
        const editor = await blockEditor('<ul><li>a</li><li>b</li><li>c</li><li>d</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li', 3), 1);

        editor.format('indent');
        editor.format('indent');

        const selection = document.getSelection()!;
        expect(selection.anchorNode?.parentElement?.closest('li')?.textContent).toContain('d');
        expect(root.innerHTML).not.toContain('\t');
    });

    it('indents a list item under the previous sibling, then outdents it back', async () => {
        const editor = await blockEditor('<ul><li>first</li><li>second</li></ul>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li', 1), 0);

        editor.format('indent');
        const nested = root.querySelector('li > ul > li');
        expect(nested?.textContent).toContain('second');

        placeCaret(nested!.firstChild!, 0);
        editor.format('outdent');

        expect(root.querySelector('li > ul')).toBeNull();
        expect(root.querySelectorAll(':scope > ul > li')).toHaveLength(2);
    });

    it('indent/outdent step a paragraph outside a list by its left margin, never below zero', async () => {
        const editor = await blockEditor('<p>plain text</p>');
        const root = editableOf(editor);
        placeCaret(textAt(root, 'p'), 2);
        const marginLeft = () => root.querySelector('p')!.style.marginLeft;

        editor.format('indent');
        expect(marginLeft()).toBe('2rem');
        editor.format('indent');
        expect(marginLeft()).toBe('4rem');
        editor.format('outdent');
        expect(marginLeft()).toBe('2rem');
        editor.format('outdent');
        editor.format('outdent');
        expect(marginLeft()).toBe('');
        expect(root.textContent).toBe('plain text');
    });

    it('indenting a list item under a task-list previous sibling marks the new nested list as a task list', async () => {
        const editor = await blockEditor(`<ul data-task-list>${taskRow('first')}${taskRow('second')}</ul>`);
        const root = editableOf(editor);
        placeCaret(textAt(root, 'li > span', 1), 0);

        editor.format('indent');

        expect(root.querySelector('li > ul')?.hasAttribute('data-task-list')).toBe(true);
    });
});
