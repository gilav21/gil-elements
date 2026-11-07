import { afterEach, describe, expect, it } from 'vitest';
import { editableOf, editorIn, placeCaret, record, selectBetween } from '../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../rich-text-editor.js';
import type { GeRichTextToolbar } from '../toolbar-index.js';
import '../locales/he.js';
import { pngFile } from './file-import/file-import.fixture.test.js';
import './full/define.js';
import { RICH_TEXT_LINKS_LOCALES } from './links/index.js';
import { RICH_TEXT_OUTLINE_LOCALES } from './outline/index.js';

type Popover = HTMLElement & { open: boolean; updateComplete: Promise<unknown> };

const rect = (left: number, top: number, width: number, height: number) =>
    ({ x: left, y: top, left, top, width, height, right: left + width, bottom: top + height, toJSON: () => ({}) }) as DOMRect;
const originalRangeRect = Range.prototype.getBoundingClientRect;

afterEach(() => {
    Range.prototype.getBoundingClientRect = originalRangeRect;
    document.getSelection()?.removeAllRanges();
});

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 20));
const root = (editor: GeRichTextEditor) => editor.shadowRoot!;
const topBar = (editor: GeRichTextEditor) => root(editor).querySelector<GeRichTextToolbar>('.toolbar ge-rich-text-toolbar')!;
const bubbleBar = (editor: GeRichTextEditor) => root(editor).querySelector<GeRichTextToolbar>('[data-slot="rich-text-floating-toolbar"] ge-rich-text-toolbar');
const slotIn = (bar: GeRichTextToolbar | null, id: string) => bar?.shadowRoot?.querySelector<HTMLElement>(`[data-addon-slot="${id}"]`) ?? null;
const buttonIn = (slot: HTMLElement) => (slot.localName === 'button' ? slot : slot.querySelector('button'))!;
const linkForm = (editor: GeRichTextEditor) => root(editor).querySelector<HTMLElement>('[data-slot="rich-text-links-form"]');
const menuOf = (editor: GeRichTextEditor) => editor.querySelector<HTMLElement>('[data-slot="suggestions"]');
const labelsOf = (editor: GeRichTextEditor) => [...editor.querySelectorAll('[role="option"]')].map((option) => option.textContent ?? '');
const keydown = (target: HTMLElement, init: KeyboardEventInit) => target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }));

async function flush(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await topBar(editor)?.updateComplete;
    await bubbleBar(editor)?.updateComplete;
}

async function fullEditor(content = '', attrs = '', options: Record<string, unknown> = {}): Promise<GeRichTextEditor> {
    Range.prototype.getBoundingClientRect = () => rect(120, 100, 10, 18);
    const editor = await editorIn(`<ge-rich-text-editor mode="html" addons="full" ${attrs}></ge-rich-text-editor>`);
    editor.addonOptions = options;
    editor.value = content;
    await flush(editor);
    return editor;
}

function typeSlash(editor: GeRichTextEditor, text: string): void {
    const editable = editableOf(editor);
    editable.innerHTML = `<p>${text}</p>`;
    const node = editable.querySelector('p')!.firstChild as Text;
    placeCaret(node, node.length);
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: '/' }));
}

function selectWord(editor: GeRichTextEditor, from = 0, to = 5): Text {
    const text = editableOf(editor).querySelector('p')!.firstChild as Text;
    selectBetween(text, from, text, to);
    editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
    return text;
}

async function pickColor(editor: GeRichTextEditor, bar: GeRichTextToolbar, kind: string, color: string): Promise<void> {
    const slot = slotIn(bar, `colors.${kind}`)!;
    buttonIn(slot).click();
    const popover = slot.querySelector<Popover>('ge-popover')!;
    await popover.updateComplete;
    await settle();
    slot.querySelector('ge-color-picker')!.dispatchEvent(new CustomEvent('color-change', { detail: color, bubbles: true, composed: true }));
    await flush(editor);
}

