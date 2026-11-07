import { html } from 'lit';
import { describe, expect, it, vi } from 'vitest';
import { defineAddon } from './rich-text-addon-kit.js';
import { createEditor, editableOf, editorIn } from './rich-text-editor.fixture.test.js';
import { GeRichTextEditor } from './rich-text-editor.js';
import type { RichTextAddonHost } from './rich-text-host.js';

const GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

const toolbarOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector('ge-rich-text-toolbar')!;
const slotIn = (editor: GeRichTextEditor, id: string) => toolbarOf(editor).shadowRoot!.querySelector<HTMLElement>(`[data-addon-slot="${id}"]`);
const settled = async (editor: GeRichTextEditor) => {
    await editor.updateComplete;
    await toolbarOf(editor).updateComplete;
};

describe('RichTextAddonHost', () => {
    it('is satisfied by the element, with undo, redo and their availability', async () => {
        const editor = await editorIn('<ge-rich-text-editor></ge-rich-text-editor>');
        const host: RichTextAddonHost = editor;
        expect([typeof host.undo, typeof host.redo, typeof host.canUndo, typeof host.canRedo, typeof host.emit]).toEqual(['function', 'function', 'boolean', 'boolean', 'function']);
    });

    it('builds a create slot once per toolbar instance and keeps it across renders', async () => {
        const create = vi.fn(() => document.createElement('x-fixture'));
        const editor = await createEditor();
        editor.toolbarSlots.register({ id: 'fx.create', create });
        await settled(editor);

        const element = slotIn(editor, 'fx.create')!.firstElementChild;
        expect(element?.localName).toBe('x-fixture');
        editor.invalidate();
        await settled(editor);
        expect(slotIn(editor, 'fx.create')!.firstElementChild).toBe(element);
        expect(create).toHaveBeenCalledTimes(1);
    });

    it('draws an overlay inside the container after the controllers, and removes it with its teardown', async () => {
        const editor = await createEditor();
        const remove = editor.overlays.register({ id: 'fx.overlay', render: () => html`<i class="fx-overlay"></i>` });
        await editor.updateComplete;
        expect(editor.overlayAnchor.querySelector('.fx-overlay')).not.toBeNull();

        remove();
        await editor.updateComplete;
        expect(editor.overlayAnchor.querySelector('.fx-overlay')).toBeNull();
    });

    it('mounts a popup in the light DOM so the editable can name it with aria-controls', async () => {
        const editor = await createEditor();
        const popup = document.createElement('div');
        popup.id = 'fx-popup';
        const unmount = editor.mountPopup(popup);

        expect(popup.parentElement).toBe(editor);
        expect(popup.slot).toBe('popup');
        expect(editor.shadowRoot!.querySelector<HTMLSlotElement>('.container slot[name="popup"]')!.assignedElements()).toContain(popup);
        editor.setActiveSuggestionPopup({ controlsId: popup.id, activeOptionId: null });
        await editor.updateComplete;
        const controls = editableOf(editor).getAttribute('aria-controls')!;
        expect(editableOf(editor).getRootNode()).toBe(popup.getRootNode());
        expect(document.getElementById(controls)).toBe(popup);

        unmount();
        expect(popup.isConnected).toBe(false);
    });

    it('adopts a stylesheet once per scope and releases it with the last user', async () => {
        const editor = await createEditor();
        const shadowBefore = editor.shadowRoot!.adoptedStyleSheets.length;
        const documentBefore = document.adoptedStyleSheets.length;
        const rule = ".fx-adopt { color: red }";

        const releaseA = editor.adoptStyles(rule, 'shadow');
        const releaseB = editor.adoptStyles(rule, 'shadow');
        const releaseDocument = editor.adoptStyles(".fx-doc { color: blue }", 'document');
        expect(editor.shadowRoot!.adoptedStyleSheets).toHaveLength(shadowBefore + 1);
        expect(document.adoptedStyleSheets).toHaveLength(documentBefore + 1);

        releaseA();
        expect(editor.shadowRoot!.adoptedStyleSheets).toHaveLength(shadowBefore + 1);
        releaseB();
        releaseDocument();
        expect(editor.shadowRoot!.adoptedStyleSheets).toHaveLength(shadowBefore);
        expect(document.adoptedStyleSheets).toHaveLength(documentBefore);
    });

    it('publishes selection and state once when the selected image changes', async () => {
        const editor = await editorIn(`<ge-rich-text-editor mode="html" value="<p><img src='${GIF}' alt='a'></p>"></ge-rich-text-editor>`);
        const topics: string[] = [];
        editor.subscribe('selection', () => topics.push('selection'));
        editor.subscribe('state', () => topics.push('state'));
        const image = editableOf(editor).querySelector('img')!;

        image.click();
        image.click();
        expect(topics).toEqual(['selection', 'state']);
        editor.setSelectedImage(null);
        expect(topics).toEqual(['selection', 'state', 'selection', 'state']);
    });

    it('publishes state when readonly changes, so slots re-read isEnabled', async () => {
        const editor = await createEditor();
        let enabled = true;
        const slot = { id: 'fx.enabled', icon: '<i></i>', isEnabled: () => !editor.readonly };
        editor.toolbarSlots.register(slot);
        editor.subscribe('state', () => {
            enabled = slot.isEnabled();
        });

        editor.readonly = true;
        await editor.updateComplete;
        expect(enabled).toBe(false);
        editor.readonly = false;
        await editor.updateComplete;
        expect(enabled).toBe(true);
    });
});

