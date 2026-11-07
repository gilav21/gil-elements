import type { ActionParams, RichTextActionTrigger } from './actions-types.js';

/** Structurally the editor sanitizer's attribute rule, so this file needs no editor import. */
export interface ActionAttributeRule {
    tag: string;
    attr: string;
    requiresAttr?: string;
    validate?: (value: string, element: HTMLElement) => string | null;
}

const ID_PATTERN = /^\w[\w.-]*$/;
const MAX_PARAMS_LENGTH = 4096;
const PRIMITIVE_TYPES = new Set(['string', 'number', 'boolean']);
const TRIGGERS: readonly RichTextActionTrigger[] = ['click', 'hover'];

const idAttr = (trigger: RichTextActionTrigger): string => `data-action-${trigger}`;
const paramsAttr = (trigger: RichTextActionTrigger): string => `data-action-${trigger}-params`;

function isFlatParamsObject(value: unknown): value is ActionParams {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    return Object.values(value).every((v) => PRIMITIVE_TYPES.has(typeof v));
}

/** Returns the id if it is a valid action id, else null. */
export function validateActionId(value: string): string | null {
    return ID_PATTERN.test(value) ? value : null;
}

/** Parses, shape-checks and canonicalizes params JSON; returns the canonical string or null. */
export function validateActionParams(value: string): string | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(value);
    } catch {
        return null;
    }
    if (!isFlatParamsObject(parsed)) return null;
    const canonical = JSON.stringify(parsed);
    return canonical.length <= MAX_PARAMS_LENGTH ? canonical : null;
}

/** Asserts params are a flat object of primitives (the guard before serialization). */
export function assertFlatParams(params: unknown): asserts params is ActionParams {
    if (!isFlatParamsObject(params)) {
        throw new Error('Action params must be a flat object of string | number | boolean values.');
    }
}

/** Writes an action (id + params) for a trigger onto an element. */
export function writeAction(el: HTMLElement, trigger: RichTextActionTrigger, id: string, params: ActionParams): void {
    assertFlatParams(params);
    el.setAttribute(idAttr(trigger), id);
    if (Object.keys(params).length > 0) el.setAttribute(paramsAttr(trigger), JSON.stringify(params));
    else el.removeAttribute(paramsAttr(trigger));
}

/** Removes one trigger's action (id + params) from an element. */
export function removeAction(el: HTMLElement, trigger: RichTextActionTrigger): void {
    el.removeAttribute(idAttr(trigger));
    el.removeAttribute(paramsAttr(trigger));
}

function parseParams(raw: string | null): ActionParams {
    if (!raw) return {};
    try {
        const parsed: unknown = JSON.parse(raw);
        return isFlatParamsObject(parsed) ? parsed : {};
    } catch {
        return {};
    }
}

/** Reads all actions present on an element, click first. */
export function readActions(el: HTMLElement): { trigger: RichTextActionTrigger; id: string; params: ActionParams }[] {
    const out: { trigger: RichTextActionTrigger; id: string; params: ActionParams }[] = [];
    for (const trigger of TRIGGERS) {
        const id = el.getAttribute(idAttr(trigger));
        if (id) out.push({ trigger, id, params: parseParams(el.getAttribute(paramsAttr(trigger))) });
    }
    return out;
}

const toKebab = (key: string): string => key.replaceAll(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

/** Writes a starter-style object onto an element as inline CSS (camelCase keys become kebab properties). */
export function applyStarterStyle(el: HTMLElement, style: Record<string, string>): void {
    for (const [key, value] of Object.entries(style)) el.style.setProperty(toKebab(key), value);
}

/** The browser-canonical inline-style string a seed produces, for the unedited-seed comparison on remove. */
export function computeSeedStyleString(doc: Document, style: Record<string, string>): string {
    const probe = doc.createElement('span');
    applyStarterStyle(probe, style);
    return probe.getAttribute('style') ?? '';
}

/** Removes the `style` attribute only if it is byte-identical to an unedited seed. */
export function stripStyleIfMatches(el: HTMLElement, seed: string): void {
    if (seed !== '' && el.getAttribute('style') === seed) el.removeAttribute('style');
}

/** Writes a combined action: the same id on both triggers, with per-trigger params. */
export function writeCombined(el: HTMLElement, id: string, params: { click: ActionParams; hover: ActionParams }): void {
    writeAction(el, 'click', id, params.click);
    writeAction(el, 'hover', id, params.hover);
}

/** True when both triggers carry an action and share the same id (a combined attach). */
export function isCombinedOnElement(el: HTMLElement): boolean {
    const click = el.dataset['actionClick'];
    return click !== undefined && click === el.dataset['actionHover'];
}

/**
 * The sanitizer rules that let `data-action-*` attributes survive sanitization. An editor with the
 * addon and a page that renders actions with `bindRichTextActions` register the same set.
 */
export const ACTIONS_SANITIZER_RULES: readonly ActionAttributeRule[] = [
    { tag: '*', attr: 'data-action-click', validate: validateActionId },
    { tag: '*', attr: 'data-action-hover', validate: validateActionId },
    { tag: '*', attr: 'data-action-click-params', requiresAttr: 'data-action-click', validate: validateActionParams },
    { tag: '*', attr: 'data-action-hover-params', requiresAttr: 'data-action-hover', validate: validateActionParams },
];
