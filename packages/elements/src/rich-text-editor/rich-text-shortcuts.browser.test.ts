import { afterEach, describe, expect, it } from 'vitest';
import { shortcutBindings } from '../shared/shortcut-bindings.js';
import { blockEditor, editableOf, selectContents } from './rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from './rich-text-editor.js';

async function editorWith(html: string): Promise<{ editor: GeRichTextEditor; root: HTMLDivElement }> {
    const editor = await blockEditor(html);
    return { editor, root: editableOf(editor) };
}

const press = (root: HTMLElement, key: string, init: KeyboardEventInit = {}): KeyboardEvent => {
    const event = new KeyboardEvent('keydown', { key, ctrlKey: true, bubbles: true, cancelable: true, ...init });
    root.dispatchEvent(event);
    return event;
};

const selectAll = (root: HTMLElement) => selectContents(root.querySelector('p')!);

describe('keyboard shortcuts execute formatting (Angular spec 7123-7190)', () => {
    it.each([
        ['b', 'b, strong'],
        ['i', 'i, em'],
        ['u', 'u'],
    ])('Ctrl+%s formats the selection', async (key, selector) => {
        const { root } = await editorWith('<p>format me</p>');
        selectAll(root);

        const event = press(root, key);

        expect(root.querySelector(selector)).toBeTruthy();
        expect(event.defaultPrevented).toBe(true);
    });

    it('Ctrl+K delegates to the registered link editor', async () => {
        const { editor, root } = await editorWith('<p>link me</p>');
        selectAll(root);
        let opened = false;
        editor.registerLinkEditor(() => { opened = true; });

        press(root, 'k');

        expect(opened).toBe(true);
    });

    it('Ctrl+Z undoes and Ctrl+Shift+Z redoes through the history provider', async () => {
        const { editor, root } = await editorWith('<p>one</p>');
        root.innerHTML = '<p>two</p>';
        root.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: 'x' }));
        editor.flushPendingHistoryPush();

        press(root, 'z');
        expect(root.textContent).toBe('one');

        press(root, 'z', { shiftKey: true });
        expect(root.textContent).toBe('two');
    });

    it('does nothing while the editor is read-only or disabled', async () => {
        const { editor, root } = await editorWith('<p>locked</p>');
        selectAll(root);
        editor.readonly = true;
        await editor.updateComplete;

        const event = press(root, 'b');

        expect(root.querySelector('b, strong')).toBeNull();
        expect(event.defaultPrevented).toBe(false);
    });

    it('runs a registered shortcut action on Ctrl+Shift+H and tears it down', async () => {
        const { editor, root } = await editorWith('<p>x</p>');
        let runs = 0;
        const off = editor.registerShortcutAction('rich-text.history', () => { runs++; });

        const event = press(root, 'h', { shiftKey: true });
        expect(runs).toBe(1);
        expect(event.defaultPrevented).toBe(true);

        off();
        press(root, 'h', { shiftKey: true });
        expect(runs).toBe(1);
    });

    it('leaves the key alone when the registered action is not available', async () => {
        const { editor, root } = await editorWith('<p>x</p>');
        let runs = 0;
        editor.registerShortcutAction('rich-text.history', () => { runs++; }, () => false);

        const event = press(root, 'h', { shiftKey: true });

        expect(runs).toBe(0);
        expect(event.defaultPrevented).toBe(false);
    });

    it('registers find without needing an editable editor', async () => {
        const { editor, root } = await editorWith('<p>x</p>');
        editor.readonly = true;
        await editor.updateComplete;
        let runs = 0;
        editor.registerShortcutAction('rich-text.find', () => { runs++; });

        press(root, 'f');

        expect(runs).toBe(1);
    });

    it('opens the find panel on Mod+F and the replace row on Mod+H', async () => {
        const { editor, root } = await editorWith('<p>x</p>');
        const find = editor.provider('find')!;

        expect(press(root, 'f').defaultPrevented).toBe(true);
        expect(find.isOpen()).toBe(true);
        expect(find.showsReplaceRow).toBe(false);

        find.close();
        press(root, 'h');
        expect(find.isOpen()).toBe(true);
        expect(find.showsReplaceRow).toBe(true);
    });

    it('keeps one editor from handling another editor\'s keys and unregisters on detach', async () => {
        const first = await editorWith('<p>a</p>');
        const second = await editorWith('<p>b</p>');
        const ids = () => shortcutBindings.getShortcutBindingViews().filter((view) => view.actionId === 'rich-text.bold').map((view) => view.componentId);
        expect(new Set(ids()).size).toBe(2);

        second.editor.remove();
        expect(ids()).toHaveLength(1);
        selectAll(second.root);
        press(second.root, 'b');
        expect(second.root.querySelector('b, strong')).toBeNull();

        selectAll(first.root);
        press(first.root, 'b');
        expect(first.root.querySelector('b, strong')).toBeTruthy();
    });
});
