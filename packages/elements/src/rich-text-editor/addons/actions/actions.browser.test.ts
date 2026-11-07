import type { LitElement } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { createEditor, editableOf, load, record, selectBetween } from '../../rich-text-editor.fixture.test.js';
import type { GeRichTextEditor } from '../../rich-text-editor.js';
import './define.js';
import { ActionsController, type RichTextActionsOptions } from './actions.js';
import { RICH_TEXT_ACTIONS_LOCALES } from './actions-locale.js';
import type { ActionParams, RichTextActionDefinition, RichTextActionTrigger } from './actions-types.js';

const OPEN_DIALOG: RichTextActionDefinition = {
    id: 'open-dialog', label: 'Open dialog', triggers: ['click'],
    fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }],
};

interface Attached { actionId: string; trigger: string; params: ActionParams; targetKind: string }

const toolbarOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector('ge-rich-text-toolbar');
const attachSlot = (editor: GeRichTextEditor) => toolbarOf(editor)?.shadowRoot!.querySelector<HTMLButtonElement>('[data-addon-slot="actions.attach"]') ?? null;
const dialogOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<HTMLElement>('[data-slot="rich-text-actions-dialog"]');
const popoverOf = (editor: GeRichTextEditor) => editor.shadowRoot!.querySelector<HTMLElement>('[data-slot="rich-text-actions-popover"]');
const inDialog = <T extends Element>(editor: GeRichTextEditor, selector: string) => dialogOf(editor)!.querySelector<T>(selector)!;
const inPopover = <T extends Element>(editor: GeRichTextEditor, selector: string) => popoverOf(editor)!.querySelector<T>(selector)!;

async function settle(editor: GeRichTextEditor): Promise<void> {
    await editor.updateComplete;
    await (toolbarOf(editor) as LitElement | null)?.updateComplete;
    await editor.updateComplete;
}

async function actionsEditor(
    definitions: RichTextActionDefinition[] = [OPEN_DIALOG],
    options: Partial<RichTextActionsOptions> = {},
    setup?: (editor: GeRichTextEditor) => void,
): Promise<GeRichTextEditor> {
    return createEditor((el) => {
        el.mode = 'html';
        el.addons = 'actions';
        el.addonOptions = { actions: { definitions, ...options } };
        setup?.(el);
    });
}

function selectText(editor: GeRichTextEditor, start: number, end: number): void {
    const text = editableOf(editor).querySelector('p')!.firstChild!;
    selectBetween(text, start, text, end);
    editableOf(editor).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
}

/** Loads `<p>go</p>`, selects it and opens the attach dialog. */
async function attachFirstAction(editor: GeRichTextEditor): Promise<HTMLElement> {
    await load(editor, '<p>go</p>');
    selectText(editor, 0, 2);
    await settle(editor);
    attachSlot(editor)!.click();
    await settle(editor);
    return editableOf(editor);
}

async function pick(editor: GeRichTextEditor, id: string): Promise<void> {
    inDialog<HTMLButtonElement>(editor, `[data-action-option="${id}"]`).click();
    await settle(editor);
}

