import { html } from 'lit';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RICH_TEXT_CONTROLLERS, type RichTextControllerFactory } from './rich-text-controllers.js';
import { createEditor, editableOf, editorIn, placeCaret, record, typeHtml } from './rich-text-editor.fixture.test.js';
import { GeRichTextEditor } from './rich-text-editor.js';
import type { RichTextHistoryProvider } from './rich-text-providers.js';

const HELLO = '<ge-rich-text-editor mode="html" value="<p>Hello</p>"></ge-rich-text-editor>';

function historyProvider(calls: string[] = []): RichTextHistoryProvider {
    return {
        push: () => calls.push('push'),
        schedule: () => calls.push('schedule'),
        flush: () => calls.push('flush'),
        canUndo: () => true,
        canRedo: () => false,
        undo: () => calls.push('undo'),
        redo: () => calls.push('redo'),
        entries: () => [{ index: 0, timestamp: 0, preview: 'p', previewLines: ['p'], lineCount: 1 }],
        index: () => 0,
        reconstruct: (index) => ({ html: `<p>${index}</p>`, markdown: `${index}` }),
        restore: (index) => calls.push(`restore ${index}`),
    };
}

const key = (name: string) => new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true });

describe('ge-rich-text-editor selection', () => {
    it('reports no selection, a text selection, and an image selection', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p>Hello <img src=&quot;data:image/gif;base64,R0lGODlhAQABAAAAACw=&quot; alt=&quot;a&quot;></p>"></ge-rich-text-editor>');
        const text = editableOf(editor).querySelector('p')!.firstChild!;
        document.getSelection()!.removeAllRanges();
        expect(editor.selection().kind).toBe('none');

        const range = new Range();
        range.setStart(text, 0);
        range.setEnd(text, 5);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);
        const snapshot = editor.selection();
        expect(snapshot).toMatchObject({ kind: 'text', text: 'Hello' });
        expect(snapshot.closestWithAttrs(['data-x'])).toBeNull();

        editableOf(editor).querySelector('img')!.click();
        expect(editor.selection().kind).toBe('image');
        expect(editor.selection().imageElement).toBe(editor.selectedImage);
    });

    it('drops a stale image selection when the content is replaced', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p><img src=&quot;data:image/gif;base64,R0lGODlhAQABAAAAACw=&quot; alt=&quot;a&quot;></p>"></ge-rich-text-editor>');
        editableOf(editor).querySelector('img')!.click();
        placeCaret(editableOf(editor).querySelector('p')!, 0);
        expect(editor.selectedImage).not.toBeNull();

        editor.value = '<p>something else</p>';
        await editor.updateComplete;

        expect(editor.selectedImage).toBeNull();
        expect(editor.selection().imageElement).toBeNull();
    });

    it('finds the nearest ancestor carrying one of the attributes', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p>a <span data-mention=&quot;1&quot;>@bo</span></p>"></ge-rich-text-editor>');
        placeCaret(editableOf(editor).querySelector('span')!.firstChild!, 1);

        expect(editor.selection().closestWithAttrs(['data-mention'])).toBe(editableOf(editor).querySelector('span'));
    });

    it('focus() returns focus and the caret the user left, and does nothing while disabled', async () => {
        const editor = await editorIn(HELLO);
        const text = editableOf(editor).querySelector('p')!.firstChild as Text;
        placeCaret(text, text.length);
        editor.saveSelection();
        document.getSelection()!.removeAllRanges();

        editor.focus();

        expect(document.activeElement).toBe(editableOf(editor));
        expect(document.getSelection()!.getRangeAt(0).startOffset).toBe(5);

        editableOf(editor).blur();
        editor.disabled = true;
        await editor.updateComplete;
        editor.focus();
        expect(document.activeElement).not.toBe(editableOf(editor));
    });

    it('restoreSelection falls back to the end of the content when the caret is parked elsewhere', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p>alpha</p><p>omega</p>"></ge-rich-text-editor>');
        const outside = document.createElement('p');
        outside.textContent = 'outside';
        document.body.append(outside);
        placeCaret(outside.firstChild!, 0);

        editor.restoreSelection();
        outside.remove();

        const range = document.getSelection()!.getRangeAt(0);
        expect(editableOf(editor).contains(range.startContainer)).toBe(true);
        const after = new Range();
        after.selectNodeContents(editableOf(editor));
        after.setStart(range.endContainer, range.endOffset);
        expect(after.cloneContents().textContent).toBe('');
    });

    it('keeps a live selection inside the editor unless asked to prefer the saved one', async () => {
        const editor = await editorIn('<ge-rich-text-editor mode="html" value="<p>alpha</p>"></ge-rich-text-editor>');
        const text = editableOf(editor).querySelector('p')!.firstChild!;
        placeCaret(text, 5);
        editor.saveSelection();
        placeCaret(text, 1);

        editor.restoreSelection();
        expect(document.getSelection()!.getRangeAt(0).startOffset).toBe(1);

        editor.restoreSelection({ preferLive: false });
        expect(document.getSelection()!.getRangeAt(0).startOffset).toBe(5);
    });

    it('wraps the saved selection in the built element and publishes the change', async () => {
        const editor = await editorIn(HELLO);
        const text = editableOf(editor).querySelector('p')!.firstChild!;
        const range = new Range();
        range.setStart(text, 0);
        range.setEnd(text, 5);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);

        const [wrapper] = editor.wrapSelection(() => document.createElement('mark'));

        expect(wrapper!.textContent).toBe('Hello');
        expect(editor.value).toContain('<mark>Hello</mark>');
    });

    it('does not throw when used before it has rendered', () => {
        const fresh = document.createElement('ge-rich-text-editor') as GeRichTextEditor;

        expect(() => {
            fresh.insertText('x');
            fresh.insertHtml('<b>x</b>');
            fresh.saveSelection();
            fresh.restoreSelection();
            fresh.focus();
            expect(fresh.selection().kind).toBe('none');
        }).not.toThrow();
    });
});

