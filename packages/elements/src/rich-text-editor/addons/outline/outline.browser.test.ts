import { afterEach, describe, expect, it, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { editableOf, editorIn } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import type { GeRichTextToolbar } from '../../toolbar-index.js';
import '../../locales/he.js';
import './define.js';
import { RICH_TEXT_OUTLINE_LOCALES } from './index.js';

const EN = RICH_TEXT_OUTLINE_LOCALES.en;
const HEADINGS = '<h1>Intro</h1><p>text</p><h2>Setup</h2><h3>Details</h3><h2>Done</h2>';
const SLOT = '[data-addon-slot="view.outline"]';

afterEach(() => cdp().send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 }));

async function outlineEditor(content = '', attrs = ''): Promise<GeRichTextEditor> {
    const value = content ? `value="${content}"` : '';
    return editorIn(`<ge-rich-text-editor mode="html" addons="outline" ${value} ${attrs}></ge-rich-text-editor>`);
}

const toolbarOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('ge-rich-text-toolbar')!;
const buttonOf = (editor: GeRichTextEditor) => toolbarOf(editor)?.shadowRoot?.querySelector<HTMLButtonElement>(SLOT) ?? null;
const panelOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<HTMLElement>('[data-slot="rich-text-outline-panel"]');
const entriesOf = (editor: GeRichTextEditor) => [...editor.shadowRoot!.querySelectorAll<HTMLElement>('[data-outline-entry]')];
const flushObserver = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await editor.updateComplete;
    await toolbarOf(editor)?.updateComplete;
}

async function openPanel(editor: GeRichTextEditor): Promise<void> {
    buttonOf(editor)!.click();
    await settle(editor);
}

describe('outline addon: toolbar and lifecycle', () => {
    it('removes the toolbar button live when switched off, and restores it', async () => {
        const editor = await outlineEditor();
        expect(buttonOf(editor)?.getAttribute('title')).toBe(EN.toolbar);

        editor.addonOptions = { outline: false };
        await settle(editor);
        expect(buttonOf(editor)).toBeNull();

        editor.addonOptions = {};
        await settle(editor);
        expect(buttonOf(editor)).not.toBeNull();
    });

    it('registers the button at order 900 by default', async () => {
        const editor = await outlineEditor();
        expect(editor.toolbarSlots.slots.find((slot) => slot.id === 'view.outline')!.order).toBe(900);
    });

    it('toggles the docked panel when the toolbar button is clicked', async () => {
        const editor = await outlineEditor();
        expect(panelOf(editor)).toBeNull();

        await openPanel(editor);
        expect(panelOf(editor)).not.toBeNull();
        expect(buttonOf(editor)!.getAttribute('data-state')).toBe('on');

        await openPanel(editor);
        expect(panelOf(editor)).toBeNull();
        expect(buttonOf(editor)!.getAttribute('data-state')).toBe('off');
    });

    it('closes the panel from the close button', async () => {
        const editor = await outlineEditor();
        await openPanel(editor);
        panelOf(editor)!.querySelector<HTMLButtonElement>('button')!.click();
        await settle(editor);
        expect(panelOf(editor)).toBeNull();
    });

    it('registers a /outline command (on the editor instance registry) that opens the panel', async () => {
        const editor = await outlineEditor();
        const command = editor.commands.listCommands().find((c) => c.id === 'view.outline')!;
        expect(command.label).toBe(EN.slash);
        expect(command.order).toBe(125);

        await command.run({
            query: '',
            selectedText: '',
            executeToolbarCommand: () => undefined,
            insertText: () => undefined,
            insertHtml: () => undefined,
            showLinkDialog: () => undefined,
            focusEditor: () => undefined,
        });
        await settle(editor);
        expect(panelOf(editor)).not.toBeNull();
    });

    it('hides the toolbar button with { toolbar: false } but keeps the /outline command', async () => {
        const editor = await outlineEditor();
        editor.addonOptions = { outline: { toolbar: false } };
        await settle(editor);
        expect(buttonOf(editor)).toBeNull();
        expect(editor.commands.listCommands().some((c) => c.id === 'view.outline')).toBe(true);
    });

    it('drops the slash command with { slashCommand: false }', async () => {
        const editor = await outlineEditor();
        editor.addonOptions = { outline: { slashCommand: false } };
        await settle(editor);
        expect(editor.commands.listCommands().some((c) => c.id === 'view.outline')).toBe(false);
        expect(buttonOf(editor)).not.toBeNull();
    });

    it('hides the toolbar (and its outline button) while readonly', async () => {
        const editor = await outlineEditor('', 'readonly');
        expect(buttonOf(editor)).toBeNull();
    });

    it('disables the outline button while the editor is disabled', async () => {
        const editor = await outlineEditor('', 'disabled');
        expect(buttonOf(editor)!.disabled).toBe(true);
    });

    it('localizes the button tooltip and panel title for Hebrew', async () => {
        const editor = await outlineEditor('', 'locale="he"');
        expect(buttonOf(editor)!.getAttribute('title')).toBe(RICH_TEXT_OUTLINE_LOCALES.he!.toolbar);

        await openPanel(editor);
        expect(panelOf(editor)!.textContent).toContain(RICH_TEXT_OUTLINE_LOCALES.he!.title);
    });

    it('takes a locale from the addon options', async () => {
        const editor = await outlineEditor();
        editor.addonOptions = { outline: { locale: 'de' } };
        await settle(editor);
        expect(buttonOf(editor)!.title).toBe(RICH_TEXT_OUTLINE_LOCALES.de!.toolbar);
    });
});

