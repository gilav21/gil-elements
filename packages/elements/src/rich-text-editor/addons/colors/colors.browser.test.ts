import { describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createEditor, editableOf, load, placeCaret, record, selectContents } from '../../rich-text-editor.fixture.test.js';
import '../../locales/he.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import type { GeRichTextToolbar } from '../../toolbar-index.js';
import './define.js';
import type { RichTextColorChange } from './colors.js';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Kind = 'foreground' | 'background';
const SLOT: Record<Kind, string> = { foreground: 'colors.foreground', background: 'colors.background' };

const make = (options: Record<string, unknown> | boolean = true, setup?: (editor: GeRichTextEditor) => void): Promise<GeRichTextEditor> =>
    createEditor((editor) => {
        editor.mode = 'html';
        editor.addons = 'colors';
        editor.addonOptions = { colors: options as never };
        setup?.(editor);
    });

const topBar = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('.toolbar ge-rich-text-toolbar');
const bubbleBar = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('[data-slot="rich-text-floating-toolbar"] ge-rich-text-toolbar');
const slotOf = (bar: GeRichTextToolbar | null, kind: Kind) => bar?.shadowRoot!.querySelector<HTMLElement>(`[data-addon-slot="${SLOT[kind]}"]`) ?? null;
const triggerOf = (bar: GeRichTextToolbar | null, kind: Kind) => slotOf(bar, kind)!.querySelector<HTMLButtonElement>('ge-popover-trigger button')!;
const popoverOf = (bar: GeRichTextToolbar | null, kind: Kind) => slotOf(bar, kind)!.querySelector('ge-popover')!;
const indicatorOf = (bar: GeRichTextToolbar | null, kind: Kind) => slotOf(bar, kind)!.querySelector<HTMLElement>('[data-slot="rte-color-indicator"]')!;
type Picker = HTMLElement & { value: string; alpha: boolean; showRecent: boolean; presets: string[]; inline: boolean };
const pickerOf = (bar: GeRichTextToolbar | null, kind: Kind) => slotOf(bar, kind)!.querySelector<Picker>('ge-color-picker');

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await (topBar(editor) ?? bubbleBar(editor))?.updateComplete;
}

async function open(editor: GeRichTextEditor, kind: Kind, bar = topBar(editor)): Promise<void> {
    if (!popoverOf(bar, kind).open) triggerOf(bar, kind).click();
    await popoverOf(bar, kind).updateComplete;
    await wait(0);
}

const close = async (editor: GeRichTextEditor, kind: Kind): Promise<void> => {
    popoverOf(topBar(editor), kind).hide();
    await wait(20);
};

/** Opens the panel and reports a pick the way the picker does. */
async function pick(editor: GeRichTextEditor, kind: Kind, color: string): Promise<void> {
    await open(editor, kind);
    pickerOf(topBar(editor), kind)!.dispatchEvent(new CustomEvent('color-change', { detail: color, bubbles: true, composed: true }));
    await settle(editor);
}

async function withSelection(html: string, make_ = make): Promise<GeRichTextEditor> {
    const editor = await make_();
    await load(editor, html);
    selectContents(editableOf(editor).querySelector('span') ?? editableOf(editor).querySelector('p')!);
    editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
    await settle(editor);
    return editor;
}

async function withCaret(): Promise<GeRichTextEditor> {
    const editor = await make();
    await load(editor, '<p>hello world</p>');
    placeCaret(editableOf(editor).querySelector('p')!.firstChild!, 3);
    return editor;
}

