import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createEditor, editableOf, load, record, selectContents } from '../../rich-text-editor.fixture.test.js';
import '../../locales/he.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import type { GeRichTextToolbar } from '../../toolbar-index.js';
import './define.js';
import { DEFAULT_FONT_FAMILIES } from './typography.js';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type Kind = 'size' | 'family';
const SLOT: Record<Kind, string> = { size: 'typography.size', family: 'typography.family' };

const make = (options: Record<string, unknown> | boolean = true, setup?: (editor: GeRichTextEditor) => void): Promise<GeRichTextEditor> =>
    createEditor((editor) => {
        editor.mode = 'html';
        editor.addons = 'typography';
        editor.addonOptions = { typography: options as never };
        setup?.(editor);
    });

const topBar = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('.toolbar ge-rich-text-toolbar');
const bubbleBar = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('[data-slot="rich-text-floating-toolbar"] ge-rich-text-toolbar');
const slotOf = (bar: GeRichTextToolbar | null, kind: Kind) => bar?.shadowRoot!.querySelector<HTMLElement>(`[data-addon-slot="${SLOT[kind]}"]`) ?? null;
const triggerOf = (bar: GeRichTextToolbar | null, kind: Kind) => slotOf(bar, kind)!.querySelector<HTMLButtonElement>('ge-popover-trigger button')!;
const popoverOf = (bar: GeRichTextToolbar | null, kind: Kind) => slotOf(bar, kind)!.querySelector('ge-popover')!;
type Field = HTMLElement & { options: readonly string[]; value: string; noFilter: boolean; placeholder: string };
const fieldOf = (bar: GeRichTextToolbar | null, kind: Kind) => slotOf(bar, kind)!.querySelector<Field>('ge-autocomplete');

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await (topBar(editor) ?? bubbleBar(editor))?.updateComplete;
}

async function open(editor: GeRichTextEditor, kind: Kind, bar = topBar(editor)): Promise<void> {
    if (!popoverOf(bar, kind).open) triggerOf(bar, kind).click();
    await popoverOf(bar, kind).updateComplete;
    await wait(0);
}

/** Opens the panel and reports a pick the way the autocomplete does. */
async function pick(editor: GeRichTextEditor, kind: Kind, value: string): Promise<void> {
    await open(editor, kind);
    fieldOf(topBar(editor), kind)!.dispatchEvent(new CustomEvent('value-change', { detail: value, bubbles: true, composed: true }));
    await settle(editor);
}

async function withSelection(html: string): Promise<GeRichTextEditor> {
    const editor = await make();
    await load(editor, html);
    const target = editableOf(editor).querySelector('span') ?? editableOf(editor).firstElementChild!;
    selectContents(target);
    editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
    await settle(editor);
    return editor;
}

const spans = (editor: GeRichTextEditor) => [...editableOf(editor).querySelectorAll('span')];

