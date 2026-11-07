import { describe, expect, it, vi } from 'vitest';
import { editableOf, editorIn, placeCaret } from './rich-text-editor.fixture.test.js';

const EMPTY = '<ge-rich-text-editor mode="html"></ge-rich-text-editor>';
const IMG = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">';
const MIXED_KINDS = 'ul:not([data-task-list]) > li[data-task], ul[data-task-list] > li:not([data-task])';

const row = (checked: boolean, inner: string) => `<li data-task="" data-checked="${checked}"><input type="checkbox">${inner}</li>`;
const TWO_TASKS = '<ul data-task-list="">' + row(true, '<span>first</span>') + row(false, '<span>second</span>') + '</ul>';

/** A mounted editor holding `html`. */
async function open(html = '') {
    const editor = await editorIn(EMPTY);
    const root = editableOf(editor);
    const load = async (markup: string) => {
        editor.value = markup;
        await editor.updateComplete;
    };
    await load(html);
    return {
        editor,
        root,
        load,
        $: (selector: string) => root.querySelector<HTMLElement>(selector),
        $$: (selector: string) => Array.from(root.querySelectorAll<HTMLElement>(selector)),
        spans: () => Array.from(root.querySelectorAll<HTMLElement>('li[data-task] > span')),
        key(name: string, init: KeyboardEventInit = {}): KeyboardEvent {
            const event = new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init });
            root.dispatchEvent(event);
            return event;
        },
        keyup: () => root.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowUp', bubbles: true })),
        run: (command: 'indent' | 'outdent') => editor.format(command),
    };
}

const textOf = (el: Element | null) => el!.firstChild as Text;
const caretNode = () => document.getSelection()?.anchorNode ?? null;
const names = (el: Element) => Array.from(el.children, (child) => child.nodeName);

describe('lists: Tab, indent and outdent', () => {
    it('Tab inside a list item indents it; Shift+Tab outdents it', async () => {
        const t = await open('<ul><li>one</li><li>two</li></ul>');
        placeCaret(textOf(t.$$('li')[1]!), 0);

        const tab = t.key('Tab');
        expect(tab.defaultPrevented).toBe(true);
        expect(t.$('li > ul > li')?.textContent).toContain('two');

        placeCaret(textOf(t.$('li > ul > li')), 0);
        t.key('Tab', { shiftKey: true });
        expect(t.$('li > ul')).toBeNull();
    });

    it('Tab keeps the caret where the author left it in a task row', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>first</span>') + row(false, '<span>second</span>') + '</ul>');
        placeCaret(textOf(t.spans()[1]!), 3);

        t.key('Tab');

        const nested = t.$('li > ul > li[data-task] > span')!;
        expect(nested.textContent).toBe('second');
        expect(nested.contains(caretNode())).toBe(true);
        expect(document.getSelection()?.anchorOffset).toBe(3);
    });

    it('Tab outside a list hands a tab character to the insert provider', async () => {
        const t = await open('<p>indent</p>');
        const inserted: string[] = [];
        const off = t.editor.provide('insert', { textAtCaret: (text: string) => inserted.push(text) } as never);
        placeCaret(textOf(t.$('p')), 6);

        const tab = t.key('Tab');

        expect(tab.defaultPrevented).toBe(true);
        expect(inserted).toEqual(['\t']);
        off();
    });

    it('Tab outside a list inserts a literal tab and keeps focus in the editor', async () => {
        const t = await open('<p>ab</p>');
        placeCaret(textOf(t.$('p')), 1);

        const tab = t.key('Tab');

        expect(tab.defaultPrevented).toBe(true);
        expect(t.$('p')!.textContent).toBe('a\tb');
    });

    it('indenting an ordered list item nests a new ol on Tab (Angular spec 9154)', async () => {
        const t = await open('<ol><li>a</li><li>b</li></ol>');
        placeCaret(textOf(t.$$('li')[1]!), 1);

        t.key('Tab');

        expect(t.$('li ol')).toBeTruthy();
    });

    it('outdenting a middle nested item leaves the items before it and carries the items after it (Angular spec 9162)', async () => {
        const t = await open('<ul><li>a<ul><li>b</li><li>c</li><li>d</li></ul></li></ul>');
        placeCaret(textOf(t.$$('ul ul li')[1]!), 1);

        t.key('Tab', { shiftKey: true });

        const outline = (list: Element): unknown[] =>
            Array.from(list.children).map((li) => {
                const own = Array.from(li.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE).map((node) => node.textContent).join('');
                const nested = li.querySelector(':scope > ul');
                return nested ? [own, outline(nested)] : own;
            });
        expect(outline(t.$('ul')!)).toEqual([['a', ['b']], ['c', ['d']]]);
    });

    it('Tab on an empty list item indents it and keeps the caret in it', async () => {
        const t = await open('<ul><li>one</li><li></li></ul>');
        placeCaret(t.$$('li')[1]!, 0);

        const tab = t.key('Tab');

        expect(tab.defaultPrevented).toBe(true);
        const nested = t.$('li > ul > li')!;
        expect(nested.textContent?.replaceAll('​', '')).toBe('');
        expect(nested.contains(caretNode())).toBe(true);
    });

    it('keeps the caret inside the item so a second indent still works', async () => {
        // Four items, so the twice-indented one still has a previous sibling to nest under.
        const t = await open('<ul><li>a</li><li>b</li><li>c</li><li>d</li></ul>');
        placeCaret(textOf(t.$$('li')[3]!), 1);

        t.run('indent');
        t.run('indent');

        expect(caretNode()?.parentElement?.closest('li')?.textContent).toContain('d');
        expect(t.root.innerHTML).not.toContain('\t');
    });

    it('keeps the caret inside the item when outdenting', async () => {
        const t = await open('<ul><li>first<ul><li>nested</li></ul></li></ul>');
        placeCaret(textOf(t.$('li > ul > li')), 3);

        t.run('outdent');

        expect(caretNode()?.parentElement?.closest('li')?.textContent).toContain('nested');
    });

    it('indents a list item under the previous sibling, then outdents it back', async () => {
        const t = await open('<ul><li>first</li><li>second</li></ul>');
        placeCaret(textOf(t.$$('li')[1]!), 0);

        t.run('indent');
        const nested = t.$('li > ul > li');
        expect(nested?.textContent).toContain('second');

        placeCaret(textOf(nested), 0);
        t.run('outdent');

        expect(t.$('li > ul')).toBeNull();
        expect(t.$$(':scope > ul > li')).toHaveLength(2);
    });

    it('does not indent the first list item (no previous sibling)', async () => {
        const t = await open('<ul><li>only</li></ul>');
        placeCaret(textOf(t.$('li')), 0);

        t.run('indent');

        expect(t.$('li > ul')).toBeNull();
    });

    it('steps a paragraph outside a list by its left margin, never below zero', async () => {
        const t = await open('<p>plain text</p>');
        t.editor.focus();
        placeCaret(textOf(t.$('p')), 2);
        const marginLeft = () => t.$('p')!.style.marginLeft;

        t.run('indent');
        expect(marginLeft()).toBe('2rem');
        t.run('indent');
        expect(marginLeft()).toBe('4rem');
        t.run('outdent');
        expect(marginLeft()).toBe('2rem');
        t.run('outdent');
        t.run('outdent');
        expect(marginLeft()).toBe('');
        expect(t.$('ul, ol')).toBeNull();
        expect(t.root.textContent).toBe('plain text');
    });

    it('caps the block margin at 12rem', async () => {
        const t = await open('<p style="margin-left: 12rem">x</p>');
        placeCaret(textOf(t.$('p')), 0);

        t.run('indent');

        expect(t.$('p')!.style.marginLeft).toBe('12rem');
    });

    it('moves the caret line, so the indent works inside a cell', async () => {
        const t = await open('<table><tbody><tr><td><p>text</p></td></tr></tbody></table>');
        placeCaret(textOf(t.$('p')), 2);

        t.run('indent');

        expect(t.$('p')!.style.marginLeft).not.toBe('');
    });

    it('does not indent a list item already at the maximum nesting depth', async () => {
        const t = await open(
            '<ul><li>a<ul><li>b<ul><li>c<ul><li>d<ul><li>e<ul><li>f0</li><li>f</li></ul></li></ul></li></ul></li></ul></li></ul></li></ul>',
        );
        const before = t.root.innerHTML;
        const deepest = t.$$('li').at(-1)!;
        placeCaret(textOf(deepest), 0);

        t.run('indent');

        expect(t.root.innerHTML).toBe(before);
        expect(deepest.previousElementSibling?.textContent).toBe('f0');
    });

    it('does not outdent a top-level list item (no grandparent list)', async () => {
        const t = await open('<ul><li>only</li></ul>');
        placeCaret(textOf(t.$('li')), 0);

        expect(() => t.run('outdent')).not.toThrow();
        expect(t.$('ul')).toBeTruthy();
    });

    it('indent and outdent are no-ops without an active selection', async () => {
        const t = await open('<ul><li>a</li><li>b</li></ul>');
        placeCaret(textOf(t.$$('li')[1]!), 0);
        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);

        try {
            expect(() => t.run('indent')).not.toThrow();
            expect(() => t.run('outdent')).not.toThrow();
        } finally {
            spy.mockRestore();
        }
    });

    it('indenting under a task-list previous sibling makes the new nested list a task list', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>first</span>') + row(false, '<span>second</span>') + '</ul>');
        placeCaret(textOf(t.$$('li')[1]!.querySelector('span')), 0);

        t.run('indent');

        expect(t.$('li > ul')?.hasAttribute('data-task-list')).toBe(true);
    });
});