describe('slash menu across addons', () => {
    it('lists the commands the other addons contribute', async () => {
        const editor = await fullEditor('', '', { ai: { provider: () => 'x' } });
        const cases: Array<[string, RegExp]> = [['/table', /table/i], ['/link', /link/i], ['/outline', /outline/i], ['/ai', /ai/i]];
        for (const [query, label] of cases) {
            typeSlash(editor, query);
            await editor.updateComplete;
            expect(labelsOf(editor).some((text) => label.test(text)), query).toBe(true);
        }
    });

    it('registers /action only once definitions exist', async () => {
        const has = (editor: GeRichTextEditor) => editor.commands.listCommands().some((command) => command.id === 'actions.attach');
        expect(has(await fullEditor())).toBe(false);
        expect(has(await fullEditor('', '', { actions: { definitions: [{ id: 'go', label: 'Go', triggers: ['click'] }] } }))).toBe(true);
    });

    it('offers no /ai command without a provider', async () => {
        const editor = await fullEditor();
        typeSlash(editor, '/ai');
        expect(labelsOf(editor).some((text) => /\bai\b/i.test(text))).toBe(false);
    });

    it('removes the typed /table before inserting the table', async () => {
        const editor = await fullEditor();
        typeSlash(editor, '/table');
        keydown(editableOf(editor), { key: 'Enter' });
        await settle();

        expect(editableOf(editor).querySelector('table')).not.toBeNull();
        expect(editableOf(editor).textContent).not.toContain('/table');
        expect(menuOf(editor)).toBeNull();
    });

    it('opens the link form from /link without leaving the typed text', async () => {
        const editor = await fullEditor();
        typeSlash(editor, '/link');
        keydown(editableOf(editor), { key: 'Enter' });
        await settle();

        expect(linkForm(editor)).not.toBeNull();
        expect(editableOf(editor).textContent).not.toContain('/link');
    });
});

describe('images and file import', () => {
    it('routes a picked image through the images addon', async () => {
        const editor = await fullEditor('<p>x</p>');
        expect(editor.hasImageFileHandler).toBe(true);
        const errors = record<string>(editor, 'file-import-error');
        placeCaret(editableOf(editor).querySelector('p')!.firstChild!, 1);

        const input = root(editor).querySelector<HTMLInputElement>('[data-slot="rte-file-import-input"]')!;
        Object.defineProperty(input, 'files', { value: [pngFile()], configurable: true });
        input.dispatchEvent(new Event('change', { bubbles: true }));

        await expect.poll(() => editableOf(editor).querySelector('img')).not.toBeNull();
        expect(errors).toEqual([]);
    });

    it('lets file import offer image types in its picker once images is on', async () => {
        const editor = await fullEditor();
        const plain = await fullEditor('', '', { images: false });
        expect(editor.hasImageFileHandler).toBe(true);
        expect(plain.hasImageFileHandler).toBe(false);
    });
});

describe('links entry points', () => {
    it('opens the form from Ctrl+K and from the toolbar button', async () => {
        const editor = await fullEditor('<p>Hello world</p>');
        selectWord(editor);
        keydown(editableOf(editor), { key: 'k', ctrlKey: true });
        await flush(editor);
        expect(linkForm(editor)).not.toBeNull();

        editor.addonOptions = { ...editor.addonOptions };
        await flush(editor);
        expect(linkForm(editor)).toBeNull();
        selectWord(editor);
        buttonIn(slotIn(topBar(editor), 'links.insert')!).click();
        await flush(editor);
        expect(linkForm(editor)).not.toBeNull();
    });
});

describe('history addon with the others', () => {
    it('opens the panel from its corner button and from Ctrl+Shift+H', async () => {
        const editor = await fullEditor('<p>one</p>');
        const corner = root(editor).querySelector<HTMLElement>('[data-slot="rte-history-panel"]')!;
        const popover = root(editor).querySelector<Popover>('ge-popover')!;
        corner.querySelector('ge-button')!.click();
        await popover.updateComplete;
        expect(popover.open).toBe(true);

        popover.hide();
        await settle();
        keydown(editableOf(editor), { key: 'h', ctrlKey: true, shiftKey: true });
        await settle();
        expect(popover.open).toBe(true);
    });

    it('keeps one history entry for a color and one for a bold, so undo reverts a single step', async () => {
        const editor = await fullEditor('<p>Hello world</p>');
        selectWord(editor);
        await pickColor(editor, topBar(editor), 'foreground', '#ff0000');
        const content = editableOf(editor);
        expect(content.querySelector('span[style*="color"]')?.textContent).toBe('Hello');

        const text = content.querySelector('p')!.lastChild as Text;
        selectBetween(text, 1, text, 4);
        editor.format('bold');
        await flush(editor);
        expect(content.querySelector('b')?.textContent).toBe('wor');

        editor.undo();
        await flush(editor);
        expect(content.querySelector('b')).toBeNull();
        expect(content.querySelector('span[style*="color"]')?.textContent).toBe('Hello');

        editor.undo();
        await flush(editor);
        expect(content.querySelector('span[style*="color"]')).toBeNull();
    });
});