async function typeField(editor: GeRichTextEditor, key: string, value: string): Promise<void> {
    const input = inDialog<HTMLInputElement>(editor, `input[data-field="${key}"]`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle(editor);
}

async function confirm(editor: GeRichTextEditor): Promise<void> {
    inDialog<HTMLElement>(editor, '[data-testid="rta-confirm"]').click();
    await settle(editor);
}

/** Loads `html` and puts the caret at the start of its first span, as a click would. */
async function caretInside(editor: GeRichTextEditor, html: string): Promise<HTMLElement> {
    await load(editor, html);
    const span = editableOf(editor).querySelector('span')!;
    const range = new Range();
    range.selectNodeContents(span.firstChild ?? span);
    range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
    editableOf(editor).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await settle(editor);
    return editableOf(editor);
}

/** Collects `[rich-text-actions]` diagnostics as argument lists while `body` runs. */
async function collectActionErrors(body: () => Promise<void>): Promise<unknown[][]> {
    const errors: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => {
        if (String(args[0]).startsWith('[rich-text-actions]')) errors.push(args);
    };
    try {
        await body();
    } finally {
        console.error = original;
    }
    return errors;
}

afterEach(() => {
    document.getSelection()?.removeAllRanges();
});

describe('actions addon', () => {
    it('registers nothing when defs are empty', async () => {
        const editor = await actionsEditor([]);
        expect(editor.sanitizer.sanitize('<span data-action-click="a">x</span>')).toBe('<span>x</span>');
        expect(attachSlot(editor)).toBeNull();
        expect(editor.commands.listCommands().some((c) => c.id === 'actions.attach')).toBe(false);
    });

    it('removes its sanitizer rules when the editor is removed', async () => {
        const editor = await actionsEditor();
        const { sanitizer } = editor;
        expect(sanitizer.sanitize('<span data-action-click="open-dialog">x</span>')).toBe('<span data-action-click="open-dialog">x</span>');

        editor.remove();
        expect(sanitizer.sanitize('<span data-action-click="open-dialog">x</span>')).toBe('<span>x</span>');
    });

    it('is switched off by addonOptions.actions === false', async () => {
        const editor = await createEditor((el) => {
            el.addons = 'actions';
            el.addonOptions = { actions: false };
        });
        expect(attachSlot(editor)).toBeNull();
    });

    it('attaches a click action to a text selection and fires action-attached', async () => {
        const editor = await actionsEditor();
        await load(editor, '<p>hello world</p>');
        selectText(editor, 0, 5);
        await settle(editor);
        expect(attachSlot(editor)!.disabled).toBe(false);
        const attached = record<Attached>(editor, 'action-attached');

        attachSlot(editor)!.click();
        await settle(editor);
        await pick(editor, 'open-dialog');
        await typeField(editor, 'dialogId', 'pricing');
        await confirm(editor);

        const span = editableOf(editor).querySelector('span[data-action-click="open-dialog"]');
        expect(span?.getAttribute('data-action-click-params')).toBe('{"dialogId":"pricing"}');
        expect(span?.textContent).toBe('hello');
        expect(attached).toEqual([{ actionId: 'open-dialog', trigger: 'click', params: { dialogId: 'pricing' }, targetKind: 'text' }]);
        expect(dialogOf(editor)).toBeNull();
    });

    it('applies an action to an image target captured before the dialog steals focus', async () => {
        const editor = await actionsEditor([OPEN_DIALOG], { style: { color: '#2563eb' } });
        await load(editor, '<p><img src="https://example.com/a.png" alt="a"></p>');
        const img = editableOf(editor).querySelector('img')!;
        editor.setSelectedImage(img);
        const range = new Range();
        range.selectNode(img);
        const selection = document.getSelection()!;
        selection.removeAllRanges();
        selection.addRange(range);
        editableOf(editor).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        await settle(editor);

        attachSlot(editor)!.click();
        await settle(editor);
        // The dialog collapses the live selection; the target was captured up front.
        selection.removeAllRanges();
        editor.setSelectedImage(null);

        await pick(editor, 'open-dialog');
        await typeField(editor, 'dialogId', 'pricing');
        await confirm(editor);

        const attachedImg = editableOf(editor).querySelector('img[data-action-click="open-dialog"]');
        expect(attachedImg?.getAttribute('data-action-click-params')).toBe('{"dialogId":"pricing"}');
        // The starter style seed is for text runs only.
        expect(attachedImg?.getAttribute('style')).toBeNull();
    });

    it('refuses to write when the captured image left the document before confirm', async () => {
        const editor = await actionsEditor();
        await load(editor, '<p>intro <img src="https://example.com/a.png" alt="a"></p>');
        const img = editableOf(editor).querySelector('img')!;
        editor.setSelectedImage(img);
        const range = new Range();
        range.selectNode(img);
        document.getSelection()!.removeAllRanges();
        document.getSelection()!.addRange(range);
        editableOf(editor).dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
        await settle(editor);
        attachSlot(editor)!.click();
        await settle(editor);
        const attached = record<Attached>(editor, 'action-attached');

        editor.setContent('<p>replaced entirely</p>');
        await settle(editor);
        const errors = await collectActionErrors(async () => {
            await pick(editor, 'open-dialog');
            await typeField(editor, 'dialogId', 'pricing');
            await confirm(editor);
        });

        expect(attached).toEqual([]);
        expect(dialogOf(editor)).not.toBeNull();
        expect(img.hasAttribute('data-action-click')).toBe(false);
        expect(editableOf(editor).innerHTML).toBe('<p>replaced entirely</p>');
        expect(errors.map((e) => e[0])).toEqual(['[rich-text-actions] lost the image target before applying the action.']);
    });

    it('tier 3 resolveParams runs without a dialog form and attaches resolved params', async () => {
        const editor = await actionsEditor([{ id: 'campaign', label: 'Campaign', triggers: ['click'], resolveParams: async () => ({ campaignId: 'c-42' }) }]);
        await attachFirstAction(editor);
        await pick(editor, 'campaign');
        await settle(editor);
        expect(editableOf(editor).querySelector('span[data-action-click="campaign"]')?.getAttribute('data-action-click-params')).toBe('{"campaignId":"c-42"}');
        expect(dialogOf(editor)).toBeNull();
    });

    it('tier 3 resolveParams returning null cancels cleanly with no attach', async () => {
        const editor = await actionsEditor([{ id: 'campaign', label: 'Campaign', triggers: ['click'], resolveParams: async () => null }]);
        await attachFirstAction(editor);
        await pick(editor, 'campaign');
        await settle(editor);
        expect(editableOf(editor).querySelector('span[data-action-click]')).toBeNull();
        expect(dialogOf(editor)).toBeNull();
    });

    it('rejects non-flat params from a tier and does not attach', async () => {
        const nonFlat = async (): Promise<ActionParams> => ({ nested: { x: 1 } }) as unknown as ActionParams;
        const editor = await actionsEditor([
            { id: 'bad', label: 'Bad', triggers: ['click'], resolveParams: nonFlat },
            { id: 'bad-combined', label: 'Bad combined', triggers: ['click', 'hover'], combined: true, resolveParams: nonFlat },
        ]);
        const attached = record<Attached>(editor, 'action-attached');
        const errors = await collectActionErrors(async () => {
            for (const id of ['bad', 'bad-combined']) {
                const content = await attachFirstAction(editor);
                await pick(editor, id);
                await settle(editor);
                expect(content.innerHTML).toBe('<p>go</p>');
            }
        });
        expect(attached).toEqual([]);
        const flatError = expect.objectContaining({ message: 'Action params must be a flat object of string | number | boolean values.' });
        expect(errors).toEqual([
            ['[rich-text-actions] refused to attach non-flat params:', flatError],
            ['[rich-text-actions] refused to attach non-flat combined params:', flatError],
        ]);
    });

    it('logs a diagnostic when an action declares multiple param tiers', async () => {
        const editor = await actionsEditor([{
            id: 'multi', label: 'Multi', triggers: ['click'],
            fields: [{ key: 'a', label: 'A', type: 'text' }],
            resolveParams: async () => ({ a: '1' }),
        }]);
        await attachFirstAction(editor);
        const errors = await collectActionErrors(async () => {
            await pick(editor, 'multi');
            await settle(editor);
        });
        expect(errors.some((e) => String(e[0]).includes('multiple param tiers'))).toBe(true);
    });

    it('shows the edit popover when the caret enters an actioned span', async () => {
        const editor = await actionsEditor();
        await caretInside(editor, '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"x"}\'>t</span></p>');
        expect(popoverOf(editor)).not.toBeNull();
        expect(popoverOf(editor)!.textContent).toContain('Open dialog');
        expect(inPopover(editor, '[data-testid="rta-edit"]')).not.toBeNull();
    });

    it('does not keep a popover pointing at content that was replaced', async () => {
        // The popover re-evaluated only on mouseup/keyup, so a programmatic content swap left it over
        // content that no longer exists, still offering Edit and Remove for a deleted span.
        const editor = await actionsEditor();
        await caretInside(editor, '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"x"}\'>t</span></p>');
        expect(popoverOf(editor)).not.toBeNull();

        editor.setContent('<p>replaced entirely</p>');
        await settle(editor);
        expect(popoverOf(editor)).toBeNull();
    });

    it('renders the popover in the native top layer', async () => {
        const editor = await actionsEditor();
        await caretInside(editor, '<p><span data-action-click="open-dialog">t</span></p>');
        expect(popoverOf(editor)!.getAttribute('popover')).toBe('manual');
        expect(popoverOf(editor)!.matches(':popover-open')).toBe(true);
    });

    it('removes a trigger and unwraps a bare span', async () => {
        const editor = await actionsEditor();
        const content = await caretInside(editor, '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"x"}\'>t</span></p>');
        const removed = record<{ actionId: string; trigger: string }>(editor, 'action-removed');
        inPopover<HTMLButtonElement>(editor, '[data-testid="rta-remove"]').click();
        await settle(editor);
        expect(content.querySelector('p')!.innerHTML).toBe('t');
        expect(removed).toEqual([{ actionId: 'open-dialog', trigger: 'click', targetKind: 'text' }]);
        expect(popoverOf(editor)).toBeNull();
    });

    it('renders a combined action as a single popover row and removes both triggers', async () => {
        const editor = await actionsEditor([{ id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'], combined: true }]);
        const content = await caretInside(editor, '<p><span data-action-click="dictionary" data-action-hover="dictionary">t</span></p>');
        const removed: RichTextActionTrigger[] = [];
        editor.addEventListener('action-removed', (e) => removed.push((e as CustomEvent<{ trigger: RichTextActionTrigger }>).detail.trigger));
        expect(popoverOf(editor)!.querySelectorAll('[data-testid="rta-remove"]')).toHaveLength(1);
        inPopover<HTMLButtonElement>(editor, '[data-testid="rta-remove"]').click();
        await settle(editor);
        expect(content.querySelector('[data-action-click]')).toBeNull();
        expect(content.querySelector('[data-action-hover]')).toBeNull();
        expect(removed).toEqual(['click', 'hover']);
    });

    it('still renders two rows for two separate single-trigger actions (regression)', async () => {
        const editor = await actionsEditor([
            { id: 'open-dialog', label: 'Open dialog', triggers: ['click'] },
            { id: 'term', label: 'Term', triggers: ['hover'] },
        ]);
        await caretInside(editor, '<p><span data-action-click="open-dialog" data-action-hover="term">t</span></p>');
        expect(popoverOf(editor)!.querySelectorAll('[data-testid="rta-remove"]')).toHaveLength(2);
    });

    it('renders an unknown action id as remove-only', async () => {
        const editor = await actionsEditor();
        await caretInside(editor, '<p><span data-action-click="ghost-id">t</span></p>');
        expect(popoverOf(editor)!.textContent).toContain('unavailable');
        expect(popoverOf(editor)!.querySelector('[data-testid="rta-edit"]')).toBeNull();
        expect(popoverOf(editor)!.querySelector('[data-testid="rta-remove"]')).not.toBeNull();
    });

    it('hides all entry points when the editor is readonly', async () => {
        const editor = await actionsEditor([OPEN_DIALOG], {}, (el) => {
            el.readonly = true;
        });
        await caretInside(editor, '<p><span data-action-click="open-dialog">t</span></p>');
        expect(attachSlot(editor)?.disabled ?? true).toBe(true);
        expect(popoverOf(editor)).toBeNull();
    });

    it('edit reopens the dialog in edit mode with prefilled params and updates the action', async () => {
        const editor = await actionsEditor();
        const content = await caretInside(editor, '<p><span data-action-click="open-dialog" data-action-click-params=\'{"dialogId":"old"}\'>t</span></p>');
        inPopover<HTMLButtonElement>(editor, '[data-testid="rta-edit"]').click();
        await settle(editor);

        const field = inDialog<HTMLInputElement>(editor, 'input[data-field="dialogId"]');
        expect(field.value).toBe('old');
        await typeField(editor, 'dialogId', 'new');
        await confirm(editor);

        expect(content.querySelector('span[data-action-click="open-dialog"]')?.getAttribute('data-action-click-params')).toBe('{"dialogId":"new"}');
    });

    it('dismisses the edit popover on an outside pointerdown', async () => {
        const editor = await actionsEditor();
        await caretInside(editor, '<p><span data-action-click="open-dialog">t</span></p>');
        expect(popoverOf(editor)).not.toBeNull();
        document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        await settle(editor);
        expect(popoverOf(editor)).toBeNull();
    });

    it('keeps the popover on a pointerdown inside it', async () => {
        const editor = await actionsEditor();
        await caretInside(editor, '<p><span data-action-click="open-dialog">t</span></p>');
        popoverOf(editor)!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true }));
        await settle(editor);
        expect(popoverOf(editor)).not.toBeNull();
    });

    it('closes the edit popover (not just opens the dialog) when "Add action" is clicked', async () => {
        const editor = await actionsEditor();
        await caretInside(editor, '<p><span data-action-click="open-dialog">t</span></p>');
        inPopover<HTMLButtonElement>(editor, '[data-testid="rta-add"]').click();
        await settle(editor);
        // The lingering popover used to sit behind the dialog.
        expect(popoverOf(editor)).toBeNull();
        expect(dialogOf(editor)!.querySelector('[data-testid="rta-cancel"]')).not.toBeNull();
    });

    it('logs and does not attach when tier-3 resolveParams rejects', async () => {
        const editor = await actionsEditor([{ id: 'boom', label: 'Boom', triggers: ['click'], resolveParams: async () => { throw new Error('nope'); } }]);
        const content = await attachFirstAction(editor);
        const errors = await collectActionErrors(async () => {
            await pick(editor, 'boom');
            await settle(editor);
        });
        expect(content.querySelector('span[data-action-click="boom"]')).toBeNull();
        expect(errors.some((e) => String(e[0]).includes('resolveParams rejected'))).toBe(true);
    });

    describe('marker styles', () => {
        const markerSheets = () => document.adoptedStyleSheets.filter((sheet) => [...sheet.cssRules].some((r) => r.cssText.includes('data-action-click')));

        it('ref-counts the shared marker stylesheet across two editors', async () => {
            const a = await actionsEditor();
            const b = await actionsEditor();
            expect(markerSheets()).toHaveLength(1);
            a.remove();
            expect(markerSheets()).toHaveLength(1);
            b.remove();
            expect(markerSheets()).toHaveLength(0);
        });

        it('styles action markers inside the editable only', async () => {
            const editor = await actionsEditor();
            await load(editor, '<p><span data-action-click="open-dialog">Pricing</span> <img data-action-click="open-dialog" alt="Plans" width="40" height="20"></p>');
            const content = editableOf(editor);
            expect(getComputedStyle(content.querySelector('span')!).borderBottomStyle).toBe('dotted');
            expect(getComputedStyle(content.querySelector('img')!).outlineStyle).toBe('dashed');

            // The stylesheet is document-global, so it must stay scoped to editables.
            const stray = document.createElement('span');
            stray.dataset['actionClick'] = 'open-dialog';
            document.body.append(stray);
            expect(getComputedStyle(stray).borderBottomStyle).not.toBe('dotted');
            stray.remove();
        });
    });

    describe('slash command', () => {
        it('registers a command whose run() opens the attach flow', async () => {
            const editor = await actionsEditor();
            await load(editor, '<p>go</p>');
            selectText(editor, 0, 2);
            const command = editor.commands.listCommands().find((c) => c.id === 'actions.attach')!;
            const ctx = { query: '', disabled: false };
            expect(command.when!({ ...ctx, hasSelection: true, readonly: false })).toBe(true);
            expect(command.when!({ ...ctx, hasSelection: false, readonly: false })).toBe(false);
            expect(command.when!({ ...ctx, hasSelection: true, readonly: true })).toBe(false);

            void command.run({} as never);
            await settle(editor);
            expect(dialogOf(editor)!.querySelector('[data-testid="rta-cancel"]')).not.toBeNull();
        });

        it('honours slashCommand: false and toolbar: false independently', async () => {
            const noSlash = await actionsEditor([OPEN_DIALOG], { slashCommand: false });
            expect(attachSlot(noSlash)).not.toBeNull();
            expect(noSlash.commands.listCommands().some((c) => c.id === 'actions.attach')).toBe(false);

            const noToolbar = await actionsEditor([OPEN_DIALOG], { toolbar: false });
            expect(attachSlot(noToolbar)).toBeNull();
            expect(noToolbar.commands.listCommands().some((c) => c.id === 'actions.attach')).toBe(true);
        });
    });

    it('keeps the dialog open and writes nothing when the text selection was lost before confirm', async () => {
        const editor = await actionsEditor([
            OPEN_DIALOG,
            {
                id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'], combined: true, paramsMode: 'shared',
                fields: [{ key: 'value', label: 'Value', type: 'text', required: true }],
            },
        ]);
        const content = await attachFirstAction(editor);
        // The host could not re-establish the saved range (content swapped under the dialog).
        editor.wrapSelection = () => [];
        const attached = record<Attached>(editor, 'action-attached');

        const errors = await collectActionErrors(async () => {
            for (const [id, key] of [['open-dialog', 'dialogId'], ['dictionary', 'value']] as const) {
                await pick(editor, id);
                await typeField(editor, key, 'pricing');
                await confirm(editor);
                expect(dialogOf(editor)).not.toBeNull();
            }
        });

        expect(content.innerHTML).toBe('<p>go</p>');
        expect(attached).toEqual([]);
        expect(errors.map((e) => e[0])).toEqual([
            '[rich-text-actions] lost the text selection before applying the action.',
            '[rich-text-actions] lost the text selection before applying the combined action.',
        ]);
    });

    it('refuses to write and returns false when the apply target was lost', async () => {
        // White-box: a null image target is unreachable through the dialog, and this drives
        // applyAction and applyCombined without building each dialog.
        const editor = await actionsEditor();
        await load(editor, '<p>see <span data-action-click="open-dialog">terms</span> <img src="https://example.com/a.png" alt="a"></p>');
        const detachedSpan = editableOf(editor).querySelector('span')!;
        const detachedImage = editableOf(editor).querySelector('img')!;
        await load(editor, '<p>replaced</p>');
        const elsewhere = document.createElement('span');
        elsewhere.textContent = 'outside the editor';
        document.body.append(elsewhere);
        const controller = new ActionsController(editor, [OPEN_DIALOG], {}, RICH_TEXT_ACTIONS_LOCALES.en);
        const attached = record<Attached>(editor, 'action-attached');
        type Target = Parameters<ActionsController['applyAction']>[3];
        const lostTargets: Target[] = [
            { kind: 'image', existing: null, image: null },
            { kind: 'image', existing: null, image: detachedImage },
            { kind: 'text', existing: detachedSpan, image: null },
            { kind: 'text', existing: elsewhere, image: null },
        ];
        const results: boolean[] = [];

        const errors = await collectActionErrors(async () => {
            for (const target of lostTargets) {
                results.push(
                    controller.applyAction({ id: 'x', label: 'X', triggers: ['hover'] }, 'hover', { v: 1 }, target),
                    controller.applyCombined(
                        { id: 'c', label: 'C', triggers: ['click', 'hover'], combined: true },
                        { click: { v: 1 }, hover: { v: 2 } },
                        target,
                    ),
                );
            }
        });
        elsewhere.remove();

        expect(results).toEqual(new Array(8).fill(false));
        expect(attached).toEqual([]);
        expect(errors.map((e) => e[0])).toEqual([
            ...new Array(4).fill('[rich-text-actions] lost the image target before applying the action.'),
            ...new Array(4).fill('[rich-text-actions] lost the text target before applying the action.'),
        ]);
        expect([detachedImage, detachedSpan, elsewhere].map((el) => el.hasAttribute('data-action-hover'))).toEqual([false, false, false]);
        expect(editableOf(editor).innerHTML).toBe('<p>replaced</p>');
    });

    it('edit on a combined separate-params action prefills both groups and rewrites both triggers', async () => {
        const editor = await actionsEditor([{
            id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'], combined: true, paramsMode: 'separate',
            fieldsByTrigger: {
                hover: [{ key: 'previewLen', label: 'Preview length', type: 'number' }],
                click: [{ key: 'dialogId', label: 'Dialog', type: 'text' }],
            },
        }]);
        const content = await caretInside(editor, `<p><span data-action-click="dictionary" data-action-hover="dictionary"
            data-action-click-params='{"dialogId":"sla-terms"}' data-action-hover-params='{"previewLen":90}'>SLA</span></p>`);
        const attached = record<Attached>(editor, 'action-attached');
        inPopover<HTMLButtonElement>(editor, '[data-testid="rta-edit"]').click();
        await settle(editor);

        expect([
            inDialog<HTMLInputElement>(editor, 'input[data-field="previewLen"]').value,
            inDialog<HTMLInputElement>(editor, 'input[data-field="dialogId"]').value,
        ]).toEqual(['90', 'sla-terms']);
        await typeField(editor, 'previewLen', '120');
        await confirm(editor);

        const span = content.querySelector('span[data-action-click="dictionary"]');
        expect(span?.getAttribute('data-action-hover')).toBe('dictionary');
        expect(span?.getAttribute('data-action-click-params')).toBe('{"dialogId":"sla-terms"}');
        expect(span?.getAttribute('data-action-hover-params')).toBe('{"previewLen":120}');
        expect(attached).toEqual([
            { actionId: 'dictionary', trigger: 'click', params: { dialogId: 'sla-terms' }, targetKind: 'text' },
            { actionId: 'dictionary', trigger: 'hover', params: { previewLen: 120 }, targetKind: 'text' },
        ]);
        expect(dialogOf(editor)).toBeNull();
    });

    it('attaches a combined action to both triggers in one undoable transaction', async () => {
        const editor = await actionsEditor([{
            id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'], combined: true, paramsMode: 'shared',
            fields: [{ key: 'value', label: 'Value', type: 'text', required: true }],
        }]);
        const content = await attachFirstAction(editor);
        await pick(editor, 'dictionary');
        await typeField(editor, 'value', 'sla');
        await confirm(editor);

        const span = content.querySelector('span[data-action-click="dictionary"]')!;
        expect(span).not.toBeNull();
        expect(span.getAttribute('data-action-hover')).toBe('dictionary');

        editor.undo();
        await settle(editor);
        expect(content.querySelector('[data-action-click]')).toBeNull();
    });

    it('logs a diagnostic when a combined action declares fewer than two triggers', async () => {
        const editor = await actionsEditor([{ id: 'bad-combined', label: 'Bad', triggers: ['click'], combined: true }]);
        await attachFirstAction(editor);
        const errors = await collectActionErrors(() => pick(editor, 'bad-combined'));
        expect(errors.some((e) => String(e[0]).includes('fewer than two triggers'))).toBe(true);
    });

    it('logs a diagnostic when combined+separate declares an unsupported tier-2/3 form', async () => {
        const editor = await actionsEditor([{
            id: 'weird-combined', label: 'Weird', triggers: ['click', 'hover'], combined: true, paramsMode: 'separate',
            resolveParams: async () => ({ value: 'sla' }),
        }]);
        const content = await attachFirstAction(editor);
        const errors = await collectActionErrors(async () => {
            await pick(editor, 'weird-combined');
            await settle(editor);
        });
        expect(errors.some((e) => String(e[0]).includes('tier-1 fields only'))).toBe(true);

        const span = content.querySelector('span[data-action-click="weird-combined"]');
        expect(span?.getAttribute('data-action-click-params')).toBe('{"value":"sla"}');
        expect(span?.getAttribute('data-action-hover-params')).toBe('{"value":"sla"}');
    });

    it('uses a tier-2 form tag inside the real dialog', async () => {
        class EntityForm extends HTMLElement {
            context: unknown;
            params: ActionParams = {};
            get valid(): boolean {
                return Object.keys(this.params).length > 0;
            }
            connectedCallback(): void {
                const input = document.createElement('input');
                input.dataset['testid'] = 'entity';
                input.addEventListener('input', () => {
                    this.params = { entityId: input.value };
                    this.dispatchEvent(new Event('change', { bubbles: true }));
                });
                this.append(input);
            }
        }
        customElements.define('x-entity-form', EntityForm);
        const editor = await actionsEditor([{ id: 'entity', label: 'Entity', triggers: ['click'], formTag: 'x-entity-form' }]);
        const content = await attachFirstAction(editor);
        await pick(editor, 'entity');
        expect(inDialog<HTMLElement & { disabled: boolean }>(editor, '[data-testid="rta-confirm"]').disabled).toBe(true);

        const input = inDialog<HTMLInputElement>(editor, '[data-testid="entity"]');
        input.value = 'e-1';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await settle(editor);
        await confirm(editor);
        expect(content.querySelector('span[data-action-click="entity"]')?.getAttribute('data-action-click-params')).toBe('{"entityId":"e-1"}');
    });

    it('renders its toolbar button under toolbar="floating" too', async () => {
        const editor = await actionsEditor([OPEN_DIALOG], {}, (el) => {
            el.toolbar = 'floating';
        });
        await load(editor, '<p>hello world</p>');
        selectText(editor, 0, 5);
        await settle(editor);
        const floating = editor.shadowRoot!.querySelectorAll('ge-rich-text-toolbar');
        const slots = [...floating].flatMap((bar) => [...bar.shadowRoot!.querySelectorAll('[data-addon-slot="actions.attach"]')]);
        expect(slots.length).toBeGreaterThan(0);
    });

    describe('starter style seeding', () => {
        const D: RichTextActionDefinition = { id: 'd', label: 'D', triggers: ['click'] };

        async function attachD(editor: GeRichTextEditor): Promise<HTMLElement> {
            const content = await attachFirstAction(editor);
            await pick(editor, 'd');
            await confirm(editor);
            return content;
        }

        it('seeds the merged starter style onto a newly created action span', async () => {
            const editor = await actionsEditor([{ ...D, style: { fontWeight: '600' } }], { style: { color: '#2563eb' } });
            const span = (await attachD(editor)).querySelector<HTMLElement>('span[data-action-click="d"]')!;
            expect(span.style.color).toBe('rgb(37, 99, 235)');
            expect(span.style.fontWeight).toBe('600');
        });

        it('lets a per-action style win over the global default on a key clash', async () => {
            const editor = await actionsEditor([{ ...D, style: { color: '#2563eb' } }], { style: { color: '#111111' } });
            const span = (await attachD(editor)).querySelector<HTMLElement>('span[data-action-click="d"]')!;
            expect(span.style.color).toBe('rgb(37, 99, 235)');
        });

        it('writes no style attribute when no starter style is configured', async () => {
            const editor = await actionsEditor([D]);
            const span = (await attachD(editor)).querySelector<HTMLElement>('span[data-action-click="d"]')!;
            expect(span.hasAttribute('style')).toBe(false);
        });

        it('does not re-seed when adding a second trigger to an existing span', async () => {
            const editor = await actionsEditor([{ id: 'd', label: 'D', triggers: ['click', 'hover'] }], { style: { color: '#2563eb' } });
            const content = await attachFirstAction(editor);
            await pick(editor, 'd');
            inDialog<HTMLInputElement>(editor, 'input[type="radio"][name="rta-trigger"]').click();
            await settle(editor);
            await confirm(editor);

            const span = content.querySelector<HTMLElement>('span[data-action-click="d"]')!;
            span.style.setProperty('color', 'red');
            const range = new Range();
            range.selectNodeContents(span.firstChild ?? span);
            range.collapse(true);
            document.getSelection()!.removeAllRanges();
            document.getSelection()!.addRange(range);
            content.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            await settle(editor);

            inPopover<HTMLButtonElement>(editor, '[data-testid="rta-add"]').click();
            await settle(editor);
            await pick(editor, 'd');
            dialogOf(editor)!.querySelectorAll<HTMLInputElement>('input[type="radio"][name="rta-trigger"]')[1]!.click();
            await settle(editor);
            await confirm(editor);

            expect(span.getAttribute('data-action-hover')).toBe('d');
            expect(span.style.color).toBe('red');
        });

        it('strips an unedited seed and unwraps the bare span on remove', async () => {
            const editor = await actionsEditor([D], { style: { color: '#2563eb' } });
            const content = await attachD(editor);
            const span = content.querySelector<HTMLElement>('span[data-action-click="d"]')!;
            const range = new Range();
            range.selectNodeContents(span.firstChild ?? span);
            range.collapse(true);
            document.getSelection()!.removeAllRanges();
            document.getSelection()!.addRange(range);
            content.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            await settle(editor);

            inPopover<HTMLButtonElement>(editor, '[data-testid="rta-remove"]').click();
            await settle(editor);
            expect(content.querySelector('p')!.innerHTML).toBe('go');
        });

        it('keeps an author-edited style span on remove', async () => {
            const editor = await actionsEditor([D], { style: { color: '#2563eb' } });
            const content = await attachD(editor);
            const span = content.querySelector<HTMLElement>('span[data-action-click="d"]')!;
            span.style.fontWeight = '700';
            const range = new Range();
            range.selectNodeContents(span.firstChild ?? span);
            range.collapse(true);
            document.getSelection()!.removeAllRanges();
            document.getSelection()!.addRange(range);
            content.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            await settle(editor);

            inPopover<HTMLButtonElement>(editor, '[data-testid="rta-remove"]').click();
            await settle(editor);
            const remaining = content.querySelector('span[style]');
            expect(remaining).not.toBeNull();
            expect(remaining?.textContent).toBe('go');
        });
    });
});