describe('lists: nesting keeps each list to one kind and keeps the content in order', () => {
    it('outdenting the last item of a sub-list carries what its parent holds after the sub-list', async () => {
        const t = await open('<ul><li><p>a</p><ul><li>b</li><li>c</li></ul><h2>d</h2><ol><li>e</li></ol></li><li>f</li></ul>');
        placeCaret(textOf(t.$$('li li')[1]!), 1);

        t.run('outdent');

        const items = Array.from(t.$('ul')!.children);
        expect(t.root.textContent).toBe('abcdef');
        expect(items.map((item) => item.textContent)).toEqual(['ab', 'cde', 'f']);
        expect(names(items[1]!)).toEqual(['P', 'H2', 'OL']);
        expect(items[1]!.querySelector(':scope > p')!.contains(caretNode())).toBe(true);
    });

    it('outdenting a task row out of a plain item puts what followed its list in an item after the row', async () => {
        const t = await open('<ul><li><p>a</p><ul data-task-list>' + row(false, '<span>b</span>') + '</ul><p>c</p></li></ul>');
        placeCaret(textOf(t.$('li[data-task] > span')), 1);

        t.run('outdent');

        expect(t.root.textContent).toBe('abc');
        const items = t.$$(':scope > ul > li');
        expect(items.map((item) => item.textContent)).toEqual(['a', 'b', 'c']);
        expect(names(items[1]!)).toEqual(['INPUT', 'SPAN']);
        expect(items[2]!.matches('li:not([data-task])')).toBe(true);
        expect(names(items[2]!)).toEqual(['P']);
    });

    it.each([
        ['an empty numbered item', '<ol><li><br></li></ol>', ['OL']],
        ['a blank paragraph', '<p><br></p>', ['P', 'P']],
        ['an empty code block', '<pre><code></code></pre>', ['P', 'PRE']],
    ])('outdenting the last item of a sub-list carries %s after it', async (...[, trailing, children]) => {
        const t = await open(`<ul><li><p>G</p><ul><li>X</li></ul>${trailing}</li></ul>`);
        placeCaret(textOf(t.$('li li')), 1);

        t.run('outdent');

        const items = Array.from(t.$('ul')!.children);
        expect(names(items[0]!)).toEqual(['P']);
        expect(names(items[1]!)).toEqual(children);
    });

    it.each([
        ['a second paragraph', 'indent', '<ul><li>A</li><li><p>W</p><p>Xray</p></li></ul>', 'p'],
        ['a code block', 'indent', '<ul><li>A</li><li><p>W</p><pre><code>Xray</code></pre></li></ul>', 'code'],
        ['a table cell', 'indent', '<ul><li>A</li><li><p>W</p><table><tbody><tr><td>Xray</td></tr></tbody></table></li></ul>', 'td'],
        ['a second paragraph, outdenting', 'outdent', '<ul><li>A<ul><li><p>W</p><p>Xray</p></li></ul></li></ul>', 'p'],
    ] as const)('keeps the caret in a later line of the moved item: %s', async (...[, command, html, tag]) => {
        const t = await open(html);
        placeCaret(textOf(t.$$(tag).find((el) => el.textContent === 'Xray')!), 2);

        t.run(command);

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
        const t = await open(html);
        placeCaret(textOf(t.$$('p').find((p) => p.textContent === 'X')!), 1);

        t.run(command);

        const selection = document.getSelection()!;
        expect(selection.anchorNode?.textContent).toBe('X');
        expect(selection.anchorOffset).toBe(1);
    });

    it('outdenting an item that holds blocks gives the loose text it carries a paragraph', async () => {
        const t = await open('<ul><li><p>G</p><ul><li><p>X</p><pre><code>c</code></pre></li></ul>tail</li></ul>');
        placeCaret(textOf(t.$('li li p')), 1);

        t.run('outdent');

        const moved = t.$('ul')!.children[1]!;
        expect(names(moved)).toEqual(['P', 'PRE', 'P']);
        expect(moved.lastElementChild?.textContent).toBe('tail');
    });

    it.each([
        ['a list', '<ul><li>Z</li></ul>', 'XZ', null],
        ['a list, then a paragraph', '<ul><li>Z</li></ul><p>t</p>', 'XZ', 't'],
    ])('outdenting a task row keeps %s after its list under the row, with no empty item', async (...[, trailing, rowText, itemText]) => {
        const t = await open(`<ul><li><p>G</p><ul data-task-list>${row(false, '<span>X</span>')}</ul>${trailing}</li></ul>`);
        placeCaret(textOf(t.$('li[data-task] > span')), 1);

        t.run('outdent');

        const taskRow = t.$('li[data-task]')!;
        expect(taskRow.textContent).toBe(rowText);
        expect(taskRow.querySelector(':scope > ul > li')?.textContent).toBe('Z');
        expect(t.$$('li').filter((li) => li.firstElementChild?.matches('ul, ol'))).toHaveLength(0);
        expect(t.$$(':scope > ul > li').map((li) => li.textContent)).toEqual(['G', rowText, ...(itemText ? [itemText] : [])]);
    });

    it('Shift+Tab on a task row under a plain item keeps it a task row, in a task list of its own', async () => {
        const t = await open('<ul><li>plain<ul data-task-list>' + row(true, '<span>done</span>') + '</ul></li><li>next</li></ul>');
        placeCaret(textOf(t.$('li[data-task] > span')), 2);

        t.run('outdent');

        const tags = Array.from(t.root.children, (el) => `${el.tagName}:${el.textContent}`);
        expect(tags).toEqual(['UL:plain', 'UL:done', 'UL:next']);
        const taskRow = t.$('li[data-task]')!;
        expect(taskRow.parentElement?.dataset['taskList']).toBe('');
        expect(taskRow.dataset['checked']).toBe('true');
    });

    it('Tab puts a plain item under a row that holds a task sub-list into a plain list of its own', async () => {
        const t = await open('<ul><li>a<ul data-task-list>' + row(false, '<span>t</span>') + '</ul></li><li>b</li></ul>');
        placeCaret(textOf(t.$$(':scope > ul > li')[1]!), 1);

        t.run('indent');

        expect(t.$('li > ul:not([data-task-list]) > li')?.textContent).toBe('b');
        expect(t.$(MIXED_KINDS)).toBeNull();
    });

    it('Tab on two rows under a task row holding a plain sub-list keeps them in order, each in its kind', async () => {
        const t = await open(
            '<ul data-task-list="">' + row(false, '<span>a</span><ul><li>sub</li></ul>') + row(false, '<span>b</span>') + row(true, '<span>c</span>') + '</ul>',
        );
        placeCaret(textOf(t.spans()[1]!), 1);
        t.run('indent');
        placeCaret(textOf(t.spans()[2]!), 1);
        t.run('indent');

        const top = t.$$(':scope > ul > li');
        expect(top).toHaveLength(1);
        expect(Array.from(top[0]!.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['sub', 'b', 'c']);
        expect(t.$(MIXED_KINDS)).toBeNull();
        expect(t.$$('li[data-task]')[2]!.dataset['checked']).toBe('true');
    });

    it('Tab joins the sub-list that ends the previous item, past blank text after it', async () => {
        const t = await open('<ul><li>a<ul><li>sub</li></ul>\n</li><li>b</li></ul>');
        placeCaret(textOf(t.$$(':scope > ul > li')[1]!), 1);

        t.run('indent');

        const top = t.$(':scope > ul > li')!;
        expect(top.querySelectorAll(':scope > ul')).toHaveLength(1);
        expect(Array.from(top.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['sub', 'b']);
    });

    it('Tab on a numbered item under an item holding a numbered and a task sub-list puts it last', async () => {
        const t = await open('<ol><li>a<ol><li>n</li></ol><ul data-task-list>' + row(false, '<span>t</span>') + '</ul></li><li>b</li></ol>');
        placeCaret(textOf(t.$$(':scope > ol > li')[1]!), 1);

        t.run('indent');

        expect(Array.from(t.$(':scope > ol > li')!.querySelectorAll('li')).map((li) => li.textContent)).toEqual(['n', 't', 'b']);
        expect(t.$(':scope > ol > li > ol:last-of-type')?.getAttribute('start')).toBe('2');
    });

    it.each([
        ['holding a task sub-list', '<ul><li>P<ul><li>x<ul data-task-list>' + row(false, '<span>t</span>') + '</ul></li><li>y</li></ul></li></ul>', 'Pxty'],
        [
            'holding a plain and a task sub-list',
            '<ul><li>P<ul><li>x<ul><li>s</li></ul><ul data-task-list>' + row(false, '<span>t</span>') + '</ul></li><li>y</li></ul></li></ul>',
            'Pxsty',
        ],
    ])('Shift+Tab on an item %s carries the plain item after it in order, in a plain list', async (...[, html, text]) => {
        const t = await open(html);
        placeCaret(textOf(t.$('ul ul > li')), 1);

        t.run('outdent');

        expect(t.root.textContent).toBe(text);
        expect(t.$(MIXED_KINDS)).toBeNull();
    });

    it('Shift+Tab carrying a numbered item past a task sub-list keeps its number counting', async () => {
        const t = await open('<ol><li>P<ol><li>x<ol><li>s</li></ol><ul data-task-list>' + row(false, '<span>t</span>') + '</ul></li><li>y</li></ol></li></ol>');
        placeCaret(textOf(t.$('ol ol > li')), 1);

        t.run('outdent');

        expect(t.root.textContent).toBe('Pxsty');
        const carried = t.$$('ol').find((ol) => ol.textContent === 'y');
        expect(carried?.getAttribute('start')).toBe('2');
    });
});

describe('lists: task rows and the caret', () => {
    it('moves a caret that landed before a task checkbox into the row text on selection change', async () => {
        const t = await open(TWO_TASKS);
        placeCaret(t.$$('li[data-task]')[1]!, 0);

        t.keyup();

        expect(t.spans()[1]!.contains(caretNode())).toBe(true);
        expect(document.getSelection()?.anchorOffset).toBe(0);
    });

    it('moves a caret between the checkbox and the text into the text before a key is handled', async () => {
        const t = await open(TWO_TASKS);
        placeCaret(t.$$('li[data-task]')[0]!, 1);

        t.key('a');

        expect(t.spans()[0]!.contains(caretNode())).toBe(true);
    });

    it('puts a caret left beside an empty row checkbox before the row seed, not after it', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>&nbsp;</span>') + '</ul>');
        placeCaret(t.$('li[data-task]')!, 0);

        t.key('Shift');

        const selection = document.getSelection()!;
        expect(selection.anchorNode).toBe(t.$('li[data-task] > span')!.firstChild);
        expect(selection.anchorOffset).toBe(0);
    });

    it('puts a caret left after a row at the end of its text, not after its first word', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>hello <b>world</b></span>') + '</ul>');
        const li = t.$('li[data-task]')!;
        placeCaret(li, li.childNodes.length);

        t.key('Shift');

        const selection = document.getSelection()!;
        expect(selection.anchorNode?.textContent).toBe('world');
        expect(selection.anchorOffset).toBe('world'.length);
    });

    it('moves a caret after the text span to the end of the text', async () => {
        const t = await open(TWO_TASKS);
        const li = t.$$('li[data-task]')[0]!;
        placeCaret(li, li.childNodes.length);

        t.keyup();

        expect(t.spans()[0]!.contains(caretNode())).toBe(true);
        expect(document.getSelection()?.anchorOffset).toBe('first'.length);
    });

    it('moves a caret after an empty or image-only text span into the span', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span></span>') + row(false, `<span>${IMG}</span>`) + '</ul>');
        const [emptyRow, imageRow] = t.$$('li[data-task]');

        placeCaret(emptyRow!, emptyRow!.childNodes.length);
        t.keyup();
        expect(emptyRow!.querySelector(':scope > span')!.contains(caretNode())).toBe(true);

        placeCaret(imageRow!, imageRow!.childNodes.length);
        t.keyup();
        const imageSpan = imageRow!.querySelector(':scope > span')!;
        expect(caretNode()).toBe(imageSpan);
        expect(document.getSelection()?.anchorOffset).toBe(imageSpan.childNodes.length);
    });

    it('leaves a caret in a list nested under a task row alone', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>parent</span><ul><li>child</li></ul>') + '</ul>');
        const child = textOf(t.$('li li'));
        placeCaret(child, 2);

        t.keyup();

        expect(caretNode()).toBe(child);
        expect(document.getSelection()?.anchorOffset).toBe(2);
    });

    it('text the browser leaves beside a row span is gathered back into it', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>​</span>') + '</ul>');
        const taskRow = t.$('li[data-task]')!;
        taskRow.append('typed');
        placeCaret(taskRow.lastChild!, 5);

        t.keyup();

        expect(taskRow.querySelector(':scope > span')?.textContent).toContain('typed');
        expect(Array.from(taskRow.childNodes, (n) => n.nodeName)).toEqual(['INPUT', 'SPAN']);
        t.key('Enter');
        expect(t.$$('li[data-task]')).toHaveLength(2);
    });
});