describe('typography addon', () => {
    it('contributes both buttons, removes them when switched off and restores them when switched on', async () => {
        const editor = await make();
        expect(triggerOf(topBar(editor), 'size').title).toBe('Font Size');
        expect(triggerOf(topBar(editor), 'family').title).toBe('Font Family');

        editor.addonOptions = { typography: false };
        await settle(editor);
        expect(slotOf(topBar(editor), 'size')).toBeNull();
        expect(slotOf(topBar(editor), 'family')).toBeNull();

        editor.addonOptions = { typography: true };
        await settle(editor);
        expect(slotOf(topBar(editor), 'size')).not.toBeNull();
    });

    it('orders the size button at the option and the family button right after it', async () => {
        const editor = await make({ order: 50 });
        expect(editor.toolbarSlots.slots.map((slot) => [slot.id, slot.order])).toEqual([['typography.size', 50], ['typography.family', 51]]);
    });

    it('has no buttons with toolbar: false', async () => {
        const editor = await make({ toolbar: false });
        expect(editor.toolbarSlots.slots).toHaveLength(0);
    });

    describe('applying', () => {
        it('applies a font size to the selection as a styled span and emits font-size-select', async () => {
            const editor = await withSelection('<p>Resize me</p>');
            const sizes = record<string>(editor, 'font-size-select');

            await pick(editor, 'size', '24px');

            expect(editableOf(editor).querySelectorAll('font[size="7"]')).toHaveLength(0);
            expect(spans(editor).some((span) => span.style.fontSize === '24px')).toBe(true);
            expect(sizes).toEqual(['24']);
        });

        it('applies a font family to the selection as a styled span and emits font-family-select', async () => {
            const editor = await withSelection('<p>Restyle me</p>');
            const families = record<string>(editor, 'font-family-select');

            await pick(editor, 'family', 'Georgia');

            expect(editableOf(editor).querySelectorAll('font[face]')).toHaveLength(0);
            expect(spans(editor).some((span) => span.style.fontFamily.includes('Georgia'))).toBe(true);
            expect(families).toEqual(['Georgia']);
        });

        it('restyles the same text on a second pick from the still-open panel', async () => {
            const editor = await withSelection('<p>Resize me</p>');

            await pick(editor, 'size', '24px');
            await pick(editor, 'size', '32px');

            const sizes = spans(editor).map((span) => span.style.fontSize).filter(Boolean);
            expect(sizes).toContain('32px');
            expect(sizes).not.toContain('24px');
            expect(editableOf(editor).textContent).toContain('Resize me');
        });

        it('styles mention chips in the selection that the browser command skips', async () => {
            const editor = await withSelection('<p><span data-mention="1" contenteditable="false">@ada</span> hi</p>');
            selectContents(editableOf(editor).querySelector('p')!);

            await pick(editor, 'size', '30px');

            expect(editableOf(editor).querySelector<HTMLElement>('[data-mention]')!.style.fontSize).toBe('30px');
        });

        it('ignores an empty font family', async () => {
            const editor = await withSelection('<p>Keep me</p>');
            const before = editableOf(editor).innerHTML;
            const families = record(editor, 'font-family-select');

            await pick(editor, 'family', '');

            expect(editableOf(editor).innerHTML).toBe(before);
            expect(families).toEqual([]);
        });

        it('ignores a font size with no digits', async () => {
            const editor = await withSelection('<p>Keep me</p>');
            const before = editableOf(editor).innerHTML;
            const sizes = record(editor, 'font-size-select');

            await pick(editor, 'size', 'abc');

            expect(editableOf(editor).innerHTML).toBe(before);
            expect(sizes).toEqual([]);
        });

        it('does not apply while the editor is disabled, and disables the buttons', async () => {
            const editor = await withSelection('<p>Locked</p>');
            await open(editor, 'size');
            const field = fieldOf(topBar(editor), 'size')!;
            const before = editableOf(editor).innerHTML;
            const sizes = record(editor, 'font-size-select');
            editor.disabled = true;
            await settle(editor);

            field.dispatchEvent(new CustomEvent('value-change', { detail: '24px', bubbles: true, composed: true }));
            await settle(editor);

            expect(triggerOf(topBar(editor), 'size').disabled).toBe(true);
            expect(editableOf(editor).innerHTML).toBe(before);
            expect(sizes).toEqual([]);
        });

        it('applies a size chosen from the list with the mouse', async () => {
            const editor = await withSelection('<p>Click me</p>');
            await open(editor, 'size');

            const field = fieldOf(topBar(editor), 'size')!;
            await userEvent.click(field.shadowRoot!.querySelector('input')!);
            await wait(100);
            const option = [...field.shadowRoot!.querySelectorAll<HTMLElement>('ge-command-item')].find((el) => el.textContent?.trim() === '20px');
            await userEvent.click(option!);
            await settle(editor);

            expect(spans(editor).some((span) => span.style.fontSize === '20px')).toBe(true);
        });
    });

    describe('seeding', () => {
        it('seeds the size field from the current selection when the panel opens', async () => {
            const editor = await withSelection('<p><span style="font-size:20px">Sized</span></p>');
            await open(editor, 'size');
            expect(fieldOf(topBar(editor), 'size')!.value).toBe('20px');
        });

        it('seeds the family field from the current selection when the panel opens', async () => {
            const editor = await withSelection('<p><span style="font-family:Georgia">Styled</span></p>');
            await open(editor, 'family');
            expect(fieldOf(topBar(editor), 'family')!.value).toBe('Georgia');
        });

        it('renders the field only while a panel is open', async () => {
            const editor = await withSelection('<p>Font</p>');
            expect(fieldOf(topBar(editor), 'size')).toBeNull();

            await open(editor, 'size');
            const field = fieldOf(topBar(editor), 'size')!;
            expect(field).not.toBeNull();
            expect(field.noFilter).toBe(true);
            expect(field.options).toHaveLength(33);
            expect(field.placeholder).toBe('Select size');
            expect(fieldOf(topBar(editor), 'family')).toBeNull();
        });
    });

    describe('families option', () => {
        const familiesOf = async (options: Record<string, unknown>) => {
            const editor = await make(options);
            await open(editor, 'family');
            const field = fieldOf(topBar(editor), 'family')!;
            expect(field.noFilter).toBe(false);
            return field.options;
        };

        it('appends custom fonts to the defaults by default', async () => {
            expect(await familiesOf({ families: ['Roboto', 'Open Sans'] })).toEqual([...DEFAULT_FONT_FAMILIES, 'Roboto', 'Open Sans']);
        });

        it('appends with the append strategy', async () => {
            expect(await familiesOf({ families: ['Roboto'], familiesStrategy: 'append' })).toEqual([...DEFAULT_FONT_FAMILIES, 'Roboto']);
        });

        it('replaces the defaults with the replace strategy', async () => {
            expect(await familiesOf({ families: ['Roboto', 'Open Sans'], familiesStrategy: 'replace' })).toEqual(['Roboto', 'Open Sans']);
        });

        it('keeps the defaults for an empty custom list', async () => {
            expect(await familiesOf({ families: [], familiesStrategy: 'replace' })).toEqual(DEFAULT_FONT_FAMILIES);
        });
    });

    describe('locale', () => {
        it('localizes the tooltips from the editor locale (he)', async () => {
            const editor = await make(true, (el) => {
                el.locale = 'he';
            });
            expect(triggerOf(topBar(editor), 'size').title).toBe('גודל גופן');
            expect(triggerOf(topBar(editor), 'family').title).toBe('משפחת גופנים');
        });

        it('lets the addon locale option win', async () => {
            const editor = await make({ locale: 'de' }, (el) => {
                el.locale = 'he';
            });
            expect(triggerOf(topBar(editor), 'size').title).toBe('Schriftgröße');
        });

        it('localizes the panel heading and placeholder', async () => {
            const editor = await make({ locale: 'de' });
            await open(editor, 'family');
            expect(slotOf(topBar(editor), 'family')!.querySelector('.rte-typography-heading')!.textContent).toBe('Schriftart wählen');
            expect(fieldOf(topBar(editor), 'family')!.placeholder).toBe('Schriftarten suchen...');
        });
    });

    it('removes its toolbar slots when the addon goes away', async () => {
        const editor = await make();
        expect(editor.toolbarSlots.slots).toHaveLength(2);

        editor.addons = '';
        await editor.updateComplete;
        expect(editor.toolbarSlots.slots).toHaveLength(0);
    });

    it('opens one panel at a time', async () => {
        const editor = await withSelection('<p>Font</p>');
        await open(editor, 'size');
        await open(editor, 'family');
        await wait(0);

        expect(popoverOf(topBar(editor), 'family').open).toBe(true);
        expect(popoverOf(topBar(editor), 'size').open).toBe(false);
    });

    describe('toolbar="floating"', () => {
        it('offers both buttons in the bubble, whose panel keeps the selection to style', async () => {
            const editor = await make(true, (el) => {
                el.toolbar = 'floating';
            });
            await load(editor, '<p>Hello world</p>');
            selectContents(editableOf(editor).querySelector('p')!);
            editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
            await settle(editor);
            const bar = bubbleBar(editor);
            expect(slotOf(bar, 'family')).not.toBeNull();

            await userEvent.click(triggerOf(bar, 'size'));
            await wait(400);
            expect(bubbleBar(editor)).toBe(bar);
            expect(popoverOf(bar, 'size').open).toBe(true);
            fieldOf(bar, 'size')!.dispatchEvent(new CustomEvent('value-change', { detail: '28px', bubbles: true, composed: true }));
            await settle(editor);

            expect(spans(editor).some((span) => span.style.fontSize === '28px')).toBe(true);
        });
    });
});