describe('ge-rich-text-editor transactions', () => {
    it('mutateContent edits the root, publishes once and records history', async () => {
        const editor = await editorIn(HELLO);
        const calls: string[] = [];
        editor.provide('history', historyProvider(calls));
        const changes = record<{ value: string }>(editor, 'value-change');

        editor.mutateContent((root) => root.querySelector('p')!.append(' world'));

        expect(changes.map((change) => change.value)).toEqual(['<p>Hello world</p>']);
        expect(calls).toEqual(['flush', 'push']);
    });

    it('commit can skip history and return focus, and announces a selection change', async () => {
        const editor = await editorIn(HELLO);
        const calls: string[] = [];
        editor.provide('history', historyProvider(calls));
        let selections = 0;
        editor.subscribe('selection', () => selections++);
        editableOf(editor).blur();

        editor.commit({ history: false, focus: true });

        expect(calls).toEqual(['flush']);
        expect(document.activeElement).toBe(editableOf(editor));
        expect(selections).toBe(1);
    });

    it('commitContent re-reads the DOM and flushes pending history', async () => {
        const editor = await editorIn(HELLO);
        const calls: string[] = [];
        editor.provide('history', historyProvider(calls));
        editableOf(editor).querySelector('p')!.textContent = 'Direct';

        editor.commitContent();

        expect(editor.value).toBe('<p>Direct</p>');
        expect(calls).toEqual(['flush']);
    });

    it('format runs the registered command at the restored caret as one transaction, then focuses', async () => {
        const editor = await editorIn(HELLO);
        const calls: string[] = [];
        editor.provide('history', historyProvider(calls));
        editor.commandTable.set('bold', () => {
            calls.push('run');
            editableOf(editor).querySelector('p')!.innerHTML = '<b>Hello</b>';
        });
        editableOf(editor).blur();

        editor.format('bold');

        expect(calls).toEqual(['flush', 'run', 'flush', 'push']);
        expect(editor.value).toBe('<p><b>Hello</b></p>');
        expect(document.activeElement).toBe(editableOf(editor));
    });

    it('format is a no-op for an unregistered command, while readonly, and while disabled', async () => {
        const editor = await editorIn(HELLO);
        const run = vi.fn();
        editor.commandTable.set('bold', run);

        editor.format('italic');
        editor.readonly = true;
        editor.format('bold');
        editor.readonly = false;
        editor.disabled = true;
        editor.format('bold');

        expect(run).not.toHaveBeenCalled();
    });
});

