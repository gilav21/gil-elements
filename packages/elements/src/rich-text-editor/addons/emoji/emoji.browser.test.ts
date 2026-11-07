import { describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createEditor, editableOf, load, placeCaret, record, selectContents } from '../../rich-text-editor.fixture.test.js';
import '../../locales/he.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import type { GeRichTextToolbar } from '../../toolbar-index.js';
import './define.js';

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const make = (setup?: (editor: GeRichTextEditor) => void): Promise<GeRichTextEditor> =>
    createEditor((editor) => {
        editor.mode = 'html';
        editor.addons = 'emoji';
        setup?.(editor);
    });

const topBar = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('.toolbar ge-rich-text-toolbar');
const bubbleBar = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<GeRichTextToolbar>('[data-slot="rich-text-floating-toolbar"] ge-rich-text-toolbar');
const slotOf = (bar: GeRichTextToolbar | null) => bar?.shadowRoot!.querySelector<HTMLElement>('[data-addon-slot="emoji.insert"]') ?? null;
const triggerOf = (bar: GeRichTextToolbar | null) => slotOf(bar)!.querySelector<HTMLButtonElement>('ge-emoji-picker-trigger button')!;
type Picker = HTMLElement & { open: boolean; selectEmoji(emoji: string): void; updateComplete: Promise<boolean> };
const pickerOf = (bar: GeRichTextToolbar | null) => slotOf(bar)!.querySelector<Picker>('ge-emoji-picker')!;

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await (topBar(editor) ?? bubbleBar(editor))?.updateComplete;
}