describe('floating toolbar with every addon', () => {
    const IDS = ['typography.size', 'typography.family', 'colors.foreground', 'colors.background', 'links.insert', 'images.insert', 'tables.insert', 'file-import.import', 'emoji.insert', 'view.outline'];

    async function floating(): Promise<GeRichTextEditor> {
        const editor = await fullEditor('<p>Hello world</p>', 'toolbar="floating"');
        selectWord(editor);
        await flush(editor);
        await expect.poll(() => bubbleBar(editor)).not.toBeNull();
        await bubbleBar(editor)!.updateComplete;
        return editor;
    }

    it('reaches every addon slot from the bubble', async () => {
        const editor = await floating();
        for (const id of IDS) expect(slotIn(bubbleBar(editor), id), id).not.toBeNull();
    });

    it('keeps the selection when the bubble closes while a color panel is open', async () => {
        const editor = await floating();
        const bar = bubbleBar(editor)!;
        const slot = slotIn(bar, 'colors.foreground')!;
        buttonIn(slot).click();
        await slot.querySelector<Popover>('ge-popover')!.updateComplete;
        await settle();

        document.getSelection()?.removeAllRanges();
        slot.querySelector('ge-color-picker')!.dispatchEvent(new CustomEvent('color-change', { detail: '#00aa00', bubbles: true, composed: true }));
        await settle();

        const span = editableOf(editor).querySelector<HTMLElement>('span[style*="color"]');
        expect(span?.textContent).toBe('Hello');
    });

    it('keeps the selection for the link form opened from the bubble', async () => {
        const editor = await floating();
        buttonIn(slotIn(bubbleBar(editor), 'links.insert')!).click();
        await flush(editor);
        document.getSelection()?.removeAllRanges();
        await flush(editor);
        const field = linkForm(editor)!.querySelector<HTMLInputElement & { value: string }>('ge-input[type="text"]')!;
        expect(field.value).toBe('Hello');
    });
});

describe('readonly and disabled', () => {
    const buttonsOf = (editor: GeRichTextEditor) =>
        [...(topBar(editor)?.shadowRoot?.querySelectorAll<HTMLElement>('[data-addon-slot]') ?? [])].map((slot) => [slot.dataset['addonSlot']!, buttonIn(slot)] as const);

    it('disables every addon button while disabled', async () => {
        const editor = await fullEditor('<p>Hello</p>');
        expect(buttonsOf(editor).length).toBeGreaterThan(5);
        editor.disabled = true;
        await flush(editor);
        await settle();
        expect(buttonsOf(editor).filter(([, button]) => !button.disabled).map(([id]) => id)).toEqual([]);
    });

    it('hides the whole toolbar, addon buttons included, while readonly', async () => {
        const editor = await fullEditor('<p>Hello</p>');
        editor.readonly = true;
        await flush(editor);
        expect(buttonsOf(editor)).toEqual([]);
    });

    it('hides the history corner while readonly and shows it again after', async () => {
        const editor = await fullEditor('<p>Hello</p>');
        const corner = () => root(editor).querySelector('[data-slot="rte-history-panel"]');
        editor.readonly = true;
        await flush(editor);
        expect(corner()).toBeNull();
        editor.readonly = false;
        await flush(editor);
        expect(corner()).not.toBeNull();
    });
});

describe('locale', () => {
    it('relabels the addon buttons and flips the direction when the locale changes', async () => {
        const editor = await fullEditor('<p>Hello</p>');
        const label = (id: string) => buttonIn(slotIn(topBar(editor), id)!).title;
        expect(label('links.insert')).toBe(RICH_TEXT_LINKS_LOCALES.en.tooltip);
        expect(root(editor).querySelector('.container')!.getAttribute('dir')).toBe('ltr');

        editor.locale = 'he';
        await flush(editor);
        await settle();
        expect(label('links.insert')).toBe(RICH_TEXT_LINKS_LOCALES.he!.tooltip);
        expect(label('view.outline')).toBe(RICH_TEXT_OUTLINE_LOCALES.he!.toolbar);
        expect(root(editor).querySelector('.container')!.getAttribute('dir')).toBe('rtl');

        editor.locale = 'en';
        await flush(editor);
        await settle();
        expect(label('links.insert')).toBe(RICH_TEXT_LINKS_LOCALES.en.tooltip);
    });
});