describe('addon lifecycle', () => {
    it('runs a defineAddon addon again for a new locale and releases what the earlier run registered', async () => {
        const seen: string[] = [];
        GeRichTextEditor.registerAddon(defineAddon('fx-locale', 10, ({ host, life }) => {
            seen.push(host.resolvedLocale.code);
            life.add(host.toolbarSlots.register({ id: `fx.${host.resolvedLocale.code}`, icon: '<i></i>' }));
        }));
        const editor = await createEditor((el) => {
            el.addons = 'fx-locale';
        });
        expect(seen).toEqual(['en']);

        editor.locale = { ...editor.resolvedLocale, code: 'xx' };
        await editor.updateComplete;
        expect(seen).toEqual(['en', 'xx']);
        expect(editor.toolbarSlots.slots.map((slot) => slot.id)).toEqual(['fx.xx']);
    });

    it('sets an addon up again when its options object is replaced, and not when it stays the same', async () => {
        const setup = vi.fn(() => vi.fn());
        GeRichTextEditor.registerAddon({ id: 'fx-options', setup });
        const first = { size: 1 };
        const editor = await createEditor((el) => {
            el.addons = 'fx-options';
            el.addonOptions = { 'fx-options': first };
        });
        editor.addonOptions = { 'fx-options': first };
        await editor.updateComplete;
        expect(setup).toHaveBeenCalledTimes(1);

        const teardown = setup.mock.results[0]!.value as ReturnType<typeof vi.fn>;
        editor.addonOptions = { 'fx-options': { size: 2 } };
        await editor.updateComplete;
        expect(teardown).toHaveBeenCalledTimes(1);
        expect(setup).toHaveBeenCalledTimes(2);
        expect(setup.mock.calls[1]).toEqual([editor, { size: 2 }]);
    });

    it('treats addonOptions[id] === false as switched off, and on again when it goes', async () => {
        const teardown = vi.fn();
        const setup = vi.fn(() => teardown);
        GeRichTextEditor.registerAddon({ id: 'fx-off', setup });
        const editor = await createEditor((el) => {
            el.addons = 'fx-off';
            el.addonOptions = { 'fx-off': false };
        });
        expect(setup).not.toHaveBeenCalled();

        editor.addonOptions = {};
        await editor.updateComplete;
        expect(setup).toHaveBeenCalledTimes(1);
        editor.addonOptions = { 'fx-off': false };
        await editor.updateComplete;
        expect(teardown).toHaveBeenCalledTimes(1);
    });

    it('starts a late-registered addon on editors that already named it', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const setup = vi.fn();
        const editor = await editorIn('<ge-rich-text-editor addons="fx-late"></ge-rich-text-editor>');
        expect(setup).not.toHaveBeenCalled();

        GeRichTextEditor.registerAddon({ id: 'fx-late', setup });
        expect(setup).toHaveBeenCalledWith(editor, undefined);
        vi.restoreAllMocks();
    });

    it('does not start an addon on an editor that was removed', async () => {
        const setup = vi.fn();
        const editor = await editorIn('<ge-rich-text-editor addons="fx-removed"></ge-rich-text-editor>');
        editor.remove();
        GeRichTextEditor.registerAddon({ id: 'fx-removed', setup });
        expect(setup).not.toHaveBeenCalled();
    });
});
