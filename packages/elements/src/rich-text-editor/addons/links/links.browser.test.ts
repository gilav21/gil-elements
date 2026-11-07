import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GeButton } from '../../../button/button.js';
import type { GeInput } from '../../../input/input.js';
import { editableOf, editorIn, placeCaret, record, selectBetween, selectContents } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import type { GeRichTextToolbar } from '../../toolbar-index.js';
import '../../locales/he.js';
import './define.js';
import { RICH_TEXT_LINKS_LOCALES, type RichTextLinkSubmit } from './index.js';

afterEach(() => {
    vi.restoreAllMocks();
    document.getSelection()?.removeAllRanges();
});

const EN = RICH_TEXT_LINKS_LOCALES.en;
const SLOT = '[data-addon-slot="links.insert"]';

async function linkEditor(content = '', attrs = ''): Promise<GeRichTextEditor> {
    const editor = await editorIn(`<ge-rich-text-editor mode="html" addons="links" ${attrs}></ge-rich-text-editor>`);
    if (content) await load(editor, content);
    return editor;
}

async function load(editor: GeRichTextEditor, html: string): Promise<void> {
    editor.value = html;
    await editor.updateComplete;
}

const toolbarOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('ge-rich-text-toolbar')!;
const buttonOf = (editor: GeRichTextEditor) => toolbarOf(editor).shadowRoot!.querySelector<HTMLButtonElement>(SLOT);
const formOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<HTMLElement>('[data-slot="rich-text-links-form"]');
const fieldOf = (editor: GeRichTextEditor, type: 'text' | 'url') => formOf(editor)!.querySelector<GeInput>(`ge-input[type="${type}"]`)!;
const buttonsOf = (editor: GeRichTextEditor) => [...formOf(editor)!.querySelectorAll<GeButton>('ge-button')];
const errorOf = (editor: GeRichTextEditor) => formOf(editor)?.querySelector('[role="alert"]')?.textContent?.trim() ?? '';

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await toolbarOf(editor)?.updateComplete;
    await Promise.all([...(formOf(editor)?.querySelectorAll<GeInput>('ge-input') ?? [])].map((input) => input.updateComplete));
}

async function openFromToolbar(editor: GeRichTextEditor): Promise<void> {
    buttonOf(editor)!.click();
    await settle(editor);
}

