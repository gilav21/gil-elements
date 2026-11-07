import { describe, expect, it, vi } from 'vitest';
import { editableOf, editorIn, placeCaret, record, selectBetween, selectContents } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';
import type { GeRichTextToolbar } from './toolbar-index.js';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function toolbarEditor(attrs = '', content = ''): Promise<GeRichTextEditor> {
    const editor = await editorIn(`<ge-rich-text-editor mode="html" ${attrs}></ge-rich-text-editor>`);
    if (content) {
        editor.value = content;
        await editor.updateComplete;
    }
    return editor;
}

const topBar = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('.toolbar ge-rich-text-toolbar');
const bubble = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<HTMLElement>('[data-slot="rich-text-floating-toolbar"]');
const bubbleBar = (editor: GeRichTextEditor) => bubble(editor)!.querySelector<GeRichTextToolbar>('ge-rich-text-toolbar')!;
const item = (bar: GeRichTextToolbar, id: string) => bar.shadowRoot!.querySelector<HTMLButtonElement>(`[data-toolbar-item="${id}"]`)!;
const slot = (bar: GeRichTextToolbar, id: string) => bar.shadowRoot!.querySelector<HTMLButtonElement>(`[data-addon-slot="${id}"]`)!;
const textStyle = (bar: GeRichTextToolbar) => bar.shadowRoot!.querySelector<HTMLSelectElement>('[data-slot="rich-text-toolbar-text-style"]')!;

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    const bar = topBar(editor) ?? (bubble(editor) ? bubbleBar(editor) : null);
    await bar?.updateComplete;
}

async function pick(editor: GeRichTextEditor, value: string): Promise<void> {
    const select = textStyle(topBar(editor)!);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle(editor);
}

/** Selects `from`-`to` of the first text node and reports the move the way a mouse release does. */
async function selectText(editor: GeRichTextEditor, from: number, to: number): Promise<Text> {
    const text = editableOf(editor).querySelector('p')!.firstChild as Text;
    selectBetween(text, from, text, to);
    editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
    await settle(editor);
    return text;
}