describe('emoji addon', () => {
    it('renders a toolbar button with the tooltip, an icon and the picker', async () => {
        const editor = await make();
        const button = triggerOf(topBar(editor));

        expect(button.title).toBe('Insert Emoji');
        expect(button.querySelector('svg')).not.toBeNull();
        expect(slotOf(topBar(editor))!.querySelector('ge-emoji-picker-content')).not.toBeNull();
    });

    it('inserts the picked emoji into the content and emits emoji-insert', async () => {
        const editor = await make();
        const inserted = record<string>(editor, 'emoji-insert');

        pickerOf(topBar(editor)).selectEmoji('🎉');
        await settle(editor);

        expect(editableOf(editor).textContent).toBe('🎉');
        expect(inserted).toEqual(['🎉']);
    });

    it('inserts at the caret saved when the picker opened, and keeps the picker open for the next pick', async () => {
        const editor = await make();
        await load(editor, '<p>ab</p>');
        placeCaret(editableOf(editor).querySelector('p')!.firstChild!, 1);

        await userEvent.click(triggerOf(topBar(editor)));
        const picker = pickerOf(topBar(editor));
        await picker.updateComplete;
        expect(picker.open).toBe(true);
        placeCaret(document.body, 0);
        picker.selectEmoji('🎈');
        await settle(editor);

        expect(editableOf(editor).textContent).toBe('a🎈b');
        expect(picker.open).toBe(true);
    });

    it('does not insert while the editor is disabled, and disables the button', async () => {
        const editor = await make();
        const inserted = record(editor, 'emoji-insert');
        const picker = pickerOf(topBar(editor));
        editor.disabled = true;
        await settle(editor);

        picker.selectEmoji('🎉');
        await settle(editor);

        expect(triggerOf(topBar(editor)).disabled).toBe(true);
        expect(editableOf(editor).textContent).toBe('');
        expect(inserted).toEqual([]);
    });

    it('removes the slot live when switched off and restores it when switched on', async () => {
        const editor = await make();
        expect(slotOf(topBar(editor))).not.toBeNull();

        editor.addonOptions = { emoji: false };
        await settle(editor);
        expect(slotOf(topBar(editor))).toBeNull();

        editor.addonOptions = { emoji: true };
        await settle(editor);
        expect(slotOf(topBar(editor))).not.toBeNull();
    });

    it('re-registers without duplicating the slot when the order changes', async () => {
        const editor = await make((el) => {
            el.addonOptions = { emoji: { order: 400 } };
        });
        editor.addonOptions = { emoji: { order: 100 } };
        await settle(editor);

        expect(editor.toolbarSlots.slots).toHaveLength(1);
        expect(editor.toolbarSlots.slots[0]!.order).toBe(100);
        const inserted = record<string>(editor, 'emoji-insert');
        pickerOf(topBar(editor)).selectEmoji('🎈');
        await settle(editor);
        expect(inserted).toEqual(['🎈']);
    });

    it('has no button with toolbar: false', async () => {
        const editor = await make((el) => {
            el.addonOptions = { emoji: { toolbar: false } };
        });
        expect(editor.toolbarSlots.slots).toHaveLength(0);
    });

    it('joins the toolbar single-open group: opening it closes the other panels, and the group closes it', async () => {
        const editor = await make();
        let closedOthers = 0;
        const other = editor.registerExclusivePopover(() => closedOthers++);
        await userEvent.click(triggerOf(topBar(editor)));
        const picker = pickerOf(topBar(editor));
        await picker.updateComplete;
        expect(picker.open).toBe(true);
        expect(closedOthers).toBe(1);

        other.notifyOpened();
        await picker.updateComplete;
        expect(picker.open).toBe(false);
        expect(closedOthers).toBe(1);
    });

    it('draws the panel in the top layer', async () => {
        const editor = await make();
        await userEvent.click(triggerOf(topBar(editor)));
        await wait(50);

        const panel = slotOf(topBar(editor))!.querySelector('ge-emoji-picker-content')!.shadowRoot!.querySelector<HTMLElement>('.panel')!;
        expect(panel.matches(':popover-open')).toBe(true);
    });

    describe('locale', () => {
        it('follows the editor locale', async () => {
            const editor = await make((el) => {
                el.locale = 'he';
            });
            expect(triggerOf(topBar(editor)).title).toBe("הוספת אמוג'י");
            expect(topBar(editor)!.shadowRoot!.querySelector<HTMLButtonElement>('button[data-toolbar-item="bold"]')!.title).toContain('מודגש');
        });

        it('lets the addon locale option win over the editor locale', async () => {
            const editor = await make((el) => {
                el.locale = 'he';
                el.addonOptions = { emoji: { locale: 'en' } };
            });
            expect(triggerOf(topBar(editor)).title).toBe('Insert Emoji');
        });

        it('re-localizes when the editor locale changes at runtime', async () => {
            const editor = await make();
            expect(triggerOf(topBar(editor)).title).toBe('Insert Emoji');

            editor.locale = 'he';
            await settle(editor);
            expect(triggerOf(topBar(editor)).title).toBe("הוספת אמוג'י");
        });
    });

    describe('toolbar sizing and floating bubble', () => {
        it('tightens the button padding in the compact bubble, which keeps the picker and the selection', async () => {
            const editor = await make((el) => {
                el.toolbar = 'floating';
            });
            await load(editor, '<p>Hello world</p>');
            selectContents(editableOf(editor).querySelector('p')!);
            editableOf(editor).dispatchEvent(new Event('mouseup', { bubbles: true }));
            await settle(editor);

            expect(getComputedStyle(triggerOf(bubbleBar(editor))).paddingLeft).toBe('4px');

            await userEvent.click(triggerOf(bubbleBar(editor)));
            await wait(400);
            expect(bubbleBar(editor)).not.toBeNull();
            expect(pickerOf(bubbleBar(editor)).open).toBe(true);
            pickerOf(bubbleBar(editor)).selectEmoji('🎉');
            await settle(editor);
            expect(editableOf(editor).textContent).toContain('🎉');
        });

        it('uses the regular padding in the top toolbar', async () => {
            const editor = await make();
            expect(getComputedStyle(triggerOf(topBar(editor))).paddingLeft).toBe('6px');
        });
    });
});