async function fill(editor: GeRichTextEditor, text: string, url: string): Promise<void> {
    for (const [type, value] of [['text', text], ['url', url]] as const) {
        const field = fieldOf(editor, type);
        field.value = value;
        field.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await settle(editor);
}

const confirm = async (editor: GeRichTextEditor) => {
    buttonsOf(editor).at(-1)!.click();
    await settle(editor);
};

const select = (node: Node) => selectContents(node);
/** Without coordinates it is a plain event, as a caret move reports; with them, a pointer release. */
const mouseup = (editor: GeRichTextEditor, point?: { clientX: number; clientY: number }) =>
    editableOf(editor).dispatchEvent(point ? new MouseEvent('mouseup', { bubbles: true, ...point }) : new Event('mouseup', { bubbles: true }));

/** jsdom-style fixed line box: the real layout of a one-word link is not what these tests are about. */
function giveLineBox(anchor: HTMLElement) {
    const box = { x: 12, y: 12, width: 80, height: 16, top: 12, left: 12, right: 92, bottom: 28, toJSON: () => ({}) } as DOMRect;
    Object.defineProperty(anchor, 'getClientRects', { value: () => [box], configurable: true });
    return box;
}

describe('links addon: toolbar and lifecycle', () => {
    it('removes the toolbar slot live when switched off, and restores it', async () => {
        const editor = await linkEditor();
        expect(buttonOf(editor)).not.toBeNull();

        editor.addonOptions = { links: false };
        await settle(editor);
        expect(buttonOf(editor)).toBeNull();

        editor.addonOptions = {};
        await settle(editor);
        expect(buttonOf(editor)).not.toBeNull();
    });

    it('renders the trigger with the localized tooltip', async () => {
        const editor = await linkEditor();
        expect(buttonOf(editor)!.getAttribute('title')).toBe(EN.tooltip);
        expect(buttonOf(editor)!.getAttribute('aria-label')).toBe(EN.tooltip);
    });

    it('localizes the button tooltip (he)', async () => {
        const editor = await linkEditor('', 'locale="he"');
        expect(buttonOf(editor)!.title).toBe(RICH_TEXT_LINKS_LOCALES.he!.tooltip);
    });

    it('takes a locale from the addon options', async () => {
        const editor = await linkEditor();
        editor.addonOptions = { links: { locale: 'de' } };
        await settle(editor);
        expect(buttonOf(editor)!.title).toBe(RICH_TEXT_LINKS_LOCALES.de!.tooltip);
    });

    it('disables the toolbar button while the editor is disabled', async () => {
        const editor = await linkEditor('', 'disabled');
        expect(buttonOf(editor)!.disabled).toBe(true);
    });

    it('registers the slot at the configured order and omits it with toolbar:false, keeping the command', async () => {
        const editor = await linkEditor();
        editor.addonOptions = { links: { toolbar: false, order: 5 } };
        await settle(editor);
        expect(buttonOf(editor)).toBeNull();
        expect(editor.commands.listCommands().some((command) => command.id === 'insert.link')).toBe(true);

        editor.addonOptions = { links: { order: 5 } };
        await settle(editor);
        expect(editor.toolbarSlots.slots.find((slot) => slot.id === 'links.insert')!.order).toBe(5);
    });

    it('removes its slot when the editor is removed', async () => {
        const editor = await linkEditor();
        expect(editor.toolbarSlots.slots).toHaveLength(1);
        editor.remove();
        expect(editor.toolbarSlots.slots).toHaveLength(0);
    });

    it('keeps the form open on a rejected URL and closes it on an accepted one', async () => {
        const editor = await linkEditor('<p>x</p>');
        select(editableOf(editor).firstElementChild!);
        await openFromToolbar(editor);
        await fill(editor, 'x', 'javascript:alert(1)');
        await confirm(editor);
        expect(formOf(editor)).not.toBeNull();

        await fill(editor, 'x', 'https://x.test');
        await confirm(editor);
        expect(formOf(editor)).toBeNull();
    });

    it('opens, seeds the form via the button and tracks open state', async () => {
        const editor = await linkEditor('<p>seed</p>');
        select(editableOf(editor).firstElementChild!);
        expect(formOf(editor)).toBeNull();
        await openFromToolbar(editor);
        expect(formOf(editor)).not.toBeNull();
        expect(fieldOf(editor, 'text').value).toBe('seed');
    });

    it('closes from the cancel button', async () => {
        const editor = await linkEditor('<p>seed</p>');
        select(editableOf(editor).firstElementChild!);
        await openFromToolbar(editor);
        buttonsOf(editor).at(-2)!.click();
        await editor.updateComplete;
        expect(formOf(editor)).toBeNull();
    });
});

describe('links addon: inserting', () => {
    it('inserts a sanitized anchor from the toolbar button and emits link-insert', async () => {
        const editor = await linkEditor('<p>see here</p>');
        const inserted = record<RichTextLinkSubmit>(editor, 'link-insert');
        select(editableOf(editor).firstElementChild!);
        await openFromToolbar(editor);
        await fill(editor, 'docs', 'https://example.com/docs');
        await confirm(editor);

        const link = editableOf(editor).querySelector('a');
        expect(link?.getAttribute('href')).toBe('https://example.com/docs');
        expect(link?.textContent).toBe('docs');
        expect(link?.getAttribute('rel')).toContain('noopener');
        expect(inserted).toEqual([{ text: 'docs', url: 'https://example.com/docs' }]);
    });

    it('falls back to the url as link text when the text is blank', async () => {
        const editor = await linkEditor('<p>x</p>');
        select(editableOf(editor).firstElementChild!);
        await openFromToolbar(editor);
        await fill(editor, '', 'https://only-url.com');
        await confirm(editor);
        expect(editableOf(editor).querySelector('a')?.textContent).toBe('https://only-url.com');
    });

    it('rejects a javascript: url, inserts nothing and says so', async () => {
        const editor = await linkEditor('<p>safe</p>');
        const inserted = record(editor, 'link-insert');
        select(editableOf(editor).firstElementChild!);
        await openFromToolbar(editor);
        await fill(editor, 'evil', 'javascript:alert(1)');
        await confirm(editor);

        expect(editableOf(editor).querySelector('a')).toBeNull();
        expect(inserted).toEqual([]);
        expect(errorOf(editor)).toBe(EN.invalidUrl);
        expect(fieldOf(editor, 'url').getAttribute('aria-describedby')).toBe(formOf(editor)!.querySelector('[role="alert"]')!.id);
    });

    it('does nothing for a blank url', async () => {
        const editor = await linkEditor('<p>x</p>');
        const inserted = record(editor, 'link-insert');
        select(editableOf(editor).firstElementChild!);
        await openFromToolbar(editor);
        await fill(editor, 'label', '   ');
        await confirm(editor);
        expect(inserted).toEqual([]);
        expect(formOf(editor)).not.toBeNull();
    });

    it('confirms with Enter from the url field', async () => {
        const editor = await linkEditor('<p>x</p>');
        select(editableOf(editor).firstElementChild!);
        await openFromToolbar(editor);
        await fill(editor, '', 'https://enter.test');
        fieldOf(editor, 'url').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
        await editor.updateComplete;
        expect(editableOf(editor).querySelector('a')?.getAttribute('href')).toBe('https://enter.test');
    });

    it('trims the text and url it submits', async () => {
        const editor = await linkEditor('<p>x</p>');
        const inserted = record<RichTextLinkSubmit>(editor, 'link-insert');
        select(editableOf(editor).firstElementChild!);
        await openFromToolbar(editor);
        await fill(editor, '  Docs  ', '  https://example.com/docs  ');
        await confirm(editor);
        expect(inserted).toEqual([{ text: 'Docs', url: 'https://example.com/docs' }]);
    });

    it('keeps the link on the part of it the selection did not cover', async () => {
        const editor = await linkEditor('<p><a href="https://old.example/">docs here</a> now</p>');
        const editable = editableOf(editor);
        selectBetween(editable.querySelector('a')!.firstChild!, 'docs '.length, editable.querySelector('p')!.lastChild!, 4);
        await openFromToolbar(editor);
        await fill(editor, 'here now', 'https://new.example/');
        await confirm(editor);

        expect(editable.querySelector('a[href="https://old.example/"]')?.textContent).toBe('docs ');
        expect(editable.querySelector('a[href="https://new.example/"]')?.textContent).toBe('here now');
        expect(editable.textContent).toBe('docs here now');
    });

    it('replaces a selection whose boundary is an element, not a text node', async () => {
        const editor = await linkEditor('<p><a href="https://a.example/">one</a> mid <a href="https://b.example/">two</a></p>');
        const editable = editableOf(editor);
        const [first, second] = editable.querySelectorAll('a');
        selectBetween(first!, 0, second!.firstChild!, 2);
        await openFromToolbar(editor);
        await fill(editor, 'ALL', 'https://new.example/');
        await confirm(editor);

        expect(editable.textContent).toBe('ALLo');
        expect(editable.querySelector('a[href="https://new.example/"]')?.textContent).toBe('ALL');
    });

    it('treats a selection running past a link as new link text, not an edit of that link', async () => {
        const editor = await linkEditor('<p>see <a href="https://old.example/">docs</a> now</p>');
        const editable = editableOf(editor);
        selectBetween(editable.querySelector('a')!.firstChild!, 0, editable.querySelector('p')!.lastChild!, 4);
        await openFromToolbar(editor);

        expect(buttonsOf(editor)).toHaveLength(2);
        expect(fieldOf(editor, 'text').value).toBe('docs now');

        await fill(editor, 'docs now', 'https://new.example/');
        await confirm(editor);
        expect(editable.textContent).toBe('see docs now');
        expect(editable.querySelectorAll('a')).toHaveLength(1);
    });
});

describe('links addon: editing', () => {
    it('edits the link under the caret from the toolbar button instead of nesting a second one', async () => {
        const editor = await linkEditor('<p>see <a href="https://old.example/">the docs</a> now</p>');
        const editable = editableOf(editor);
        placeCaret(editable.querySelector('a')!.firstChild!, 2);
        await openFromToolbar(editor);

        expect(fieldOf(editor, 'text').value).toBe('the docs');
        expect(fieldOf(editor, 'url').value).toBe('https://old.example/');
        expect(buttonsOf(editor)).toHaveLength(3);
        expect(buttonsOf(editor).at(-1)!.textContent?.trim()).toBe(EN.update);

        await fill(editor, 'new docs', 'https://new.example/');
        await confirm(editor);
        expect(editable.querySelectorAll('a')).toHaveLength(1);
        expect(editable.querySelector('a')!.getAttribute('href')).toBe('https://new.example/');
        expect(editable.textContent).toBe('see new docs now');
    });

    it('removes the link under the caret from the form, keeping its text', async () => {
        const editor = await linkEditor('<p>see <a href="https://old.example/">the docs</a> now</p>');
        const removed = record<{ url: string }>(editor, 'link-remove');
        const editable = editableOf(editor);
        placeCaret(editable.querySelector('a')!.firstChild!, 2);
        await openFromToolbar(editor);
        buttonsOf(editor)[0]!.click();
        await editor.updateComplete;

        expect(editable.querySelector('a')).toBeNull();
        expect(editable.textContent).toBe('see the docs now');
        expect(removed).toEqual([{ url: 'https://old.example/' }]);
        expect(formOf(editor)).toBeNull();
    });

    it("seeds the toolbar form from the click-to-edit form's link and closes that form", async () => {
        const editor = await linkEditor('<p><a href="https://old.test">old</a></p>');
        const editable = editableOf(editor);
        placeCaret(editable.querySelector('a')!.firstChild!, 1);
        mouseup(editor);
        await settle(editor);
        expect(formOf(editor)).not.toBeNull();

        // The field takes focus, so the editor saves its caret; the toolbar press then closes the form as an outside click.
        editor.saveSelection();
        document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await editor.updateComplete;
        expect(formOf(editor)).toBeNull();
        document.getSelection()?.removeAllRanges();

        await openFromToolbar(editor);
        expect(buttonsOf(editor)).toHaveLength(3);
        expect(fieldOf(editor, 'text').value).toBe('old');
        expect(fieldOf(editor, 'url').value).toBe('https://old.test');

        await fill(editor, 'new', 'https://new.test/');
        await confirm(editor);
        expect(editable.querySelectorAll('a')).toHaveLength(1);
        expect(editable.querySelector('a')!.getAttribute('href')).toBe('https://new.test/');
        expect(editable.textContent).toBe('new');
    });

    it('opens a form with remove when the caret enters an existing link', async () => {
        const editor = await linkEditor('<p><a href="https://old.test">old</a></p>');
        placeCaret(editableOf(editor).querySelector('a')!.firstChild!, 1);
        mouseup(editor);
        await settle(editor);

        expect(buttonsOf(editor)).toHaveLength(3);
        expect(fieldOf(editor, 'url').value).toBe('https://old.test');
    });

    it('updates an existing link through the form', async () => {
        const editor = await linkEditor('<p><a href="https://old.test">old</a></p>');
        const inserted = record<RichTextLinkSubmit>(editor, 'link-insert');
        placeCaret(editableOf(editor).querySelector('a')!.firstChild!, 1);
        mouseup(editor);
        await settle(editor);
        await fill(editor, 'new', 'https://new.test');
        await confirm(editor);

        const updated = editableOf(editor).querySelector('a')!;
        expect(updated.getAttribute('href')).toBe('https://new.test');
        expect(updated.textContent).toBe('new');
        expect(inserted).toEqual([{ text: 'new', url: 'https://new.test' }]);
    });

    it('removes an existing link and emits link-remove', async () => {
        const editor = await linkEditor('<p><a href="https://gone.test">gone</a></p>');
        const removed = record<{ url: string }>(editor, 'link-remove');
        placeCaret(editableOf(editor).querySelector('a')!.firstChild!, 1);
        mouseup(editor);
        await settle(editor);
        buttonsOf(editor)[0]!.click();
        await editor.updateComplete;

        expect(editableOf(editor).querySelector('a')).toBeNull();
        expect(editableOf(editor).textContent).toContain('gone');
        expect(removed).toEqual([{ url: 'https://gone.test' }]);
    });

    it('rejects an unsafe url when updating and keeps the form open with an error', async () => {
        const editor = await linkEditor('<p><a href="https://old.test">old</a></p>');
        placeCaret(editableOf(editor).querySelector('a')!.firstChild!, 1);
        mouseup(editor);
        await settle(editor);
        await fill(editor, 'x', 'javascript:alert(1)');
        await confirm(editor);

        expect(editableOf(editor).querySelector('a')?.getAttribute('href')).toBe('https://old.test');
        expect(formOf(editor)).not.toBeNull();
        expect(errorOf(editor)).toBe(EN.invalidUrl);
    });

    it('closes the form when the caret leaves the link', async () => {
        const editor = await linkEditor('<p><a href="https://old.test">old</a>tail</p>');
        const editable = editableOf(editor);
        placeCaret(editable.querySelector('a')!.firstChild!, 1);
        mouseup(editor);
        await settle(editor);
        expect(formOf(editor)).not.toBeNull();

        placeCaret(editable.querySelector('p')!.lastChild!, 2);
        mouseup(editor);
        await editor.updateComplete;
        expect(formOf(editor)).toBeNull();
    });

    it('does not open for a click in the blank space below the link', async () => {
        const editor = await linkEditor('<p><a href="https://old.test">old link</a> text</p>');
        const anchor = editableOf(editor).querySelector('a')!;
        placeCaret(anchor.firstChild!, 1);
        const box = giveLineBox(anchor);
        mouseup(editor, { clientX: box.left + box.width / 2, clientY: box.bottom + 40 });
        await settle(editor);
        expect(formOf(editor)).toBeNull();
    });

    it("opens for a click within a few pixels of the link's box", async () => {
        const editor = await linkEditor('<p><a href="https://old.test">old link</a> text</p>');
        const anchor = editableOf(editor).querySelector('a')!;
        placeCaret(anchor.firstChild!, 1);
        const box = giveLineBox(anchor);
        mouseup(editor, { clientX: box.left + box.width / 2, clientY: box.bottom + 2 });
        await settle(editor);
        expect(formOf(editor)).not.toBeNull();
    });

    it('closes an open form when the next click misses the link', async () => {
        const editor = await linkEditor('<p><a href="https://old.test">old link</a> text</p>');
        const anchor = editableOf(editor).querySelector('a')!;
        placeCaret(anchor.firstChild!, 1);
        const box = giveLineBox(anchor);
        mouseup(editor, { clientX: box.left + 2, clientY: box.top + box.height / 2 });
        await settle(editor);
        expect(formOf(editor)).not.toBeNull();

        mouseup(editor, { clientX: box.left + 2, clientY: box.bottom + 40 });
        await editor.updateComplete;
        expect(formOf(editor)).toBeNull();
    });

    it('dismisses on an outside pointer but keeps the form for inside pointers', async () => {
        const editor = await linkEditor('<p><a href="https://old.test">old</a></p>');
        placeCaret(editableOf(editor).querySelector('a')!.firstChild!, 1);
        mouseup(editor);
        await settle(editor);

        fieldOf(editor, 'text').dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
        await editor.updateComplete;
        expect(formOf(editor)).not.toBeNull();

        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await editor.updateComplete;
        expect(formOf(editor)).toBeNull();
    });
});

describe('links addon: the Ctrl+K and slash entry points', () => {
    it('closes the form on Escape', async () => {
        const editor = await linkEditor('<p>link me</p>');
        select(editableOf(editor).firstElementChild!);
        editor.showLinkDialog();
        await settle(editor);
        expect(formOf(editor)).not.toBeNull();

        formOf(editor)!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
        await editor.updateComplete;
        expect(formOf(editor)).toBeNull();
    });

    it('closes the form on page scroll but not on scrolling inside it', async () => {
        const editor = await linkEditor('<p>link me</p>');
        select(editableOf(editor).firstElementChild!);
        editor.showLinkDialog();
        await settle(editor);

        formOf(editor)!.dispatchEvent(new Event('scroll', { bubbles: false }));
        await editor.updateComplete;
        expect(formOf(editor)).not.toBeNull();

        window.dispatchEvent(new Event('scroll'));
        await editor.updateComplete;
        expect(formOf(editor)).toBeNull();
    });

    it('does not open while the editor is readonly', async () => {
        const editor = await linkEditor('<p>locked</p>');
        editor.readonly = true;
        await editor.updateComplete;
        select(editableOf(editor).firstElementChild!);
        editor.showLinkDialog();
        await editor.updateComplete;
        expect(formOf(editor)).toBeNull();
    });

    it('opens when the insert.link slash command runs', async () => {
        const editor = await linkEditor('<p>run me</p>');
        select(editableOf(editor).firstElementChild!);
        const command = editor.commands.listCommands().find((c) => c.id === 'insert.link')!;
        expect(command.label).toBe(EN.commandLabel);

        await command.run({
            query: '', selectedText: '',
            executeToolbarCommand: () => undefined,
            insertText: () => undefined,
            insertHtml: () => undefined,
            showLinkDialog: () => editor.showLinkDialog(),
            focusEditor: () => undefined,
        });
        await settle(editor);
        expect(formOf(editor)).not.toBeNull();
    });

    it('opens from the Mod+K shortcut', async () => {
        const editor = await linkEditor('<p>keys</p>');
        select(editableOf(editor).firstElementChild!);
        editableOf(editor).dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true, cancelable: true }));
        await settle(editor);
        expect(formOf(editor)).not.toBeNull();
    });

    it('positions the form from the caret hint when there is no selection rect', async () => {
        const editor = await linkEditor('<p>hi</p>');
        document.getSelection()?.removeAllRanges();
        editor.showLinkDialog({ x: 40, y: 60 });
        await settle(editor);

        const form = formOf(editor)!;
        expect(form.style.left).toBe('40px');
        expect(form.style.top).toBe('68px');
        expect(form.matches(':popover-open')).toBe(true);
    });

    it('uses the right-to-left direction for a right-to-left locale', async () => {
        const editor = await linkEditor('<p>hi</p>');
        editor.addonOptions = { links: { locale: 'he' } };
        await settle(editor);
        select(editableOf(editor).firstElementChild!);
        editor.showLinkDialog();
        await settle(editor);
        expect(formOf(editor)!.getAttribute('dir')).toBe('rtl');
        expect(formOf(editor)!.querySelector('.links-heading')!.textContent).toBe(RICH_TEXT_LINKS_LOCALES.he!.tooltip);
    });

    it('focuses the url field when it opens', async () => {
        const editor = await linkEditor('<p>hi</p>');
        select(editableOf(editor).firstElementChild!);
        editor.showLinkDialog();
        await settle(editor);
        await vi.waitFor(() => expect(fieldOf(editor, 'url').matches(':focus-within')).toBe(true));
    });

    it('shows only the insert and cancel actions when inserting', async () => {
        const editor = await linkEditor('<p>hi</p>');
        select(editableOf(editor).firstElementChild!);
        editor.showLinkDialog();
        await settle(editor);
        expect(buttonsOf(editor).map((button) => button.textContent?.trim())).toEqual([EN.cancel, EN.insert]);
    });
});