describe('top toolbar', () => {
    it('renders the default items above the editor, bound to the editor state', async () => {
        const editor = await toolbarEditor();
        const bar = topBar(editor)!;

        expect(bar.items).toContain('textStyle');
        expect(item(bar, 'bold')).toBeTruthy();
        expect(bar.locale).toBe(editor.resolvedLocale);
        expect(bar.slots).toBe(editor.toolbarSlots);
        expect(bar.textStyleAvailable).toBe(true);
    });

    it('renders nothing for floating, none or readonly', async () => {
        for (const attrs of ['toolbar="floating"', 'toolbar="none"', 'readonly']) {
            const editor = await toolbarEditor(attrs);

            expect(topBar(editor), attrs).toBeNull();
            expect(bubble(editor), attrs).toBeNull();
        }
    });

    it('lists the items given by toolbarItems and drops unknown ids', async () => {
        const editor = await toolbarEditor();
        editor.toolbarItems = ['bold', 'nope', 'separator', 'italic'];
        await settle(editor);

        expect(topBar(editor)!.items).toEqual(['bold', 'separator', 'italic']);
    });

    it('follows disabled and readonly', async () => {
        const editor = await toolbarEditor();
        editor.disabled = true;
        await settle(editor);
        expect(topBar(editor)!.disabled).toBe(true);

        editor.disabled = false;
        editor.readonly = true;
        await editor.updateComplete;
        expect(topBar(editor)).toBeNull();
    });

    it('formats the selection when a format button is pressed, as one history entry', async () => {
        const editor = await toolbarEditor('', '<p>Hello</p>');
        selectContents(editableOf(editor).querySelector('p')!);
        editor.saveSelection();
        const before = editor.historyEntries().length;

        item(topBar(editor)!, 'bold').click();

        expect(editableOf(editor).querySelector('b, strong')?.textContent).toBe('Hello');
        expect(editor.historyEntries().length - before).toBe(1);
    });

    it('presses the button for the format at the caret', async () => {
        const editor = await toolbarEditor('', '<p><b>bold</b> plain</p>');
        placeCaret(editableOf(editor).querySelector('b')!.firstChild!, 2);
        editableOf(editor).dispatchEvent(new Event('keyup'));
        await settle(editor);

        expect(item(topBar(editor)!, 'bold').getAttribute('aria-pressed')).toBe('true');
        expect(item(topBar(editor)!, 'italic').getAttribute('aria-pressed')).toBe('false');
    });

    it('converts the saved block when a style is chosen after the editor blurs, as one history entry', async () => {
        const editor = await toolbarEditor('', '<p>hello</p>');
        const root = editableOf(editor);
        root.focus();
        placeCaret(root.querySelector('p')!.firstChild!, 5);
        root.blur();
        const before = editor.historyEntries().length;

        await pick(editor, 'heading2');

        expect(root.querySelector('h2')?.textContent).toContain('hello');
        expect(editor.historyEntries().length).toBe(before + 1);
    });

    it('shows the caret block in the select and converts back to normal text', async () => {
        const editor = await toolbarEditor('', '<h1>title</h1>');
        const root = editableOf(editor);
        root.focus();
        placeCaret(root.querySelector('h1')!.firstChild!, 2);
        root.dispatchEvent(new Event('keyup'));
        await settle(editor);
        expect(textStyle(topBar(editor)!).value).toBe('heading1');

        await pick(editor, 'paragraph');

        expect(root.querySelector('h1')).toBeNull();
        expect(root.textContent).toContain('title');
    });

    it('disables the select where the caret line cannot change style', async () => {
        const editor = await toolbarEditor('', '<table><tbody><tr><td>cell</td></tr></tbody></table>');
        placeCaret(editableOf(editor).querySelector('td')!.firstChild!, 1);
        editableOf(editor).dispatchEvent(new Event('keyup'));
        await settle(editor);

        expect(topBar(editor)!.textStyleAvailable).toBe(false);
        expect(textStyle(topBar(editor)!).disabled).toBe(true);
    });

    it('undoes and redoes through the history', async () => {
        const editor = await toolbarEditor('', '<p>Hello</p>');
        selectContents(editableOf(editor).querySelector('p')!);
        editor.saveSelection();
        editor.format('bold');
        editor.toolbarItems = ['undo', 'redo'];
        await settle(editor);

        item(topBar(editor)!, 'undo').click();
        expect(editableOf(editor).querySelector('b, strong')).toBeNull();

        item(topBar(editor)!, 'redo').click();
        expect(editableOf(editor).querySelector('b, strong')).not.toBeNull();
    });

    it('toggles the find panel', async () => {
        const editor = await toolbarEditor();
        editor.toolbarItems = ['find'];
        await settle(editor);
        const toggle = vi.spyOn(editor.provider('find')!, 'toggle');

        item(topBar(editor)!, 'find').click();

        expect(toggle).toHaveBeenCalledOnce();
        expect(editor.provider('find')!.isOpen()).toBe(true);
    });
});