describe('outline addon: the headings', () => {
    it('lists every heading in document order with its level', async () => {
        const editor = await outlineEditor(HEADINGS);
        await openPanel(editor);

        const rows = entriesOf(editor);
        expect(rows.map((row) => row.textContent?.trim())).toEqual(['Intro', 'Setup', 'Details', 'Done']);
        expect(rows.map((row) => row.getAttribute('data-outline-level'))).toEqual(['1', '2', '3', '2']);
    });

    it('refreshes the heading list when content changes while the panel is open', async () => {
        const editor = await outlineEditor('<h1>Intro</h1>');
        await openPanel(editor);
        expect(entriesOf(editor)).toHaveLength(1);

        editableOf(editor).insertAdjacentHTML('beforeend', '<h2>Added</h2>');
        await flushObserver();
        await settle(editor);

        expect(entriesOf(editor).map((row) => row.textContent?.trim())).toEqual(['Intro', 'Added']);
    });

    it('observes the content only while open', async () => {
        const observe = vi.spyOn(MutationObserver.prototype, 'observe');
        const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
        const editor = await outlineEditor('<h1>Intro</h1>');
        const baseline = observe.mock.calls.filter(([target]) => target === editableOf(editor)).length;

        await openPanel(editor);
        expect(observe.mock.calls.filter(([target]) => target === editableOf(editor))).toHaveLength(baseline + 1);

        const closed = disconnect.mock.calls.length;
        await openPanel(editor);
        expect(disconnect.mock.calls.length).toBeGreaterThan(closed);
        vi.restoreAllMocks();
    });

    it('shows the headings as they are when it is opened again', async () => {
        const editor = await outlineEditor('<h1>Intro</h1>');
        await openPanel(editor);
        await openPanel(editor);
        editableOf(editor).insertAdjacentHTML('beforeend', '<h2>While closed</h2>');
        await flushObserver();

        await openPanel(editor);
        expect(entriesOf(editor).map((row) => row.textContent?.trim())).toEqual(['Intro', 'While closed']);
    });

    it('shows the empty state when there are no headings', async () => {
        const editor = await outlineEditor('<p>none</p>');
        await openPanel(editor);
        const empty = panelOf(editor)!.querySelector('[data-slot="rich-text-outline-empty"]');
        expect(empty?.textContent).toBe(EN.empty);
    });

    it('indents each row by its level', async () => {
        const editor = await outlineEditor('<h1>Intro</h1><h2>Setup</h2><h3>Details</h3>');
        await openPanel(editor);
        // 0.5rem, plus 0.75rem per level below h1.
        expect(entriesOf(editor).map((row) => getComputedStyle(row).paddingInlineStart)).toEqual(['8px', '20px', '32px']);
    });

    it('marks the entries up as an ordered list so position and count are announced', async () => {
        const editor = await outlineEditor('<h1>Intro</h1><h2>Setup</h2>');
        await openPanel(editor);

        const list = panelOf(editor)!.querySelector('ol[data-slot="rich-text-outline-list"]')!;
        const items = [...list.querySelectorAll(':scope > li')];
        expect(items).toHaveLength(2);
        for (const item of items) expect(item.querySelector('button[data-outline-entry]')).not.toBeNull();
    });

    it('exposes the panel as a named navigation landmark with a real heading', async () => {
        const editor = await outlineEditor();
        await openPanel(editor);

        const nav = panelOf(editor)!;
        expect(nav.tagName.toLowerCase()).toBe('nav');
        const heading = editor.shadowRoot!.getElementById(nav.getAttribute('aria-labelledby')!);
        expect(heading?.tagName).toBe('H2');
        expect(heading?.textContent?.trim()).toBe(EN.title);
    });
});