describe('ge-rich-text-editor providers', () => {
    it('behaves as an empty history until one is provided, then delegates to it', async () => {
        const editor = await editorIn(HELLO);
        expect(editor.canUndo).toBe(false);
        expect(editor.canRedo).toBe(false);
        expect(editor.historyEntries()).toEqual([]);
        expect(editor.currentHistoryIndex()).toBe(-1);
        expect(editor.reconstructHistoryEntry(0)).toBeNull();
        expect(() => {
            editor.undo();
            editor.redo();
            editor.pushHistory();
            editor.restoreHistoryEntry(0);
        }).not.toThrow();

        const calls: string[] = [];
        const unprovide = editor.provide('history', historyProvider(calls));
        editor.undo();
        editor.redo();
        editor.restoreHistoryEntry(2);

        expect(editor.canUndo).toBe(true);
        expect(editor.historyEntries()).toHaveLength(1);
        expect(editor.currentHistoryIndex()).toBe(0);
        expect(editor.reconstructHistoryEntry(3)).toEqual({ html: '<p>3</p>', markdown: '3' });
        expect(calls).toEqual(['undo', 'redo', 'restore 2']);

        unprovide();
        expect(editor.canUndo).toBe(false);
    });

    it('does not let a stale teardown remove a newer provider', async () => {
        const editor = await editorIn(HELLO);
        const stale = editor.provide('history', historyProvider());
        editor.provide('history', historyProvider());

        stale();

        expect(editor.canUndo).toBe(true);
    });

    it('routes the insert, inline-style and block seams to their providers', async () => {
        const editor = await editorIn(HELLO);
        const calls: string[] = [];
        editor.provide('insert', {
            text: (t) => calls.push(`text ${t}`), html: (h) => calls.push(`html ${h}`),
            textAtCaret: (t) => calls.push(`caret ${t}`), htmlAtCaret: (h) => calls.push(`caret-html ${h}`),
            block: (h) => calls.push(`block ${h}`), fromOverlay: (t) => calls.push(`overlay ${t}`),
        });
        editor.provide('inlineStyle', {
            apply: (style) => calls.push(`style ${style.color}`),
            current: () => ({ color: 'red', backgroundColor: '', fontSize: '', fontFamily: '' }),
        });
        editor.provide('blocks', { execute: (command, block) => calls.push(`block-cmd ${command} ${block === null}`) });

        editor.insertText('a');
        editor.insertText('');
        editor.insertHtml('<b>b</b>');
        editor.insertTextAtCaret('c');
        editor.insertHtmlAtCaret('<i>d</i>');
        editor.insertBlockAtCaret('<hr>');
        editor.insertTextFromOverlay('e');
        editor.applyInlineStyle({ color: 'blue' });
        editor.executeToolbarCommandOnBlock('heading1', null);

        expect(calls).toEqual(['text a', 'html <b>b</b>', 'caret c', 'caret-html <i>d</i>', 'block <hr>', 'overlay e', 'style blue', 'block-cmd heading1 true']);
        expect(editor.selectionInlineStyle.color).toBe('red');
    });

    it('reports an empty inline style and ignores the seams without providers', async () => {
        const editor = await editorIn(HELLO);

        expect(editor.selectionInlineStyle).toEqual({ color: '', backgroundColor: '', fontSize: '', fontFamily: '' });
        expect(() => {
            editor.applyInlineStyle({ color: 'red' });
            editor.executeToolbarCommandOnBlock('heading1', null);
            editor.insertBlockAtCaret('<hr>');
        }).not.toThrow();
    });

    it('turns a history-change event into the history topic', async () => {
        const editor = await editorIn(HELLO);
        const events = record<{ canUndo: boolean }>(editor, 'history-change');
        let topic = 0;
        editor.subscribe('history', () => topic++);

        editor.emit('history-change', { canUndo: true, canRedo: false });

        expect(events).toEqual([{ canUndo: true, canRedo: false }]);
        expect(topic).toBe(1);
    });

    it('shares the active formats and tells subscribers only when they change', async () => {
        const editor = await editorIn(HELLO);
        let states = 0;
        editor.subscribe('state', () => states++);

        editor.setActiveFormats(new Set(['bold']));
        editor.setActiveFormats(new Set(['bold']));

        expect(editor.activeFormats.has('bold')).toBe(true);
        expect(states).toBe(1);
    });
});