describe('lists: Backspace and Delete across rows', () => {
    it('Backspace at the start of a task row joins its text onto the row above instead of dropping it', async () => {
        const t = await open(TWO_TASKS);
        placeCaret(textOf(t.spans()[1]!), 0);

        const event = t.key('Backspace');

        expect(event.defaultPrevented).toBe(true);
        expect(t.$$('li[data-task]')).toHaveLength(1);
        expect(t.spans()[0]!.textContent).toBe('firstsecond');
        expect(t.$('[style]')).toBeNull();
        const selection = document.getSelection()!;
        expect(selection.anchorNode).toBe(t.spans()[0]);
        expect(selection.anchorOffset).toBe(1);
    });

    it('Backspace at the start of the first task row makes it a paragraph and keeps the rows after it', async () => {
        const t = await open(TWO_TASKS);
        placeCaret(textOf(t.spans()[0]!), 0);

        t.key('Backspace');

        expect(Array.from(t.root.children, (el) => el.tagName)).toEqual(['P', 'UL']);
        expect(t.$('p')?.textContent).toBe('first');
        expect(t.$('p input')).toBeNull();
        expect(t.spans().map((s) => s.textContent)).toEqual(['second']);
        expect(t.$('p')!.contains(caretNode())).toBe(true);
    });

    it('Backspace in the only, empty task row leaves an empty paragraph', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>​</span>') + '</ul>');
        placeCaret(textOf(t.$('li[data-task] > span')), 1);

        t.key('Backspace');

        expect(t.$('ul')).toBeNull();
        expect(t.$('p')?.innerHTML).toBe('<br>');
        expect(t.root.textContent).toBe('');
    });

    it('Backspace at the start of an empty task row under another empty one leaves one row that holds a caret', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span> </span>') + row(false, '<span> </span>') + '</ul>');
        placeCaret(textOf(t.spans()[1]!), 0);

        t.key('Backspace');

        expect(t.$$('li[data-task]')).toHaveLength(1);
        expect(t.spans()[0]!.textContent).toBe(' ');
        expect(t.spans()[0]!.contains(caretNode())).toBe(true);
    });

    it('Backspace after an image at the start of a task row deletes the image, not the row', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>first</span>') + row(false, `<span>${IMG}text</span>`) + '</ul>');
        placeCaret(t.spans()[1]!.lastChild!, 0);

        const event = t.key('Backspace');

        expect(event.defaultPrevented).toBe(false);
        expect(t.$$('li[data-task]')).toHaveLength(2);
    });

    it('Backspace after a line break in a task row is left to the browser', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>first</span>') + row(false, '<span><br>two</span>') + '</ul>');
        placeCaret(t.spans()[1]!.lastChild!, 0);

        const event = t.key('Backspace');

        expect(event.defaultPrevented).toBe(false);
        expect(t.$$('li[data-task]')).toHaveLength(2);
    });

    it('Backspace joins the line visually above, the deepest item of a sublist included', async () => {
        const t = await open('<ul><li>plain<ul><li>sub</li></ul></li></ul><ul data-task-list="">' + row(false, '<span>task</span>') + '</ul>');
        placeCaret(textOf(t.$('li[data-task] > span')), 0);

        t.key('Backspace');

        const items = t.$$('li');
        expect(items).toHaveLength(2);
        expect(items[0]!.firstChild?.textContent).toBe('plain');
        expect(items[1]!.textContent).toBe('subtask');
        expect(t.$('li[data-task]')).toBeNull();
    });

    it('Backspace at the start of the first row of a nested list joins the row it is nested under', async () => {
        const t = await open(
            '<ul data-task-list="">' + row(false, '<span>parent</span><ul data-task-list="">' + row(false, '<span>child</span>') + row(false, '<span>sibling</span>') + '</ul>') + '</ul>',
        );
        placeCaret(textOf(t.spans()[1]!), 0);

        t.key('Backspace');

        expect(t.$('li p')).toBeNull();
        expect(t.spans().map((s) => s.textContent)).toEqual(['parentchild', 'sibling']);
    });

    it('Backspace joining a task row keeps the plain items of its sub-list in a plain list', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>a</span>') + row(false, '<span>b</span><ul><li>plain</li></ul>') + '</ul>');
        placeCaret(textOf(t.spans()[1]!), 0);

        t.key('Backspace');

        expect(t.root.textContent).toContain('ab');
        expect(t.root.textContent).toContain('plain');
        expect(t.$(MIXED_KINDS)).toBeNull();
    });

    it('Backspace never puts text directly inside a list', async () => {
        const t = await open('<ul data-task-list=""><li>plain</li><ul><li>sub</li></ul>' + row(false, '<span>task</span>') + '</ul>');
        placeCaret(textOf(t.$('li[data-task] > span')), 0);

        t.key('Backspace');

        for (const list of t.$$('ul, ol')) {
            const stray = Array.from(list.childNodes).filter((n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? '').trim() !== '');
            expect(stray).toHaveLength(0);
        }
        expect(t.root.textContent).toContain('subtask');
    });

    it.each(['<table><tbody><tr><td>cell</td></tr></tbody></table>', '<pre><code>x</code></pre>'])(
        'Backspace never joins a list item into the cell or the code block above it: %s',
        async (before) => {
            const t = await open(before + '<ul><li>item</li></ul>');
            placeCaret(textOf(t.$('li')), 0);

            const event = t.key('Backspace');

            expect(event.defaultPrevented).toBe(false);
            expect(t.$('li')?.textContent).toBe('item');
            expect(t.$('td, pre')).not.toBeNull();
        },
    );

    it.each(['<table><tbody><tr><td>cell</td></tr></tbody></table>', '<pre><code>x</code></pre>'])(
        'Delete never pulls a cell or a code block into the list item above it: %s',
        async (after) => {
            const t = await open('<ul><li>item</li></ul>' + after);
            placeCaret(textOf(t.$('li')), 4);

            const event = t.key('Delete');

            expect(event.defaultPrevented).toBe(false);
            expect(t.$('li')?.textContent).toBe('item');
            expect(t.$('td, pre')).not.toBeNull();
            expect(t.$('li code')).toBeNull();
        },
    );

    it('a join keeps an image on the line it joins onto', async () => {
        const t = await open('<ul data-task-list="">' + row(false, `<span>${IMG}</span>`) + row(false, '<span>text</span>') + '</ul>');
        placeCaret(textOf(t.spans()[1]!), 0);

        t.key('Backspace');

        expect(t.$$('img')).toHaveLength(1);
        expect(t.$('li[data-task] > span')?.textContent).toBe('text');
    });

    it('a join onto a plain paragraph keeps its image too', async () => {
        const t = await open(`<p>${IMG}</p><ul><li>text</li></ul>`);
        placeCaret(textOf(t.$('li')), 0);

        t.key('Backspace');

        expect(t.$$('img')).toHaveLength(1);
        expect(t.$('p')?.textContent).toBe('text');
    });

    it('a checkbox inside the line text is not dropped by a join', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>first</span>') + row(false, '<span>mid<input type="checkbox">end</span>') + '</ul>');
        placeCaret(textOf(t.spans()[1]!), 0);

        t.key('Backspace');

        const joined = t.$('li[data-task] > span')!;
        expect(joined.textContent).toBe('firstmidend');
        expect(joined.querySelectorAll('input')).toHaveLength(1);
    });

    it('Delete at the end of a task row pulls the next row text onto it', async () => {
        const t = await open(TWO_TASKS);
        placeCaret(textOf(t.spans()[0]!), 'first'.length);

        const event = t.key('Delete');

        expect(event.defaultPrevented).toBe(true);
        expect(t.$$('li[data-task]')).toHaveLength(1);
        expect(t.$$('input')).toHaveLength(1);
        expect(t.spans()[0]!.textContent).toBe('firstsecond');
        expect(document.getSelection()?.anchorOffset).toBe('first'.length);
    });

    it('Delete before the end of a task row is left to the browser', async () => {
        const t = await open(TWO_TASKS);
        placeCaret(textOf(t.spans()[0]!), 2);

        const event = t.key('Delete');

        expect(event.defaultPrevented).toBe(false);
        expect(t.$$('li[data-task]')).toHaveLength(2);
    });

    it('Delete at the end of a row pulls up its own nested row, not the row after the list', async () => {
        const t = await open(
            '<ul data-task-list="">' + row(false, '<span>parent</span><ul data-task-list="">' + row(false, '<span>child</span>') + '</ul>') + row(false, '<span>after</span>') + '</ul>',
        );
        placeCaret(textOf(t.spans()[0]!), 'parent'.length);

        t.key('Delete');

        expect(t.spans().map((s) => s.textContent)).toEqual(['parentchild', 'after']);
        expect(t.$('li[data-task] ul')).toBeNull();
    });

    it('Delete at the end of a row pulls up a plain nested item, not the row after the list', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>parent</span><ul><li>plain</li></ul>') + row(false, '<span>after</span>') + '</ul>');
        placeCaret(textOf(t.spans()[0]!), 'parent'.length);

        t.key('Delete');

        expect(t.spans()[0]!.textContent).toBe('parentplain');
        expect(t.spans()[1]?.textContent).toBe('after');
        expect(t.$('li[data-task] ul')).toBeNull();
    });

    it('Delete never reaches past the item below it to a later task row', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>parent</span><ul data-task-list=""><li>plain</li>' + row(false, '<span>second</span>') + '</ul>') + '</ul>');
        placeCaret(textOf(t.spans()[0]!), 'parent'.length);

        t.key('Delete');

        expect(t.spans()[0]!.textContent).toBe('parentplain');
        expect(t.root.textContent).toContain('second');
    });

    it("Delete pulls up only the line below it, leaving that line's own sublist a list", async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>parent</span><ul><li>plain<ul><li>deep</li></ul></li></ul>') + '</ul>');
        placeCaret(textOf(t.spans()[0]!), 'parent'.length);

        t.key('Delete');

        const span = t.spans()[0]!;
        expect(span.textContent).toBe('parentplain');
        expect(span.querySelector('ul, li')).toBeNull();
        expect(t.$('li[data-task] > ul > li')?.textContent).toBe('deep');
    });

    it('Delete on the last row of a nested list pulls up the row after that list', async () => {
        const t = await open(
            '<ul data-task-list="">' + row(false, '<span>parent</span><ul data-task-list="">' + row(false, '<span>child</span>') + '</ul>') + row(false, '<span>after</span>') + '</ul>',
        );
        placeCaret(textOf(t.spans()[1]!), 'child'.length);

        const event = t.key('Delete');

        expect(event.defaultPrevented).toBe(true);
        expect(t.spans().map((s) => s.textContent)).toEqual(['parent', 'childafter']);
    });
});

