import { html, nothing, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import type { RichTextActionsLocale } from './actions-locale.js';
import type { RichTextActionTrigger } from './actions-types.js';

/** One row in the edit popover describing an action on the element under the caret. */
export interface PopoverActionRow {
    trigger: RichTextActionTrigger;
    id: string;
    label: string;
    /** False when no registered definition matches the id (remove-only). */
    available: boolean;
    /** True when this row stands for a combined action occupying both triggers. */
    combined?: boolean;
}

export interface ActionsPopoverView {
    readonly rows: readonly PopoverActionRow[];
    /** Offer the "add action" row; false once both triggers are taken. */
    readonly canAdd: boolean;
    readonly locale: RichTextActionsLocale;
    /** Viewport position of the popover's top-left corner. */
    readonly anchor: { left: number; top: number };
    /** Edit the action on this trigger; a combined row carries `'click'`. */
    readonly onEdit: (trigger: RichTextActionTrigger) => void;
    /** Detach the row's action; the whole row is passed so a combined one can strip both attributes. */
    readonly onRemove: (row: PopoverActionRow) => void;
    readonly onAdd: () => void;
}

/** Shows the popover in the native top layer, so it sits above any modal the editor lives in. Lit hands the element over before it is inserted, so this waits a microtask. */
function showInTopLayer(el?: Element): void {
    if (!el) return;
    queueMicrotask(() => {
        if (el.isConnected && !el.matches(':popover-open')) (el as HTMLElement).showPopover();
    });
}

/** A compact panel under an actioned element listing its actions with edit, remove and add. */
export function renderActionsPopover(view: ActionsPopoverView): TemplateResult {
    const { rows, locale } = view;
    const triggerLabel = (row: PopoverActionRow): string =>
        row.combined ? `${locale.triggers.click} / ${locale.triggers.hover}` : locale.triggers[row.trigger];
    return html`<div class="popover" popover="manual" data-slot="rich-text-actions-popover" dir=${locale.rtl ? 'rtl' : nothing}
        style="left:${view.anchor.left}px;top:${view.anchor.top}px" ${ref(showInTopLayer)}>
        ${rows.map((row) => html`
            <div class="row">
                <span class="name">${row.label} · ${triggerLabel(row)}
                    ${row.available ? nothing : html`<span class="hint">${locale.popover.unavailable}</span>`}</span>
                <span class="buttons">
                    ${row.available ? html`<button type="button" data-testid="rta-edit" @click=${() => view.onEdit(row.trigger)}>${locale.popover.edit}</button>` : nothing}
                    <button type="button" data-testid="rta-remove" class="remove" @click=${() => view.onRemove(row)}>${locale.popover.remove}</button>
                </span>
            </div>`)}
        ${view.canAdd ? html`<button type="button" data-testid="rta-add" class="add" @click=${() => view.onAdd()}>${locale.popover.add}</button>` : nothing}
    </div>`;
}