describe('ge-rich-text-editor topics and hooks', () => {
    it('announces content, selection and disabled topics', async () => {
        const editor = await editorIn(HELLO);
        const seen: string[] = [];
        for (const topic of ['content', 'selection', 'disabled'] as const) editor.subscribe(topic, () => seen.push(topic));

        editor.setContent('<p>x</p>');
        editableOf(editor).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        editableOf(editor).dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowLeft', bubbles: true }));
        editor.disabled = true;
        await editor.updateComplete;

        expect(seen).toEqual(['content', 'selection', 'selection', 'disabled']);
    });

    it('lets a subscriber unsubscribe', async () => {
        const editor = await editorIn(HELLO);
        const fn = vi.fn();
        const off = editor.subscribe('content', fn);
        off();

        editor.setContent('<p>y</p>');

        expect(fn).not.toHaveBeenCalled();
    });

    it('runs content-replaced hooks for writes but not for typing', async () => {
        const editor = await editorIn(HELLO);
        const hook = vi.fn();
        const off = editor.onContentReplaced(hook);

        editor.setContent('<p>a</p>');
        editor.value = '<p>b</p>';
        await editor.updateComplete;
        expect(hook).toHaveBeenCalledTimes(2);

        await typeHtml(editor, '<p>c</p>');
        expect(hook).toHaveBeenCalledTimes(2);

        off();
        editor.setContent('<p>d</p>');
        expect(hook).toHaveBeenCalledTimes(2);
    });

    it('feeds input observers the block-aware text and the caret offset, before the model updates', async () => {
        const editor = await editorIn(HELLO);
        const seen: Array<[string, number, string]> = [];
        const off = editor.registerInputObserver((text, caret) => seen.push([text, caret, editor.value]));
        const root = editableOf(editor);
        root.innerHTML = '<p>one</p><p>two</p>';
        placeCaret(root.lastElementChild!.firstChild!, 1);

        root.dispatchEvent(new InputEvent('input', { bubbles: true }));

        expect(seen).toEqual([['one\ntwo\n', 4, '<p>Hello</p>']]);
        off();
        root.dispatchEvent(new InputEvent('input', { bubbles: true }));
        expect(seen).toHaveLength(1);
    });

    it('lets an input transform rewrite the content first and records it as its own history entry', async () => {
        const editor = await editorIn(HELLO);
        const calls: string[] = [];
        editor.provide('history', historyProvider(calls));
        editor.addInputTransform(() => {
            editableOf(editor).innerHTML = '<h1>Rule</h1>';
            return true;
        });

        await typeHtml(editor, '<p># Rule</p>');

        expect(editor.value).toBe('<h1>Rule</h1>');
        expect(calls).toEqual(['push']);
    });

    it('schedules a debounced history push for plain typing and sweeps spent caret anchors', async () => {
        const editor = await editorIn(HELLO);
        const calls: string[] = [];
        editor.provide('history', historyProvider(calls));

        await typeHtml(editor, '<p>​typed</p>');

        expect(calls).toEqual(['schedule']);
        expect(editor.value).toBe('<p>typed</p>');
        expect(editableOf(editor).textContent).toBe('typed');
    });

    it('keeps a lone caret anchor and a real selection while sweeping', async () => {
        const editor = await editorIn(HELLO);
        await typeHtml(editor, '<p>​</p>');
        expect(editableOf(editor).querySelector('p')!.textContent).toBe('​');

        const root = editableOf(editor);
        root.innerHTML = '<p>​alpha beta</p>';
        const text = root.querySelector('p')!.firstChild!;
        const range = new Range();
        range.setStart(text, 1);
        range.setEnd(text, 6);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);

        root.dispatchEvent(new InputEvent('input', { bubbles: true }));

        expect(document.getSelection()!.isCollapsed).toBe(false);
        expect(document.getSelection()!.toString()).toBe('alpha');
        expect(root.textContent).toBe('alpha beta');
    });
});

