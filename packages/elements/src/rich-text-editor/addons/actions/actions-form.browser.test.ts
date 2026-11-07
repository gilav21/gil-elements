import { render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';
import { actionFieldsValid, renderActionsForm } from './actions-form.js';
import type { ActionParams, RichTextActionField } from './actions-types.js';

const hosts: HTMLElement[] = [];

afterEach(() => {
    for (const host of hosts.splice(0)) host.remove();
});

/** Renders the form into the page; edits re-render with the new params, as a dialog does. */
function mountForm(fields: RichTextActionField[], initial: ActionParams) {
    const host = document.createElement('div');
    document.body.append(host);
    hosts.push(host);
    const state = { params: initial, latest: initial, valid: actionFieldsValid(fields, initial) };
    const draw = (): void => {
        render(renderActionsForm({
            fields,
            params: state.params,
            requiredTemplate: '{field} is required',
            onChange: (next) => {
                state.params = next;
                state.latest = next;
                state.valid = actionFieldsValid(fields, next);
                draw();
            },
        }), host);
    };
    draw();
    return { host, state, field: (key: string) => host.querySelector<HTMLInputElement>(`[data-field="${key}"]`)! };
}

describe('actions form', () => {
    it('is invalid until a required field is filled, then valid', () => {
        const { state, field } = mountForm([{ key: 'dialogId', label: 'Dialog', type: 'text', required: true }], {});
        expect(state.valid).toBe(false);
        field('dialogId').value = 'pricing';
        field('dialogId').dispatchEvent(new Event('input'));
        expect(state.valid).toBe(true);
    });

    it('emits params changes with correct value types', () => {
        const { state, field } = mountForm([{ key: 'count', label: 'Count', type: 'number' }], {});
        field('count').value = '42';
        field('count').dispatchEvent(new Event('input'));
        expect(state.latest['count']).toBe(42);
    });

    it('renders a checkbox field and emits a boolean param', () => {
        const { state, field } = mountForm([{ key: 'flag', label: 'Flag', type: 'checkbox' }], { flag: true });
        expect(field('flag').checked).toBe(true);
        field('flag').checked = false;
        field('flag').dispatchEvent(new Event('change'));
        expect(state.latest['flag']).toBe(false);
    });

    it('shows a custom validate() error message', () => {
        const { host } = mountForm([{
            key: 'code', label: 'Code', type: 'text',
            validate: (v: unknown) => (String(v).length < 3 ? 'Too short' : null),
        }], { code: 'ab' });
        expect(host.textContent).toContain('Too short');
    });

    it('keeps params with no matching field untouched', () => {
        const { state, field } = mountForm([{ key: 'a', label: 'A', type: 'text' }], { extra: 'kept' });
        field('a').value = 'x';
        field('a').dispatchEvent(new Event('input'));
        expect(state.latest).toEqual({ extra: 'kept', a: 'x' });
    });

    it('a select shows its placeholder until a value is set, and reports the chosen option', () => {
        const { state, field } = mountForm([{
            key: 'size', label: 'Size', type: 'select', placeholder: 'Pick one',
            options: [{ value: 's', label: 'Small' }, { value: 'l', label: 'Large' }],
        }], {});
        const select = field('size') as unknown as HTMLSelectElement;
        expect(select.selectedOptions[0]?.textContent).toBe('Pick one');
        select.value = 'l';
        select.dispatchEvent(new Event('change'));
        expect(state.latest['size']).toBe('l');
    });
});
