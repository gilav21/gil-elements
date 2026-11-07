import { html, nothing, type TemplateResult } from 'lit';
import { interpolate } from '../../rich-text-locales.js';
import type { ActionParams, RichTextActionField } from './actions-types.js';

const isEmpty = (value: unknown): boolean => value === undefined || value === null || value === '';

function fieldError(field: RichTextActionField, value: unknown, requiredTemplate: string): string | null {
    if (isEmpty(value)) return field.required ? interpolate(requiredTemplate, { field: field.label }) : null;
    return field.validate?.(value) ?? null;
}

/** The validation message per field key, null where the field passes. */
export function actionFieldErrors(
    fields: readonly RichTextActionField[], params: ActionParams, requiredTemplate: string,
): Record<string, string | null> {
    return Object.fromEntries(fields.map((f) => [f.key, fieldError(f, params[f.key], requiredTemplate)]));
}

/** Whether every field passes `required` and its own `validate`. */
export function actionFieldsValid(fields: readonly RichTextActionField[], params: ActionParams): boolean {
    return Object.values(actionFieldErrors(fields, params, '')).every((error) => error === null);
}

/** Coerces a raw control value by the field type; an unparseable number becomes `NaN`, which still counts as filled. */
export function coerceFieldValue(field: RichTextActionField, raw: string | boolean): string | number | boolean {
    if (field.type === 'checkbox') return Boolean(raw);
    if (field.type === 'number') return Number(raw);
    return String(raw);
}

export interface ActionsFormView {
    readonly fields: readonly RichTextActionField[];
    /** Current values; keys with no field are preserved and passed on untouched. */
    readonly params: ActionParams;
    /** `{field}` is replaced with the label. */
    readonly requiredTemplate: string;
    /** Receives the complete params object after each edit. */
    readonly onChange: (params: ActionParams) => void;
}

/** Renders the declarative (tier 1) fields: one control per field, chosen by its type. */
export function renderActionsForm(view: ActionsFormView): TemplateResult {
    const { fields, params, requiredTemplate, onChange } = view;
    const errors = actionFieldErrors(fields, params, requiredTemplate);
    const edit = (field: RichTextActionField, raw: string | boolean): void =>
        onChange({ ...params, [field.key]: coerceFieldValue(field, raw) });
    const text = (key: string): string => (Object.hasOwn(params, key) ? String(params[key]) : '');
    const control = (field: RichTextActionField): TemplateResult => {
        const id = `rtaf-${field.key}`;
        const onInput = (e: Event): void => edit(field, (e.target as HTMLInputElement).value);
        switch (field.type) {
            case 'textarea':
                return html`<textarea id=${id} data-field=${field.key} .value=${text(field.key)} placeholder=${field.placeholder ?? ''} @input=${onInput}></textarea>`;
            case 'checkbox':
                return html`<input type="checkbox" id=${id} data-field=${field.key} .checked=${Boolean(params[field.key])}
                    @change=${(e: Event) => edit(field, (e.target as HTMLInputElement).checked)} />`;
            case 'select':
                return html`<select id=${id} data-field=${field.key} .value=${text(field.key)}
                    @change=${(e: Event) => edit(field, (e.target as HTMLSelectElement).value)}>
                    <option value="" disabled ?selected=${text(field.key) === ''}>${field.placeholder ?? 'Select…'}</option>
                    ${(field.options ?? []).map((o) => html`<option value=${o.value} ?selected=${text(field.key) === o.value}>${o.label}</option>`)}
                </select>`;
            default:
                return html`<input type=${field.type === 'number' ? 'number' : 'text'} id=${id} data-field=${field.key}
                    .value=${text(field.key)} placeholder=${field.placeholder ?? ''} @input=${onInput} />`;
        }
    };
    return html`<div class="form">${fields.map((field) => html`
        <div class="field">
            <label for=${`rtaf-${field.key}`}>${field.label}${field.required ? html`<span class="required"> *</span>` : nothing}</label>
            ${control(field)}
            ${field.description ? html`<p class="hint">${field.description}</p>` : nothing}
            ${errors[field.key] ? html`<p class="error">${errors[field.key]}</p>` : nothing}
        </div>`)}</div>`;
}