describe('ge-rich-text-editor event pipelines', () => {
    it('runs keydown interceptors first, then key handlers lowest priority first, until one consumes', async () => {
        const editor = await editorIn(HELLO);
        const order: string[] = [];
        editor.addKeyHandler(20, () => (order.push('late'), false));
        editor.addKeyHandler(5, () => (order.push('early'), false));
        editor.registerKeydownInterceptor(() => (order.push('interceptor'), false));

        editableOf(editor).dispatchEvent(key('a'));
        expect(order).toEqual(['interceptor', 'early', 'late']);

        order.length = 0;
        editor.addKeyHandler(1, () => (order.push('consumer'), true));
        editableOf(editor).dispatchEvent(key('a'));
        expect(order).toEqual(['interceptor', 'consumer']);
    });

    it('removes a key handler with its teardown', async () => {
        const editor = await editorIn(HELLO);
        const handler = vi.fn(() => false);
        const off = editor.addKeyHandler(0, handler);
        off();

        editableOf(editor).dispatchEvent(key('a'));

        expect(handler).not.toHaveBeenCalled();
    });

    it('always cancels the native paste and lets an interceptor keep it from later handlers', async () => {
        const editor = await editorIn(HELLO);
        const later = vi.fn();
        const paste = () => new ClipboardEvent('paste', { bubbles: true, cancelable: true });
        editableOf(editor).addEventListener('paste', later);

        const plain = paste();
        editableOf(editor).dispatchEvent(plain);
        expect(plain.defaultPrevented).toBe(true);
        expect(later).toHaveBeenCalledTimes(1);

        editor.registerPasteInterceptor(() => true);
        editableOf(editor).dispatchEvent(paste());
        expect(later).toHaveBeenCalledTimes(1);
    });

    it('swallows a paste while readonly or disabled', async () => {
        const editor = await editorIn(HELLO);
        const later = vi.fn();
        editableOf(editor).addEventListener('paste', later);
        editor.readonly = true;

        const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true });
        editableOf(editor).dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(later).not.toHaveBeenCalled();
    });

    it('shows the drop zone for a file drag an addon claims, and clears it on leave and drop', async () => {
        const editor = await editorIn(HELLO);
        const files = new DataTransfer();
        files.items.add(new File(['x'], 'a.png', { type: 'image/png' }));
        const drag = (type: string, extra: DragEventInit = {}) => new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: files, ...extra });

        const unclaimed = drag('dragover');
        editableOf(editor).dispatchEvent(unclaimed);
        expect(unclaimed.defaultPrevented).toBe(false);

        const off = editor.registerDropZonePredicate(() => true);
        const claimed = drag('dragover');
        editableOf(editor).dispatchEvent(claimed);
        await editor.updateComplete;
        expect(claimed.defaultPrevented).toBe(true);
        expect(editor.shadowRoot!.querySelector('.drop-zone')).toBeTruthy();

        editableOf(editor).dispatchEvent(drag('dragleave', { relatedTarget: null }));
        await editor.updateComplete;
        expect(editor.shadowRoot!.querySelector('.drop-zone')).toBeNull();

        const dropped = vi.fn(() => true);
        editor.registerDropInterceptor(dropped);
        const later = vi.fn();
        editableOf(editor).addEventListener('drop', later);
        editableOf(editor).dispatchEvent(drag('drop'));
        expect(dropped).toHaveBeenCalledTimes(1);
        expect(later).not.toHaveBeenCalled();
        off();
    });

    it('closes the other exclusive popovers when one opens', async () => {
        const editor = await editorIn(HELLO);
        const closeA = vi.fn();
        const closeB = vi.fn();
        const a = editor.registerExclusivePopover(closeA);
        editor.registerExclusivePopover(closeB);

        a.notifyOpened();
        expect(closeA).not.toHaveBeenCalled();
        expect(closeB).toHaveBeenCalledTimes(1);

        a.release();
        editor.registerExclusivePopover(vi.fn()).notifyOpened();
        expect(closeA).not.toHaveBeenCalled();
    });

    it('owns shortcut actions only while registered and enabled', async () => {
        const editor = await editorIn(HELLO);
        let enabled = false;
        const run = vi.fn();
        expect(editor.canRunShortcutAction('x')).toBe(false);

        const off = editor.registerShortcutAction('x', run, () => enabled);
        expect(editor.canRunShortcutAction('x')).toBe(false);
        enabled = true;
        expect(editor.canRunShortcutAction('x')).toBe(true);
        editor.runShortcutAction('x');
        expect(run).toHaveBeenCalledTimes(1);

        off();
        expect(editor.canRunShortcutAction('x')).toBe(false);
    });

    it('routes image files to the one registered owner and link requests to the link editor', async () => {
        const editor = await editorIn(HELLO);
        const file = new File(['x'], 'a.png');
        expect(editor.hasImageFileHandler).toBe(false);
        expect(editor.insertImageFile(file)).toBe(false);

        const first = vi.fn();
        const second = vi.fn();
        const offFirst = editor.registerImageFileHandler(first);
        editor.registerImageFileHandler(second);
        expect(editor.hasImageFileHandler).toBe(true);
        expect(editor.insertImageFile(file)).toBe(true);
        expect(second).toHaveBeenCalledWith(file);
        expect(first).not.toHaveBeenCalled();
        offFirst();
        expect(editor.hasImageFileHandler).toBe(true);

        const open = vi.fn();
        expect(() => editor.showLinkDialog()).not.toThrow();
        const offLink = editor.registerLinkEditor(open);
        editor.showLinkDialog({ x: 1, y: 2 });
        expect(open).toHaveBeenCalledWith({ x: 1, y: 2 });
        offLink();
        editor.showLinkDialog();
        expect(open).toHaveBeenCalledTimes(1);
    });

    it('announces an open suggestion popup on the textbox as a combobox', async () => {
        const editor = await editorIn(HELLO);
        editor.setActiveSuggestionPopup({ controlsId: 'list', activeOptionId: 'opt-2' });
        await editor.updateComplete;
        const root = editableOf(editor);
        expect([root.getAttribute('aria-expanded'), root.getAttribute('aria-controls'), root.getAttribute('aria-activedescendant')])
            .toEqual(['true', 'list', 'opt-2']);

        editor.setActiveSuggestionPopup(null);
        await editor.updateComplete;
        expect(root.hasAttribute('aria-expanded')).toBe(false);
    });
});