describe('outline addon: scrolling', () => {
    it('scrolls the editor container (not any heading or the page) when an entry is clicked', async () => {
        const editor = await outlineEditor(HEADINGS);
        const scrollBy = vi.fn();
        editableOf(editor).scrollBy = scrollBy as unknown as typeof HTMLElement.prototype.scrollBy;
        const scrollIntoView = vi.fn();
        for (const heading of editableOf(editor).querySelectorAll<HTMLElement>('h1,h2,h3')) heading.scrollIntoView = scrollIntoView;
        await openPanel(editor);

        entriesOf(editor)[2]!.click();
        expect(scrollBy).toHaveBeenCalled();
        expect(scrollIntoView).not.toHaveBeenCalled();
    });

    it('scrolls to a heading on Enter or Space, and leaves other keys alone', async () => {
        const editor = await outlineEditor(HEADINGS);
        const scrollBy = vi.fn();
        editableOf(editor).scrollBy = scrollBy as unknown as typeof HTMLElement.prototype.scrollBy;
        await openPanel(editor);

        const press = (key: string): [boolean, number] => {
            scrollBy.mockClear();
            const event = new KeyboardEvent('keydown', { key, cancelable: true, bubbles: true });
            entriesOf(editor)[1]!.dispatchEvent(event);
            return [event.defaultPrevented, scrollBy.mock.calls.length];
        };
        expect([press('Enter'), press(' '), press('a')]).toEqual([[true, 1], [true, 1], [false, 0]]);
    });

    it('ignores an entry whose heading is gone', async () => {
        const editor = await outlineEditor('<h1>Intro</h1>');
        const scrollBy = vi.fn();
        editableOf(editor).scrollBy = scrollBy as unknown as typeof HTMLElement.prototype.scrollBy;
        await openPanel(editor);
        const entry = entriesOf(editor)[0]!;

        editableOf(editor).querySelector('h1')!.remove();
        entry.click();
        expect(scrollBy).not.toHaveBeenCalled();
    });
});

describe('outline addon: the frame', () => {
    it('insets the editable while open and releases it on close and teardown', async () => {
        const editor = await outlineEditor(HEADINGS);
        const editable = editableOf(editor);
        const before = Number.parseFloat(getComputedStyle(editable).paddingInlineStart);

        const padding = async () => {
            await Promise.all(document.getAnimations().map((animation) => animation.finished));
            return Number.parseFloat(getComputedStyle(editable).paddingInlineStart);
        };

        await openPanel(editor);
        expect(editable.hasAttribute('data-outline-open')).toBe(true);
        expect(await padding()).toBeGreaterThan(before);

        await openPanel(editor);
        expect(editable.hasAttribute('data-outline-open')).toBe(false);
        expect(await padding()).toBe(before);

        await openPanel(editor);
        editor.addonOptions = { outline: false };
        await settle(editor);
        expect(editable.hasAttribute('data-outline-open')).toBe(false);
        expect(panelOf(editor)).toBeNull();
    });

    it('docks the panel against the start edge: left in LTR, right in RTL', async () => {
        const editor = await outlineEditor();
        await openPanel(editor);
        const gaps = () => {
            const nav = panelOf(editor)!;
            const box = nav.getBoundingClientRect();
            const parent = nav.offsetParent as HTMLElement;
            const inner = parent.getBoundingClientRect();
            const border = getComputedStyle(parent);
            return {
                start: Math.round(box.left - inner.left - Number.parseFloat(border.borderLeftWidth)),
                end: Math.round(inner.right - Number.parseFloat(border.borderRightWidth) - box.right),
            };
        };

        const ltr = gaps();
        expect(ltr.start).toBe(0);
        expect(ltr.end).toBeGreaterThan(0);

        editor.dir = 'rtl';
        await settle(editor);
        const rtl = gaps();
        expect(rtl.end).toBe(0);
        expect(rtl.start).toBeGreaterThan(0);
    });

    it('grows the close button to a 44x44 touch target on a coarse pointer only', async () => {
        const closeRect = async (touch: boolean) => {
            await cdp().send('Emulation.setTouchEmulationEnabled', { enabled: touch, maxTouchPoints: 1 });
            const editor = await outlineEditor();
            await openPanel(editor);
            return panelOf(editor)!.querySelector(`button[aria-label="${EN.ariaClose}"]`)!.getBoundingClientRect();
        };
        const fine = await closeRect(false);
        const coarse = await closeRect(true);

        expect([fine.width, fine.height]).toEqual([28, 28]);
        expect(coarse.width).toBeGreaterThanOrEqual(44);
        expect(coarse.height).toBeGreaterThanOrEqual(44);
    });
});