describe('lists: Enter', () => {
    const pressEnterIn = async (html: string, target: (t: Awaited<ReturnType<typeof open>>) => [Node, number]) => {
        const t = await open(html);
        placeCaret(...target(t));
        return { t, event: t.key('Enter') };
    };

    it('keeps the image in a last list item', async () => {
        const { t } = await pressEnterIn('<ul><li>a</li><li><img src="/x.png" alt="pic"></li></ul>', (x) => [x.$$('li')[1]!, 1]);

        expect(t.$('img')).not.toBeNull();
        expect(t.$$('li')).toHaveLength(2);
    });

    it('in an empty trailing task item exits while keeping earlier items (Angular spec 8963-8974)', async () => {
        const html = '<ul data-task-list="">' + row(false, '<span>done</span>') + row(false, '<span></span>') + '</ul>';
        const { t } = await pressEnterIn(html, (x) => [x.spans()[1]!, 0]);

        expect(t.$('ul')).toBeTruthy();
        expect(t.$$('li[data-task]')).toHaveLength(1);
        expect(t.$('p')).toBeTruthy();
    });

    it('exits an empty top-level item into a <p>, not a <div>', async () => {
        const { t, event } = await pressEnterIn('<ul><li>one</li><li></li></ul>', (x) => [x.$$('li')[1]!, 0]);

        expect(event.defaultPrevented).toBe(true);
        expect(t.$('p')).toBeTruthy();
        expect(t.$('div')).toBeNull();
        expect(t.$$('li')).toHaveLength(1);
    });

    it('removes the list entirely when its only item was the empty one', async () => {
        const { t } = await pressEnterIn('<ul><li></li></ul>', (x) => [x.$('li')!, 0]);

        expect(t.$('ul')).toBeNull();
        expect(t.$('p')).toBeTruthy();
    });

    it('leaves an item with text alone', async () => {
        const { t, event } = await pressEnterIn('<ul><li>text</li></ul>', (x) => [textOf(x.$('li')), 2]);

        expect(event.defaultPrevented).toBe(false);
        expect(t.$('ul')).toBeTruthy();
    });

    it('leaves a nested item to the outdent path', async () => {
        const { event } = await pressEnterIn('<ul><li>a<ul><li></li></ul></li></ul>', (x) => [x.$$('li')[1]!, 0]);

        expect(event.defaultPrevented).toBe(false);
    });

    it('in a task row holding only an image keeps the row and the image', async () => {
        const { t } = await pressEnterIn('<ul data-task-list="">' + row(false, `<span>${IMG}</span>`) + '</ul>', (x) => [x.$('li[data-task] > span')!, 1]);

        expect(t.$('img')).not.toBeNull();
        expect(t.$$('li[data-task]')).toHaveLength(2);
    });

    it('builds the next row exactly as every other row is built', async () => {
        const { t, event } = await pressEnterIn('<ul data-task-list="">' + row(false, '<span>todo</span>') + '</ul>', (x) => [textOf(x.$('li[data-task] > span')), 4]);

        expect(event.defaultPrevented).toBe(true);
        const rows = t.$$('li[data-task]');
        expect(rows).toHaveLength(2);
        const added = rows[1]!;
        expect(added.dataset['checked']).toBe('false');
        expect(added.querySelector<HTMLInputElement>(':scope > input')?.checked).toBe(false);
        expect(added.querySelector(':scope > span')).not.toBeNull();

        placeCaret(textOf(added.querySelector(':scope > span')), 1);
        t.key('Enter');
        expect(t.$$('li[data-task]')).toHaveLength(1);
    });

    it('adds another row after text typed into a row Enter created', async () => {
        const { t } = await pressEnterIn('<ul data-task-list="">' + row(false, '<span>first</span>') + '</ul>', (x) => [textOf(x.$('li[data-task] > span')), 5]);

        const added = t.$$('li[data-task]')[1]!;
        const anchor = document.getSelection()?.anchorNode;
        expect(added.querySelector(':scope > span')?.contains(anchor ?? null)).toBe(true);
        expect(anchor?.nodeType).toBe(Node.TEXT_NODE);

        const target = anchor as Text;
        target.data += 'second';
        placeCaret(target, target.data.length);
        t.key('Enter');

        expect(t.$$('li[data-task]')).toHaveLength(3);
        expect(t.$('p')).toBeNull();
    });

    it.each(['​', ' ', ' '])('exits an empty task row however it was seeded: %j', async (seed) => {
        const { t } = await pressEnterIn('<ul data-task-list="">' + row(false, `<span>${seed}</span>`) + '</ul>', (x) => [textOf(x.$('li[data-task] > span')), 1]);

        expect(t.$('li[data-task]')).toBeNull();
        expect(t.$('p')).not.toBeNull();
    });

    it('on an empty nested task row steps it out one level instead of leaving the list', async () => {
        const { t } = await pressEnterIn(
            '<ul data-task-list="">' + row(false, '<span>parent</span><ul data-task-list="">' + row(false, '<span>&nbsp;</span>') + '</ul>') + '</ul>',
            (x) => [textOf(x.$('li[data-task] li[data-task] > span')), 0],
        );

        expect(t.$$(':scope > ul > li[data-task]')).toHaveLength(2);
        expect(t.$('li[data-task] li[data-task], li p')).toBeNull();
        expect(t.$('li[data-task] > span')?.textContent).toBe('parent');
        const selection = document.getSelection()!;
        const moved = t.$$(':scope > ul > li[data-task]')[1]!.querySelector(':scope > span')!;
        expect(selection.anchorNode).toBe(moved.firstChild);
        expect(selection.anchorOffset).toBe(0);
    });

    it('on an empty nested task row with an empty span still puts the caret in the row', async () => {
        const { t } = await pressEnterIn(
            '<ul data-task-list="">' + row(false, '<span>parent</span><ul data-task-list="">' + row(false, '<span></span>') + '</ul>') + '</ul>',
            (x) => [x.spans()[1]!, 0],
        );

        const rows = t.$$(':scope > ul > li[data-task]');
        expect(rows).toHaveLength(2);
        expect(rows[1]!.querySelector(':scope > span')!.contains(caretNode())).toBe(true);
    });

    it('on an empty task row under a plain item steps it out into a task list of its own', async () => {
        const { t } = await pressEnterIn(
            '<ul><li>plain<ul data-task-list>' + row(false, '<span>&nbsp;</span>') + '</ul></li></ul>',
            (x) => [textOf(x.$('li[data-task] > span')), 0],
        );

        expect(t.$(':scope > ul[data-task-list] > li[data-task]')).not.toBeNull();
        expect(t.$(MIXED_KINDS)).toBeNull();
    });
});