describe('ge-rich-text-editor addons and controllers', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('sets up an addon named in the attribute with its options, and tears it down with the element', async () => {
        const log: string[] = [];
        GeRichTextEditor.registerAddon({
            id: 'probe-a',
            setup: (host, options) => {
                log.push(`setup ${JSON.stringify(options)} ${host.element.localName}`);
                return () => log.push('teardown');
            },
        });
        const editor = await createEditor((el) => {
            el.addons = 'probe-a';
            el.addonOptions = { 'probe-a': { size: 2 } };
        });
        expect(log).toEqual(['setup {"size":2} ge-rich-text-editor']);

        const parent = editor.parentElement!;
        editor.remove();
        expect(log).toEqual(['setup {"size":2} ge-rich-text-editor', 'teardown']);

        parent.append(editor);
        expect(log).toHaveLength(3);
    });

    it('enables and disables addons as the attribute changes, and warns about an unknown id', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const setup = vi.fn(() => vi.fn());
        GeRichTextEditor.registerAddon({ id: 'probe-b', setup });
        const editor = await editorIn('<ge-rich-text-editor addons="probe-b nope"></ge-rich-text-editor>');
        expect(setup).toHaveBeenCalledTimes(1);
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('nope'));

        const teardown = setup.mock.results[0]!.value as ReturnType<typeof vi.fn>;
        editor.addons = '';
        await editor.updateComplete;
        expect(teardown).toHaveBeenCalledTimes(1);
    });

    it('use() enables an addon on one editor only, and its teardown removes it', async () => {
        const [first, second] = [await editorIn(HELLO), await editorIn(HELLO)];
        const teardown = vi.fn();
        const setup = vi.fn(() => teardown);

        const remove = first.use({ id: 'probe-c', setup }, { on: true });
        expect(setup).toHaveBeenCalledWith(first, { on: true });
        expect(second.hasImageFileHandler).toBe(false);

        remove();
        expect(teardown).toHaveBeenCalledTimes(1);
    });

    describe('controllers', () => {
        const registry = RICH_TEXT_CONTROLLERS as RichTextControllerFactory[];

        afterEach(() => {
            registry.length = 0;
        });

        it('builds controllers from the list, attaches them with the element, and draws what they render', async () => {
            const log: string[] = [];
            registry.push((host) => ({
                attach: () => log.push(`attach ${host.contentRoot.dataset['slot']}`),
                detach: () => log.push('detach'),
                renderToolbar: () => html`<b class="from-toolbar"></b>`,
                renderOverlay: () => html`<i class="from-overlay"></i>`,
            }));
            const editor = await createEditor();

            expect(log).toEqual(['attach editor']);
            expect(editor.shadowRoot!.querySelector('.toolbar .from-toolbar')).toBeTruthy();
            expect(editor.overlayAnchor.querySelector('.from-overlay')).toBeTruthy();

            const parent = editor.parentElement!;
            editor.remove();
            parent.append(editor);
            expect(log).toEqual(['attach editor', 'detach', 'attach editor']);
        });

        it('lets a controller plug in a provider and an input transform through the host', async () => {
            registry.push((host) => ({
                attach: () => {
                    host.provide('history', historyProvider());
                    host.addInputTransform(() => false);
                },
                detach: () => undefined,
            }));
            const editor = await createEditor();

            expect(editor.canUndo).toBe(true);
        });
    });
});
