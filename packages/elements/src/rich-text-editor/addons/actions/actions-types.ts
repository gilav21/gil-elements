/** The DOM trigger an action responds to. */
export type RichTextActionTrigger = 'click' | 'hover';

/** Which kind of element an action attaches to. */
export type ActionTargetKind = 'text' | 'image';

/** Flat params object, the only shape that serializes into the HTML. */
export type ActionParams = Record<string, string | number | boolean>;

/** How a combined action gathers params. */
export type ActionParamsMode = 'shared' | 'separate';

/** The attribute names carrying an action id, one per trigger. */
export const ACTION_ATTRS = ['data-action-click', 'data-action-hover'] as const;

/** A declarative form field (tier 1). The addon generates a form from these. */
export interface RichTextActionField {
    /** Param key written into the serialized params object. */
    key: string;
    label: string;
    type: 'text' | 'textarea' | 'number' | 'checkbox' | 'select';
    required?: boolean;
    placeholder?: string;
    description?: string;
    /** Options for a `'select'` field. */
    options?: { value: string; label: string }[];
    defaultValue?: string | number | boolean;
    /** Return an error message, or null when valid. */
    validate?: (value: unknown) => string | null;
}

/** Context passed to a custom form element or an external `resolveParams` flow. */
export interface RichTextActionParamsContext {
    mode: 'create' | 'edit';
    trigger: RichTextActionTrigger;
    currentParams: ActionParams;
    /** The selected text, or '' for an image target. */
    selectionText: string;
    targetKind: ActionTargetKind;
    /** The element being edited (edit mode), or null when creating from a selection. */
    targetElement: HTMLElement | null;
}

/**
 * Contract of a tier-2 custom form element, named by `formTag`. The dialog creates the element,
 * sets `context` and seeds `params` before it is connected, then reads `params` and `valid`.
 * The element tells the dialog they changed by firing a bubbling `change` event (native `input`
 * events from inside it count too); the dialog re-reads both on every such event and gates Apply on `valid`.
 */
export interface RichTextActionParamsForm extends HTMLElement {
    /** Set by the addon before the element is connected. */
    context: RichTextActionParamsContext;
    /** Seeded by the addon with the current params; the element keeps it up to date as the user edits. */
    params: ActionParams;
    /** Gates the Apply button. */
    readonly valid: boolean;
}

/**
 * A premade action a developer registers. Precedence for gathering params:
 * `resolveParams` > `formTag` > `fields` > none.
 */
export interface RichTextActionDefinition {
    /** Unique id, serialized into the HTML. Dot-namespaced like slash commands. */
    id: string;
    label: string;
    description?: string;
    /** Icon name shown in the picker. */
    icon?: string;
    triggers: RichTextActionTrigger[];
    /** Which targets the action may attach to. Default: both. */
    targets?: ActionTargetKind[];
    /** Starter inline styles seeded onto a newly created action span. Merged over the addon's `style` option. */
    style?: Record<string, string>;
    /** Attach BOTH click and hover in one picker selection. Requires `triggers` to include both. */
    combined?: boolean;
    /** Combined only. `'shared'` (default): one form gives identical params on both triggers. `'separate'`: per-trigger fields. */
    paramsMode?: ActionParamsMode;
    /** Combined + `paramsMode:'separate'`: tier-1 fields per trigger. */
    fieldsByTrigger?: { click?: RichTextActionField[]; hover?: RichTextActionField[] };
    /** Tier 1: declarative fields; the addon generates the form. */
    fields?: RichTextActionField[];
    /** Tier 2: tag name of a custom element implementing {@link RichTextActionParamsForm}, rendered inside the addon dialog. */
    formTag?: string;
    /** Tier 3: a fully external flow; no addon dialog form is shown. */
    resolveParams?: (ctx: RichTextActionParamsContext) => Promise<ActionParams | null>;
}