describe('colors addon', () => {
    it('contributes both buttons, removes them when switched off and restores them when switched on', async () => {
        const editor = await make();
        expect(slotOf(topBar(editor), 'foreground')).not.toBeNull();
        expect(slotOf(topBar(editor), 'background')).not.toBeNull();

        editor.addonOptions = { colors: false };
        await settle(editor);
        expect(slotOf(topBar(editor), 'foreground')).toBeNull();
        expect(slotOf(topBar(editor), 'background')).toBeNull();

        editor.addonOptions = { colors: true };
        await settle(editor);
        expect(slotOf(topBar(editor), 'foreground')).not.toBeNull();
    });

    it('renders buttons with the localized tooltip and an icon', async () => {
        const editor = await make();
        expect(triggerOf(topBar(editor), 'foreground').title).toBe('Text Color');
        expect(triggerOf(topBar(editor), 'foreground').querySelector('svg')).not.toBeNull();
        expect(triggerOf(topBar(editor), 'background').title).toBe('Background Color');
    });

    it('orders the text button at the option and the highlight button right after it', async () => {
        const editor = await make({ order: 40 });
        expect(editor.toolbarSlots.slots.map((slot) => [slot.id, slot.order])).toEqual([['colors.foreground', 40], ['colors.background', 41]]);
    });

    it('has no buttons with toolbar: false', async () => {
        const editor = await make({ toolbar: false });
        expect(editor.toolbarSlots.slots).toHaveLength(0);
    });

    describe('options', () => {
        it('offers no opacity slider and no recent row by default', async () => {
            const editor = await make();
            for (const kind of ['foreground', 'background'] as const) {
                await open(editor, kind);
                expect(pickerOf(topBar(editor), kind)!.alpha).toBe(false);
                expect(pickerOf(topBar(editor), kind)!.showRecent).toBe(false);
                await close(editor, kind);
            }
        });

        it('offers the opacity slider on the highlight picker only, and the recent row on both, when opted in', async () => {
            const editor = await make({ alpha: true, recent: true });
            await open(editor, 'background');
            expect(pickerOf(topBar(editor), 'background')!.alpha).toBe(true);
            expect(pickerOf(topBar(editor), 'background')!.showRecent).toBe(true);
            await close(editor, 'background');
            await open(editor, 'foreground');
            expect(pickerOf(topBar(editor), 'foreground')!.alpha).toBe(false);
            expect(pickerOf(topBar(editor), 'foreground')!.showRecent).toBe(true);
        });

        it('passes the palettes to the pickers', async () => {
            const editor = await make({ palette: ['#111111'], highlightPalette: ['#222222', '#333333'] });
            await open(editor, 'foreground');
            expect(pickerOf(topBar(editor), 'foreground')!.presets).toEqual(['#111111']);
            await close(editor, 'foreground');
            await open(editor, 'background');
            expect(pickerOf(topBar(editor), 'background')!.presets).toEqual(['#222222', '#333333']);
        });
    });

    describe('applying', () => {
        it('applies a text colour to the selection as an inline style, emits color-change and shows it in the indicator', async () => {
            const editor = await withSelection('<p>Recolour me</p>');
            const changes = record<RichTextColorChange>(editor, 'color-change');

            await pick(editor, 'foreground', '#ff0000');

            const html = editableOf(editor).innerHTML;
            expect(html.toLowerCase()).not.toContain('<font');
            expect(html).toContain('rgb(255, 0, 0)');
            expect(changes).toEqual([{ type: 'fontColor', color: '#ff0000' }]);
            expect(indicatorOf(topBar(editor), 'foreground').style.backgroundColor).toBe('rgb(255, 0, 0)');
        });

        it('applies a highlight colour to the selection and emits color-change', async () => {
            const editor = await withSelection('<p>Highlight me</p>');
            const changes = record<RichTextColorChange>(editor, 'color-change');

            await pick(editor, 'background', '#00ff00');

            expect(editableOf(editor).innerHTML.toLowerCase()).toMatch(/background|rgb\(0,\s*255/);
            expect(changes).toEqual([{ type: 'backgroundColor', color: '#00ff00' }]);
            expect(indicatorOf(topBar(editor), 'background').style.backgroundColor).toBe('rgb(0, 255, 0)');
        });

        it('styles mention chips in the selection that the browser command skips', async () => {
            const editor = await withSelection('<p><span data-mention="1" contenteditable="false">@ada</span> hi</p>');
            selectContents(editableOf(editor).querySelector('p')!);

            await pick(editor, 'foreground', '#123456');

            expect(editableOf(editor).querySelector<HTMLElement>('[data-mention]')!.style.color).toMatch(/rgb\(18,\s*52,\s*86\)|#123456/);
        });

        it('ignores a pick that only echoes the colour already reflected', async () => {
            const editor = await withSelection('<p><span style="color:#2563eb">Blue</span></p>');
            const before = editableOf(editor).innerHTML;
            const changes = record(editor, 'color-change');

            await pick(editor, 'foreground', 'rgb(37, 99, 235)');

            expect(editableOf(editor).innerHTML).toBe(before);
            expect(changes).toEqual([]);
        });

        it('applies nothing from merely opening a panel', async () => {
            const editor = await withSelection('<p>Open only</p>');
            const apply = vi.spyOn(editor, 'applyInlineStyle');
            const changes = record(editor, 'color-change');

            await open(editor, 'background');
            await wait(100);

            expect(apply).not.toHaveBeenCalled();
            expect(changes).toEqual([]);
        });

        it('does not apply while the editor is disabled, and disables the buttons', async () => {
            const editor = await withSelection('<p>Locked</p>');
            await open(editor, 'foreground');
            const picker = pickerOf(topBar(editor), 'foreground')!;
            const apply = vi.spyOn(editor, 'applyInlineStyle');
            editor.disabled = true;
            await settle(editor);

            picker.dispatchEvent(new CustomEvent('color-change', { detail: '#ff0000', bubbles: true, composed: true }));

            expect(triggerOf(topBar(editor), 'foreground').disabled).toBe(true);
            expect(apply).not.toHaveBeenCalled();
        });
    });

    describe('seeding and the indicator', () => {
        it('seeds the picker from the current selection colour when the panel opens', async () => {
            const editor = await withSelection('<p><span style="color:#2563eb">Blue</span></p>');
            await open(editor, 'foreground');
            expect(pickerOf(topBar(editor), 'foreground')!.value).toBe('#2563eb');
        });

        it('builds the inline picker only while a panel is open', async () => {
            const editor = await withSelection('<p>Colour</p>');
            expect(pickerOf(topBar(editor), 'foreground')).toBeNull();

            await open(editor, 'foreground');
            expect(pickerOf(topBar(editor), 'foreground')!.inline).toBe(true);

            await close(editor, 'foreground');
            expect(pickerOf(topBar(editor), 'foreground')).toBeNull();
        });

        it('tracks the selection colour in the indicator without opening the panel', async () => {
            const editor = await withSelection('<p><span style="color:#2563eb">Blue</span></p>');
            expect(indicatorOf(topBar(editor), 'foreground').style.backgroundColor).toBe('rgb(37, 99, 235)');
            expect(indicatorOf(topBar(editor), 'foreground').hasAttribute('data-empty')).toBe(false);
        });

        it('keeps the tooltip stable as the colour changes', async () => {
            const editor = await withSelection('<p><span style="color:#2563eb">Blue</span></p>');
            expect(triggerOf(topBar(editor), 'foreground').title).toBe('Text Color');
        });

        it('falls back to a muted indicator when no highlight is in effect', async () => {
            const editor = await withSelection('<p>Plain</p>');
            const bar = indicatorOf(topBar(editor), 'background');
            expect(bar.style.backgroundColor).toBe('');
            expect(bar.dataset['empty']).toBe('background');
        });

        it('falls back to the editor foreground when no text colour is reflected', async () => {
            const editor = await make();
            const bar = indicatorOf(topBar(editor), 'foreground');
            editor.getSelection()?.removeAllRanges();
            editor.invalidate();
            expect(bar.dataset['empty'] ?? 'foreground').toBe('foreground');
        });
    });

    describe('closing a panel', () => {
        it('re-applies a caret colour when the panel closes, so a pending typing style survives', async () => {
            const editor = await withCaret();
            const apply = vi.spyOn(editor, 'applyInlineStyle');

            await pick(editor, 'background', '#ff0000');
            expect(apply).toHaveBeenCalledTimes(1);
            await close(editor, 'background');

            expect(apply).toHaveBeenCalledTimes(2);
            expect(apply).toHaveBeenLastCalledWith({ backgroundColor: '#ff0000' });
        });

        it('re-applies a caret text colour too', async () => {
            const editor = await withCaret();
            const apply = vi.spyOn(editor, 'applyInlineStyle');

            await pick(editor, 'foreground', '#2563eb');
            await close(editor, 'foreground');

            expect(apply).toHaveBeenLastCalledWith({ color: '#2563eb' });
        });

        it('does not re-apply when the panel closes without a pick', async () => {
            const editor = await withCaret();
            const apply = vi.spyOn(editor, 'applyInlineStyle');

            await open(editor, 'background');
            await close(editor, 'background');

            expect(apply).not.toHaveBeenCalled();
        });

        it('forgets the previous pick when the panel is reopened', async () => {
            const editor = await withCaret();
            await pick(editor, 'background', '#ff0000');
            await close(editor, 'background');
            const apply = vi.spyOn(editor, 'applyInlineStyle');

            await open(editor, 'background');
            await close(editor, 'background');

            expect(apply).not.toHaveBeenCalled();
        });

        it('does not re-apply over a selection, where the colour is already in the DOM', async () => {
            const editor = await withSelection('<p>ranged text</p>');
            const apply = vi.spyOn(editor, 'applyInlineStyle');

            await pick(editor, 'background', '#ff0000');
            await close(editor, 'background');

            expect(apply).toHaveBeenCalledTimes(1);
        });

        it('puts the editor selection back after the panel was dismissed', async () => {
            const editor = await withCaret();
            await open(editor, 'foreground');
            placeCaret(document.body, 0);

            await close(editor, 'foreground');

            expect(editableOf(editor).contains(document.getSelection()!.anchorNode)).toBe(true);
        });
    });

    describe('locale', () => {
        it('localizes the tooltips from the editor locale (he)', async () => {
            const editor = await make(true, (el) => {
                el.locale = 'he';
            });
            expect(triggerOf(topBar(editor), 'foreground').title).toBe('צבע טקסט');
            expect(triggerOf(topBar(editor), 'background').title).toBe('צבע רקע');
        });

        it('uses the highlight heading for the highlight panel', async () => {
            const editor = await make({ locale: 'de' });
            await open(editor, 'background');
            expect(slotOf(topBar(editor), 'background')!.querySelector('.rte-colors-heading')!.textContent).toBe('Hervorhebungsfarbe');
        });
    });

    describe('sizing', () => {
        it('tightens the button padding in the compact bubble and keeps the indicator inside the 16px icon box', async () => {
            const editor = await make(true, (el) => {
                el.toolbar = 'floating';
            });
            await load(editor, '<p>Hello world</p>');
            selectContents(editableOf(editor).querySelector('p')!);
            editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
            await settle(editor);
            const bar = bubbleBar(editor);

            expect(getComputedStyle(triggerOf(bar, 'background')).paddingLeft).toBe('4px');
            const box = getComputedStyle(indicatorOf(bar, 'foreground').parentElement!);
            expect([box.width, box.height]).toEqual(['16px', '16px']);
            expect(getComputedStyle(indicatorOf(bar, 'foreground')).height).toBe('3px');
        });

        it('uses the regular padding in the top toolbar', async () => {
            const editor = await make();
            expect(getComputedStyle(triggerOf(topBar(editor), 'background')).paddingLeft).toBe('6px');
        });
    });

    describe('toolbar="floating"', () => {
        it('keeps the selection while a bubble panel is open, and colours it', async () => {
            const editor = await make(true, (el) => {
                el.toolbar = 'floating';
            });
            await load(editor, '<p>Hello world</p>');
            selectContents(editableOf(editor).querySelector('p')!);
            editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
            await settle(editor);
            const bar = bubbleBar(editor);

            await userEvent.click(triggerOf(bar, 'foreground'));
            await wait(400);
            expect(bubbleBar(editor)).toBe(bar);
            expect(popoverOf(bar, 'foreground').open).toBe(true);
            pickerOf(bar, 'foreground')!.dispatchEvent(new CustomEvent('color-change', { detail: '#ff0000', bubbles: true, composed: true }));
            await settle(editor);

            expect(editableOf(editor).innerHTML).toContain('rgb(255, 0, 0)');
            expect(editableOf(editor).textContent).toBe('Hello world');
        });
    });

    it('opens one panel at a time', async () => {
        const editor = await withSelection('<p>Colour</p>');
        await open(editor, 'foreground');
        await open(editor, 'background');
        await wait(0);

        expect(popoverOf(topBar(editor), 'background').open).toBe(true);
        expect(popoverOf(topBar(editor), 'foreground').open).toBe(false);
    });

    it('removes its toolbar slots when the addon goes away', async () => {
        const editor = await make();
        expect(editor.toolbarSlots.slots).toHaveLength(2);

        editor.addons = '';
        await editor.updateComplete;
        expect(editor.toolbarSlots.slots).toHaveLength(0);
    });
});