describe('links addon: floating toolbar', () => {
    async function floatingEditor() {
        const editor = await linkEditor('<p>Hello world</p>', 'toolbar="floating"');
        const text = editableOf(editor).querySelector('p')!.firstChild as Text;
        selectBetween(text, 0, text, 5);
        editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
        await editor.updateComplete;
        return { editor, text };
    }

    const bubbleButton = (editor: GeRichTextEditor) => {
        const bar = editor.shadowRoot!.querySelector('[data-slot="rich-text-floating-toolbar"] ge-rich-text-toolbar') as GeRichTextToolbar;
        return bar.shadowRoot!.querySelector<HTMLButtonElement>(SLOT);
    };

    it('renders the link button in the bubble', async () => {
        const { editor } = await floatingEditor();
        await vi.waitFor(() => expect(bubbleButton(editor)).not.toBeNull());
    });

    it('keeps the selection when the bubble closes and links the selected text', async () => {
        const { editor, text } = await floatingEditor();
        await vi.waitFor(() => expect(bubbleButton(editor)).not.toBeNull());
        bubbleButton(editor)!.click();
        await settle(editor);
        expect(fieldOf(editor, 'text').value).toBe('Hello');

        // The bubble goes away with the selection; the form must not.
        document.getSelection()?.removeAllRanges();
        placeCaret(text, 0);
        document.getSelection()?.removeAllRanges();
        await fill(editor, 'Hello', 'https://example.com');
        await confirm(editor);

        expect(editableOf(editor).querySelector('a')?.textContent).toBe('Hello');
        expect(editableOf(editor).textContent).toBe('Hello world');
    });
});
