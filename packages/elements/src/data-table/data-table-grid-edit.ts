/**
 * The cell editor's markup (wave 5, package B owns this file). `GridView.edit.cell` is called from the body cell that holds the open editor
 * (`data-editing`); `aria-invalid` and `aria-describedby` are set on the editor's own input here. The state and the handlers are the edit
 * session's (`data-table-edit-session.ts`, reached through `editSessionOf(host)`).
 *
 * Angular's markup (html 207-290): a borderless native `input` (text, number) or `select` filling the cell, `ge-checkbox`, `ge-date-picker`,
 * a consumer component or an `editRenderer`, then `p[role=alert][data-slot=cell-edit-error]` while a commit is rejected. One wrapper,
 * `div[data-slot=data-table-cell-editor]`, stacks the message UNDER the input (the row grows, D19); with fixed-height virtual rows the
 * message is overlaid under the cell instead (`data-overlay`), so row heights stay constant.
 */
import { html, nothing, type TemplateResult } from 'lit';
import { live } from 'lit/directives/live.js';
import { componentCell } from './data-table-component-cell.js';
import { editSessionOf, type EditSession, type OpenEditor } from './data-table-edit-session.js';
import { isBuiltInKind, optionIndexOf } from './data-table-edit.js';
import type { DataTableViewHost } from './data-table-view.js';
import type { ComponentOutputs, EnhancedColumnDef } from './data-table.types.js';
import { asEditableDate } from './data-table.utils.js';

export interface EditView<T> {
    /** The editor to draw in place of the cell's content, or `undefined` when this cell is not being edited. */
    cell(column: EnhancedColumnDef<T>, row: T, rowIndex: number): unknown | undefined;
}

/** Nothing is edited. A constant, so a render without an open editor allocates no view. */
const NO_EDIT: EditView<unknown> = Object.freeze({ cell: () => undefined });

export function editView<T>(host: DataTableViewHost<T>): EditView<T> {
    const session = editSessionOf<T>(host);
    const open = session?.current();
    if (!session || !open) return NO_EDIT as EditView<T>;
    // Fixed-height virtual rows: a message in the flow would change the row's height under the window's arithmetic.
    const overlay = (host.provider('virtual')?.active() ?? false) && !host.config.virtualVariableRowHeight;
    return {
        cell: (column, row, rowIndex) => (rowIndex === open.at.rowIndex && String(column.accessorKey) === open.at.columnKey ? editorOf(session, open, row, overlay) : undefined),
    };
}

/** A component editor's listeners, built once per open editor: the component cell keeps them while their identity is unchanged. */
const outputsByEditor = new WeakMap<object, ComponentOutputs>();

function outputsOf<T>(session: EditSession<T>, open: OpenEditor<T>): ComponentOutputs {
    let outputs = outputsByEditor.get(open);
    if (!outputs) {
        outputs = {
            'value-change': (event) => session.setDraft(open, (event as CustomEvent).detail),
            change: (event) => session.setDraft(open, (event.target as { value?: unknown } | null)?.value),
            commit: () => session.commitFrom(open),
            cancel: () => session.cancelFrom(open),
        };
        outputsByEditor.set(open, outputs);
    }
    return outputs;
}

/** Select editors the pointer is picking in (a press opened its list): their next `change` commits. */
const pointerPicks = new WeakSet<object>();

const text = (value: unknown): string => (value === null || value === undefined ? '' : String(value));

function editorOf<T>(session: EditSession<T>, open: OpenEditor<T>, row: T, overlay: boolean): TemplateResult {
    const { column, kind } = open;
    const message = open.error?.message ?? null;
    const invalid = message !== null;
    const label = session.label(open);
    const describedBy = invalid ? open.errorId : nothing;
    const ariaInvalid = invalid ? 'true' : nothing;
    let editor: unknown;
    switch (kind) {
        case 'component':
            editor = componentCell(column.editComponent as string, { value: open.draft, row, column, rowIndex: open.at.rowIndex, error: message }, outputsOf(session, open));
            break;
        case 'renderer':
            editor = column.editRenderer?.({
                row,
                value: open.draft,
                column,
                rowIndex: open.at.rowIndex,
                error: message,
                setValue: (value) => session.setDraft(open, value),
                commit: () => session.commitFrom(open),
                cancel: () => session.cancelFrom(open),
            });
            break;
        case 'checkbox':
            editor = html`<ge-checkbox data-edit-input .checked=${!!open.shown} aria-label=${label} aria-invalid=${ariaInvalid} aria-describedby=${describedBy}
                @change=${(event: Event) => session.change(open, (event.target as { checked?: boolean }).checked)}></ge-checkbox>`;
            break;
        case 'date':
            // The trigger's own text (the date, or the placeholder) is its name; a label on the host would sit on an element with no role. The
            // error reaches the trigger (the focusable part, in the picker's shadow root, where no id reference can point) through `invalid` and
            // `errorMessage` (its aria-invalid and aria-description).
            editor = html`<ge-date-picker data-edit-input .date=${asEditableDate(open.shown)} .invalid=${invalid} .errorMessage=${message ?? ''}
                @date-change=${(event: CustomEvent<unknown>) => session.change(open, event.detail)}></ge-date-picker>`;
            break;
        case 'select': {
            const options = column.editOptions ?? [];
            const selected = optionIndexOf(options, open.shown);
            // Each option carries its INDEX: the session maps it back to the option's value, of whatever type (B4). A value no option holds shows an
            // empty, selected placeholder (not the first option, which would then be unpickable: choosing it fires no `change`).
            // A pick with the POINTER (the picker list) commits at once, as Angular; a change from the keyboard (arrows on the closed select) moves
            // only the draft, which Enter, Tab or leaving commits.
            editor = html`<select data-edit-input aria-label=${label} aria-invalid=${ariaInvalid} aria-describedby=${describedBy}
                @pointerdown=${() => pointerPicks.add(open)} @keydown=${() => pointerPicks.delete(open)}
                @change=${(event: Event) => session.change(open, (event.target as HTMLSelectElement).value, pointerPicks.delete(open))}>${selected === -1 ? html`<option value="" selected disabled data-placeholder></option>` : nothing}${options.map(
                    (o, i) => html`<option value=${i} ?selected=${i === selected}>${o.label}</option>`,
                )}</select>`;
            break;
        }
        default:
            // `.value` is the SHOWN text, compared with the DOM (`live`): typing keeps it equal to what the input holds (so a render never resets the
            // caret), and `setEditValue` always reaches the input, even with the value it had set before the user typed over it.
            editor = html`<input data-edit-input type=${kind === 'number' ? 'number' : 'text'} .value=${live(text(open.shown))} aria-label=${label} aria-invalid=${ariaInvalid} aria-describedby=${describedBy}
                @input=${(event: Event) => {
                    const input = event.target as HTMLInputElement;
                    session.input(open, input.value, input.validity.badInput);
                }} />`;
    }
    const builtIn = isBuiltInKind(kind);
    return html`<div data-slot="data-table-cell-editor" data-kind=${kind} ?data-invalid=${invalid} @focusout=${builtIn ? (event: FocusEvent) => session.leave(open, event) : nothing}>${editor}${invalid
        ? html`<p id=${open.errorId} data-slot="cell-edit-error" role="alert" ?data-overlay=${overlay}>${message}</p>`
        : nothing}</div>`;
}