describe('custom toolbar items in the toolbar', () => {
    it('renders custom items after the built-ins and reports their clicks', async () => {
        const clicks: string[] = [];
        const editor = await toolbarEditor();
        const actions = record<{ id: string }>(editor, 'custom-toolbar-action');
        editor.customToolbarItems = [{ id: 'stamp', icon: 'S', tooltip: 'Stamp', onClick: (ref) => clicks.push(ref.getHtmlContent()) }];
        await settle(editor);

        slot(topBar(editor)!, 'stamp').click();

        expect(clicks).toEqual(['']);
        expect(actions.map((action) => action.id)).toEqual(['stamp']);
    });

    it('presses a custom item from the formats at the caret', async () => {
        const editor = await toolbarEditor('', '<p><b>bold</b> plain</p>');
        editor.customToolbarItems = [{ id: 'is-bold', icon: 'B', tooltip: 'Is bold', isActive: (formats) => formats.has('bold') }];
        await settle(editor);
        const root = editableOf(editor);

        placeCaret(root.querySelector('b')!.firstChild!, 1);
        root.dispatchEvent(new Event('keyup'));
        await settle(editor);
        expect(slot(topBar(editor)!, 'is-bold').getAttribute('aria-pressed')).toBe('true');

        placeCaret(root.querySelector('p')!.lastChild!, 2);
        root.dispatchEvent(new Event('keyup'));
        await settle(editor);
        expect(slot(topBar(editor)!, 'is-bold').getAttribute('aria-pressed')).toBe('false');
    });

    it('re-reads a slot whose state changed outside the editor when the editor reports a state change', async () => {
        const editor = await toolbarEditor();
        let on = false;
        editor.toolbarSlots.register({ id: 'ext', icon: 'E', tooltip: 'Ext', isActive: () => on });
        await settle(editor);
        expect(slot(topBar(editor)!, 'ext').getAttribute('aria-pressed')).toBe('false');

        on = true;
        editor.invalidate();
        await settle(editor);
        await topBar(editor)!.updateComplete;

        expect(slot(topBar(editor)!, 'ext').getAttribute('aria-pressed')).toBe('true');
    });

    it('disables custom items while the editor is disabled', async () => {
        const editor = await toolbarEditor();
        editor.customToolbarItems = [{ id: 'x', icon: 'X', tooltip: 'X' }];
        editor.disabled = true;
        await settle(editor);

        expect(slot(topBar(editor)!, 'x').disabled).toBe(true);
    });
});

