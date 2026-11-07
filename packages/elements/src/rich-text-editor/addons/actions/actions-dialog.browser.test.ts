import { render } from 'lit';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ActionsDialog, type ActionsDialogConfirm, type ActionsDialogContext } from './actions-dialog.js';
import { RICH_TEXT_ACTIONS_LOCALES, type RichTextActionsLocale } from './actions-locale.js';
import type {
    ActionParams, RichTextActionDefinition, RichTextActionParamsContext, RichTextActionParamsForm,
} from './actions-types.js';

/** A tier-2 fixture: a custom element with `context`, `params` and `valid`, announcing edits with `change`. */
class CustomForm extends HTMLElement implements RichTextActionParamsForm {
    context!: RichTextActionParamsContext;
    params: ActionParams = {};

    constructor() {
        super();
        const input = document.createElement('input');
        input.dataset['testid'] = 'custom';
        input.addEventListener('input', () => {
            this.params = { entityId: input.value };
            this.dispatchEvent(new Event('change', { bubbles: true }));
        });
        this.attachShadow({ mode: 'open' }).append(input);
    }

    get valid(): boolean {
        return Object.keys(this.params).length > 0;
    }
}

const DEFS: RichTextActionDefinition[] = [
    { id: 'open-dialog', label: 'Open dialog', triggers: ['click'], fields: [{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }] },
    { id: 'term', label: 'Term', triggers: ['hover'], targets: ['text'] },
];

const DICTIONARY_SEPARATE: RichTextActionDefinition = {
    id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'], combined: true, paramsMode: 'separate',
    fieldsByTrigger: {
        hover: [{ key: 'previewLen', label: 'Preview length', type: 'number' }],
        click: [{ key: 'dialogId', label: 'Dialog', type: 'text' }],
    },
};

const hosts: HTMLElement[] = [];

beforeAll(() => {
    if (!customElements.get('x-actions-form')) customElements.define('x-actions-form', CustomForm);
});

afterEach(() => {
    for (const host of hosts.splice(0)) host.remove();
});

interface Mounted {
    readonly dialog: ActionsDialog;
    readonly host: HTMLElement;
    readonly payloads: ActionsDialogConfirm[];
    readonly dismissed: () => number;
}

function mountDialog(
    definitions: RichTextActionDefinition[] = DEFS,
    context: Partial<ActionsDialogContext> = {},
    locale: RichTextActionsLocale = RICH_TEXT_ACTIONS_LOCALES.en,
): Mounted {
    const host = document.createElement('div');
    document.body.append(host);
    hosts.push(host);
    const payloads: ActionsDialogConfirm[] = [];
    let dismissCount = 0;
    const draw = (): void => {
        render(dialog.render(), host);
    };
    const dialog: ActionsDialog = new ActionsDialog({
        definitions,
        locale,
        context: { mode: 'create', targetKind: 'text', selectionText: 'hello', occupiedTriggers: [], prefill: null, ...context },
        requestUpdate: draw,
        onConfirm: (payload) => payloads.push(payload),
        onDismiss: () => { dismissCount++; },
        onPick: () => undefined,
    });
    draw();
    return { dialog, host, payloads, dismissed: () => dismissCount };
}

const confirmButton = (host: HTMLElement) => host.querySelector<HTMLElement & { disabled: boolean }>('[data-testid="rta-confirm"]')!;
const optionButton = (host: HTMLElement, id: string) => host.querySelector<HTMLButtonElement>(`[data-action-option="${id}"]`)!;

function typeInto(host: HTMLElement, key: string, value: string): void {
    const input = host.querySelector<HTMLInputElement>(`input[data-field="${key}"]`)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
}