describe('lists: task checkboxes', () => {
    const NESTED =
        '<ul data-task-list="">' +
        row(false, '<span>parent</span><ul data-task-list="">' + row(false, '<span>child a</span><ul data-task-list="">' + row(false, '<span>grandchild</span>') + '</ul>') + row(true, '<span>child b</span>') + '</ul>') +
        '</ul>';

    const states = (t: Awaited<ReturnType<typeof open>>) =>
        t.$$('li[data-task]').map((li) => `${li.querySelector('span')?.textContent}:${li.dataset['checked']}:${li.querySelector<HTMLInputElement>(':scope > input')?.checked}`);
    /** Clicks a row's box, then waits for the write-back that follows the browser reverting the prevented click. */
    const clickBox = async (t: Awaited<ReturnType<typeof open>>, text: string) => {
        t.$$('li[data-task]').find((li) => li.querySelector(':scope > span')?.textContent === text)!.querySelector<HTMLInputElement>(':scope > input')!.click();
        await new Promise((resolve) => setTimeout(resolve, 10));
    };

    it('toggling a task row leaves the rows nested under it and above it alone', async () => {
        const t = await open(NESTED);

        await clickBox(t, 'parent');
        expect(states(t)).toEqual(['parent:true:true', 'child a:false:false', 'grandchild:false:false', 'child b:true:true']);

        await clickBox(t, 'child b');
        expect(states(t)).toEqual(['parent:true:true', 'child a:false:false', 'grandchild:false:false', 'child b:false:false']);
    });

    it('syncs the model on a toggle', async () => {
        const t = await open(TWO_TASKS);
        const changes: string[] = [];
        t.editor.addEventListener('value-change', (event) => changes.push((event as CustomEvent<{ html: string }>).detail.html));

        await clickBox(t, 'second');

        expect(changes.at(-1)).toContain('data-checked="true"');
    });

    it('clicking a checkbox with no task row around it is a no-op', async () => {
        const t = await open('<p><input type="checkbox"></p>');
        const box = t.$('input[type="checkbox"]') as HTMLInputElement;

        expect(() => box.click()).not.toThrow();
        expect(t.$('li[data-task]')).toBeNull();
    });

    it('checking a task checkbox with no text span skips caret placement without throwing', async () => {
        const t = await open('<ul data-task-list=""><li data-task="" data-checked="false"><input type="checkbox"></li></ul>');

        expect(() => t.$('input[type="checkbox"]')!.click()).not.toThrow();
        expect(t.$('li[data-task]')?.getAttribute('data-checked')).toBe('true');
    });

    it('checking a task checkbox skips caret placement when there is no active selection', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>do it</span>') + '</ul>');
        const box = t.$('input[type="checkbox"]') as HTMLInputElement;
        const spy = vi.spyOn(Document.prototype, 'getSelection').mockImplementation(() => null);

        try {
            expect(() => box.click()).not.toThrow();
        } finally {
            spy.mockRestore();
        }
        expect(t.$('li[data-task]')?.getAttribute('data-checked')).toBe('true');
    });

    it('re-enables checkboxes after the content is replaced, mirroring each row state', async () => {
        const t = await open(TWO_TASKS);
        t.root.querySelectorAll('input').forEach((box) => box.setAttribute('disabled', ''));

        await t.load('<ul data-task-list="">' + row(true, '<span>x</span>') + '</ul>');

        const box = t.$('li[data-task] > input') as HTMLInputElement;
        expect(box.disabled).toBe(false);
        expect(box.checked).toBe(true);
    });

    it('stops handling clicks and keys once detached', async () => {
        const t = await open(TWO_TASKS);
        t.editor.remove();

        await clickBox(t, 'second');

        expect(t.$$('li[data-task]')[1]!.dataset['checked']).toBe('false');
        expect(t.key('Tab').defaultPrevented).toBe(false);
    });

    it('strikes only a checked row\'s own text, not the rows nested under it', async () => {
        const t = await open(NESTED);
        const line = (el: Element) => getComputedStyle(el).textDecorationLine;
        const rowOf = (text: string) => t.$$('li[data-task]').find((li) => li.querySelector(':scope > span')?.textContent === text)!;

        expect(line(rowOf('child b').querySelector(':scope > span')!)).toBe('line-through');
        expect(line(rowOf('child b'))).toBe('none');
        expect(line(rowOf('child a').querySelector(':scope > span')!)).toBe('none');
        expect(line(rowOf('parent'))).toBe('none');
    });
});