describe('floating toolbar', () => {
    it('shows beside a selection and not before', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        expect(bubble(editor)).toBeNull();

        await selectText(editor, 0, 5);

        const box = bubble(editor)!;
        expect(box).not.toBeNull();
        expect(parseFloat(box.style.left)).toBeGreaterThanOrEqual(8);
        expect(parseFloat(box.style.top)).toBeGreaterThanOrEqual(8);
        const bar = bubbleBar(editor);
        expect(bar.compact).toBe(true);
        expect([...bar.shadowRoot!.querySelectorAll('button')].map((b) => b.dataset['toolbarItem'])).toEqual(['bold', 'italic', 'underline', 'clear']);
    });

    it('keeps the bar inside the viewport', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        editableOf(editor).style.paddingLeft = '5000px';
        await selectText(editor, 0, 5);

        const left = parseFloat(bubble(editor)!.style.left);
        expect(left).toBeLessThanOrEqual(window.innerWidth - 220 - 8);
        expect(left).toBeGreaterThanOrEqual(8);
    });

    it('does not show for toolbar="top" or a readonly editor', async () => {
        const top = await toolbarEditor('', '<p>Hello world</p>');
        await selectText(top, 0, 5);
        expect(bubble(top)).toBeNull();

        const readonly = await toolbarEditor('toolbar="floating" readonly', '<p>Hello world</p>');
        await selectText(readonly, 0, 5);
        expect(bubble(readonly)).toBeNull();
    });

    it('hides shortly after the selection collapses', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        const text = await selectText(editor, 0, 5);
        placeCaret(text, 2);
        editableOf(editor).dispatchEvent(new Event('keyup'));
        await editor.updateComplete;
        expect(bubble(editor)).not.toBeNull();

        await wait(150);
        await editor.updateComplete;

        expect(bubble(editor)).toBeNull();
    });

    it('stays when a collapsed reading is only momentary', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        const text = await selectText(editor, 0, 5);
        placeCaret(text, 2);
        editableOf(editor).dispatchEvent(new Event('mouseup'));
        selectBetween(text, 0, text, 5);

        await wait(150);
        await editor.updateComplete;

        expect(bubble(editor)).not.toBeNull();
    });

    it('hides on Escape without consuming the key', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        await selectText(editor, 0, 5);
        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

        editableOf(editor).dispatchEvent(event);
        await editor.updateComplete;

        expect(bubble(editor)).toBeNull();
        expect(event.defaultPrevented).toBe(false);
    });

    it('hides after the editor loses focus to somewhere outside, but not to the editor itself', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        await selectText(editor, 0, 5);
        const root = editableOf(editor);
        root.dispatchEvent(new FocusEvent('blur', { relatedTarget: editor }));
        await wait(250);
        expect(bubble(editor)).not.toBeNull();

        root.focus();
        root.blur();
        await wait(250);
        await editor.updateComplete;

        expect(bubble(editor)).toBeNull();
    });

    it('hides when the page scrolls', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        await selectText(editor, 0, 5);
        await wait(20);

        window.dispatchEvent(new Event('scroll'));
        await editor.updateComplete;

        expect(bubble(editor)).toBeNull();
    });

    it('wraps the selection in the tag and parks the caret in a zero-width text after it, as one history entry', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        await selectText(editor, 0, 5);
        const before = editor.historyEntries().length;

        item(bubbleBar(editor), 'bold').click();
        await editor.updateComplete;

        const root = editableOf(editor);
        expect(root.querySelector('b')?.textContent).toBe('Hello');
        const selection = document.getSelection()!;
        expect(selection.isCollapsed).toBe(true);
        expect(selection.anchorNode).toBe(root.querySelector('b')!.nextSibling);
        expect(selection.anchorNode?.textContent).toHaveLength(1);
        expect(selection.anchorOffset).toBe(1);
        expect(editor.htmlOutput).toBe('<p><b>Hello</b> world</p>');
        expect(editor.historyEntries().length - before).toBe(1);
        expect(bubble(editor)).toBeNull();
        expect(document.activeElement).toBe(root);
    });

    it.each([
        ['italic', 'i'],
        ['underline', 'u'],
    ])('wraps the selection for %s', async (command, tag) => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        await selectText(editor, 6, 11);

        item(bubbleBar(editor), command).click();

        expect(editableOf(editor).querySelector(tag)?.textContent).toBe('world');
    });

    it('runs the clear command and hides', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello <b>bold</b></p>');
        const root = editableOf(editor);
        root.dispatchEvent(new Event('focus'));
        selectContents(root.querySelector('b')!);
        root.dispatchEvent(new Event('mouseup'));
        await settle(editor);

        item(bubbleBar(editor), 'clear').click();
        await editor.updateComplete;

        expect(root.querySelector('b')).toBeNull();
        expect(root.textContent).toBe('Hello bold');
        expect(bubble(editor)).toBeNull();
    });

    it('does nothing while the editor is disabled', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        await selectText(editor, 0, 5);
        editor.disabled = true;
        await settle(editor);

        item(bubbleBar(editor), 'bold').click();

        expect(editableOf(editor).querySelector('b')).toBeNull();
    });

    it('offers the custom toolbar items', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        editor.customToolbarItems = [{ id: 'stamp', icon: 'S', tooltip: 'Stamp' }];
        await editor.updateComplete;
        await selectText(editor, 0, 5);

        expect(slot(bubbleBar(editor), 'stamp')).toBeTruthy();
    });

    it('collapses the selection and hides after a format run through the editor', async () => {
        const editor = await toolbarEditor('toolbar="floating"', '<p>Hello world</p>');
        await selectText(editor, 0, 5);

        editor.format('bold');
        await editor.updateComplete;

        expect(document.getSelection()!.isCollapsed).toBe(true);
        expect(bubble(editor)).toBeNull();
    });

    it('leaves the selection alone after a format run through the editor when the toolbar is on top', async () => {
        const editor = await toolbarEditor('', '<p>Hello world</p>');
        await selectText(editor, 0, 5);

        editor.format('bold');

        expect(document.getSelection()!.isCollapsed).toBe(false);
    });
});