describe('actions dialog', () => {
    it('hides actions whose targets exclude the current image target', () => {
        const { host } = mountDialog(DEFS, { targetKind: 'image' });
        expect(host.textContent).toContain('Open dialog');
        expect(host.textContent).not.toContain('Term');
    });

    it('disables confirm until required fields are valid, then emits the confirm payload', () => {
        const { dialog, host, payloads } = mountDialog();
        dialog.pickAction('open-dialog');
        expect(confirmButton(host).disabled).toBe(true);
        typeInto(host, 'dialogId', 'pricing');
        expect(confirmButton(host).disabled).toBe(false);
        confirmButton(host).click();
        expect(payloads).toEqual([{ def: expect.objectContaining({ id: 'open-dialog' }), trigger: 'click', params: { dialogId: 'pricing' } }]);
    });

    it('a multi-trigger action with no fields confirms after selecting a trigger', () => {
        const { dialog, payloads } = mountDialog([{ id: 'both', label: 'Both', triggers: ['click', 'hover'] }]);
        dialog.pickAction('both');
        // No trigger chosen yet on a multi-trigger action: cannot confirm.
        expect(dialog.canConfirm).toBe(false);
        dialog.selectTrigger('hover');
        expect(dialog.canConfirm).toBe(true);
        dialog.confirm();
        expect(payloads[0]?.trigger).toBe('hover');
    });

    it('confirms the hover field group as combinedParams.hover in paramsMode:separate', () => {
        const { host, payloads } = mountDialog([DICTIONARY_SEPARATE], { selectionText: 'sla' });
        optionButton(host, 'dictionary').click();
        typeInto(host, 'previewLen', '80');
        typeInto(host, 'dialogId', 'sla-terms');
        confirmButton(host).click();
        expect(payloads[0]?.combinedParams).toEqual({ click: { dialogId: 'sla-terms' }, hover: { previewLen: 80 } });
    });

    it('picking an unknown id after a valid selection clears it and stays unconfirmable', () => {
        const { dialog, host } = mountDialog();
        optionButton(host, 'open-dialog').click();
        typeInto(host, 'dialogId', 'pricing');
        expect(confirmButton(host).disabled).toBe(false);

        dialog.pickAction('does-not-exist');
        expect(host.querySelector('input[data-field="dialogId"]')).toBeNull();
        expect(host.querySelector('[aria-pressed="true"]')).toBeNull();
        expect(confirmButton(host).disabled).toBe(true);
    });

    it('confirm does not emit while a required field is still empty', () => {
        const { dialog, host, payloads } = mountDialog();
        optionButton(host, 'open-dialog').click();
        dialog.confirm();
        expect(payloads).toEqual([]);
    });

    it('reports dismiss when the dialog open state flips to false', () => {
        const { host, dismissed } = mountDialog();
        host.querySelector('ge-dialog')!.dispatchEvent(new CustomEvent('open-change', { detail: false, bubbles: true }));
        expect(dismissed()).toBe(1);
    });

    it('shows localized trigger labels (he)', () => {
        const { host } = mountDialog([{ id: 'x', label: 'X', triggers: ['click', 'hover'] }], {}, RICH_TEXT_ACTIONS_LOCALES.he!);
        expect(host.textContent).toContain('לחיצה / ריחוף');
        expect(host.textContent).not.toContain('click');
        expect(host.querySelector('[dir="rtl"]')).not.toBeNull();
    });

    it('reports dismiss when the cancel button is clicked', () => {
        const { host, dismissed } = mountDialog();
        host.querySelector<HTMLElement>('[data-testid="rta-cancel"]')!.click();
        expect(dismissed()).toBe(1);
    });

    it('renders a tier-2 form element and gates confirm on its valid property', () => {
        const { dialog, host, payloads } = mountDialog([{ id: 'x', label: 'X', triggers: ['click'], formTag: 'x-actions-form' }], { selectionText: 's' });
        dialog.pickAction('x');
        const form = host.querySelector<CustomForm>('x-actions-form')!;
        expect(form.context).toMatchObject({ mode: 'create', trigger: 'click', selectionText: 's', targetKind: 'text', targetElement: null });
        expect(confirmButton(host).disabled).toBe(true);

        const input = form.shadowRoot!.querySelector('input')!;
        input.value = 'e-1';
        input.dispatchEvent(new Event('input'));
        expect(confirmButton(host).disabled).toBe(false);
        confirmButton(host).click();
        expect(payloads[0]?.params).toEqual({ entityId: 'e-1' });
    });

    it('shows a combined action as one row with no trigger radio and confirms both triggers', () => {
        const { dialog, host, payloads } = mountDialog([{
            id: 'dictionary', label: 'Dictionary', icon: 'book', triggers: ['click', 'hover'], combined: true, paramsMode: 'shared',
            fields: [{ key: 'value', label: 'Value', type: 'text', required: true }],
        }], { selectionText: 'sla' });
        dialog.pickAction('dictionary');
        expect(host.querySelectorAll('input[type="radio"][name="rta-trigger"]')).toHaveLength(0);

        typeInto(host, 'value', 'sla');
        expect(confirmButton(host).disabled).toBe(false);
        confirmButton(host).click();
        expect(payloads[0]?.combinedParams).toEqual({ click: { value: 'sla' }, hover: { value: 'sla' } });
    });

    it('labels the confirm button "Replace" for a combined action when only hover is occupied', () => {
        const { dialog } = mountDialog([{
            id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'], combined: true, paramsMode: 'shared',
            fields: [{ key: 'value', label: 'Value', type: 'text', required: true }],
        }], { selectionText: 'sla', occupiedTriggers: ['hover'] });
        dialog.pickAction('dictionary');
        expect(dialog.confirmLabel).toBe(RICH_TEXT_ACTIONS_LOCALES.en.dialog.replace);
    });

    it('renders two labelled field groups for paramsMode:separate', () => {
        const { dialog, host } = mountDialog([DICTIONARY_SEPARATE], { selectionText: 'sla' });
        dialog.pickAction('dictionary');
        const headers = [...host.querySelectorAll('[data-slot="rich-text-actions-dialog-section-header"]')].map((el) => el.textContent);
        expect(headers).toEqual([RICH_TEXT_ACTIONS_LOCALES.en.triggers.hover, RICH_TEXT_ACTIONS_LOCALES.en.triggers.click]);
        expect(host.querySelector('input[data-field="previewLen"]')).not.toBeNull();
        expect(host.querySelector('input[data-field="dialogId"]')).not.toBeNull();
    });

    it('preserves per-trigger params when editing a combined paramsMode:separate action', () => {
        const { dialog, payloads } = mountDialog([DICTIONARY_SEPARATE], {
            mode: 'edit', selectionText: 'sla', occupiedTriggers: ['click', 'hover'],
            prefill: { def: DICTIONARY_SEPARATE, trigger: 'click', params: { dialogId: 'full' }, hoverParams: { previewLen: 120 } },
        });
        dialog.confirm();
        expect(payloads[0]?.combinedParams).toEqual({ click: { dialogId: 'full' }, hover: { previewLen: 120 } });
    });

    it('shows the combined badge for a combined action', () => {
        const { dialog, host } = mountDialog([{ id: 'dictionary', label: 'Dictionary', triggers: ['click', 'hover'], combined: true }], { selectionText: 'sla' });
        dialog.pickAction('dictionary');
        expect(host.textContent).toContain(RICH_TEXT_ACTIONS_LOCALES.en.dialog.combinedBadge);
    });

    it('falls back combined+separate+formTag to a single shared tier-2 form (unsupported combo)', () => {
        const { dialog, host, payloads } = mountDialog([{
            id: 'weird', label: 'Weird', triggers: ['click', 'hover'], combined: true, paramsMode: 'separate', formTag: 'x-actions-form',
        }], { selectionText: 's' });
        dialog.pickAction('weird');
        expect(dialog.paramsMode).toBe('shared');
        expect(host.querySelectorAll('[data-slot="rich-text-actions-dialog-section-header"]')).toHaveLength(0);

        const input = host.querySelector<CustomForm>('x-actions-form')!.shadowRoot!.querySelector('input')!;
        input.value = 'e-9';
        input.dispatchEvent(new Event('input'));
        expect(confirmButton(host).disabled).toBe(false);
        confirmButton(host).click();
        expect(payloads[0]?.combinedParams).toEqual({ click: { entityId: 'e-9' }, hover: { entityId: 'e-9' } });
    });

    it('filters the picker by the search text', () => {
        const { dialog, host } = mountDialog();
        dialog.query = 'term';
        dialog.pickAction('unknown');
        expect([...host.querySelectorAll('[data-action-option]')].map((el) => el.getAttribute('data-action-option'))).toEqual(['term']);
    });
});