describe('lists: vertical arrows over task rows', () => {
    const arrow = (t: Awaited<ReturnType<typeof open>>, name: 'ArrowUp' | 'ArrowDown') => t.key(name);

    it('ArrowUp from the start of a task row reaches the row above in one press', async () => {
        const t = await open(TWO_TASKS);
        t.editor.focus();
        placeCaret(textOf(t.spans()[1]!), 0);

        const event = arrow(t, 'ArrowUp');

        expect(event.defaultPrevented).toBe(true);
        expect(t.spans()[0]!.contains(caretNode())).toBe(true);
    });

    it('ArrowDown from a task row lands in the text of the row below', async () => {
        const t = await open(TWO_TASKS);
        t.editor.focus();
        placeCaret(textOf(t.spans()[0]!), 0);

        arrow(t, 'ArrowDown');

        expect(t.spans()[1]!.contains(caretNode())).toBe(true);
    });

    it('ArrowUp from the first task row leaves the list for the block above', async () => {
        const t = await open('<p>above</p><ul data-task-list="">' + row(false, '<span>only</span>') + '</ul>');
        t.editor.focus();
        placeCaret(textOf(t.spans()[0]!), 0);

        arrow(t, 'ArrowUp');

        expect(t.$('p')!.contains(caretNode())).toBe(true);
    });

    it('leaves a modified arrow press to the browser', async () => {
        const t = await open(TWO_TASKS);
        placeCaret(textOf(t.spans()[1]!), 0);

        expect(t.key('ArrowUp', { shiftKey: true }).defaultPrevented).toBe(false);
    });

    it('ArrowDown inside a wrapped task row moves one visual line, not two', async () => {
        const t = await open('<ul data-task-list="">' + row(false, '<span>alpha bravo charlie delta echo foxtrot golf hotel india juliet</span>') + '</ul>');
        t.root.style.width = '150px';
        t.editor.focus();
        const text = textOf(t.$('li[data-task] > span'));
        const topAt = (offset: number) => {
            const probe = new Range();
            probe.setStart(text, offset);
            probe.setEnd(text, Math.min(offset + 1, text.data.length));
            return Math.round(probe.getBoundingClientRect().top);
        };
        const lines = [...new Set(Array.from({ length: text.data.length }, (...[, i]) => topAt(i)))].sort((a, b) => a - b);
        expect(lines.length).toBeGreaterThan(2);
        placeCaret(text, 0);

        arrow(t, 'ArrowDown');

        const selection = document.getSelection()!;
        expect(selection.anchorNode).toBe(text);
        expect(topAt(selection.anchorOffset)).toBe(lines[1]);
    });
});
