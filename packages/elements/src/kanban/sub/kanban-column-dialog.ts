import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import type { KanbanColumn, KanbanColumnDialogMode } from '../kanban-types.js';
import { KANBAN_LOCALES, type KanbanLocale } from '../kanban.locales.js';
import css from './kanban-dialogs.css?inline';

/** `detail` of `submitted`. */
export interface KanbanColumnDialogSubmit {
    mode: KanbanColumnDialogMode;
    name?: string;
    wipLimit?: number;
    columnId?: string;
}

/**
 * The form the board opens to add a column, rename one, or set its WIP limit. It owns no board state: it reports the form
 * on `submitted` (the name trimmed, the limit a positive integer or `undefined`) and closes.
 *
 * @fires submitted - The user submitted; `detail` is `{ mode, name?, wipLimit?, columnId? }`.
 */
export class GeKanbanColumnDialog extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        locale: { attribute: false },
        dialogOpen: { state: true },
        mode: { state: true },
        formName: { state: true },
        formWip: { state: true },
    };

    declare locale: KanbanLocale;
    declare dialogOpen: boolean;
    declare mode: KanbanColumnDialogMode;
    declare formName: string;
    declare formWip: string;
    private editingColumnId = '';

    constructor() {
        super();
        this.locale = KANBAN_LOCALES['en'] as KanbanLocale;
        this.dialogOpen = false;
        this.mode = 'add-column';
        this.formName = '';
        this.formWip = '';
    }

    /** Opens empty, showing the name and the WIP limit. */
    openAddColumn(): void {
        this.begin('add-column', '', '', '');
    }

    /** Opens prefilled with `column.title`; the column's WIP limit is left alone. */
    openRenameColumn(column: KanbanColumn): void {
        this.begin('rename-column', column.title, '', column.id);
    }

    /** Opens prefilled with the column's limit. An empty or non-positive entry clears it. */
    openSetWip(column: KanbanColumn): void {
        this.begin('set-wip', '', column.wipLimit?.toString() ?? '', column.id);
    }

    private begin(mode: KanbanColumnDialogMode, name: string, wip: string, columnId: string): void {
        this.mode = mode;
        this.formName = name;
        this.formWip = wip;
        this.editingColumnId = columnId;
        this.dialogOpen = true;
    }

    private get showName(): boolean {
        return this.mode === 'add-column' || this.mode === 'rename-column';
    }

    private get showWip(): boolean {
        return this.mode === 'add-column' || this.mode === 'set-wip';
    }

    private get canSubmit(): boolean {
        return this.showName ? this.formName.trim().length > 0 : true;
    }

    private get heading(): string {
        if (this.mode === 'add-column') return this.locale.addColumn;
        return this.mode === 'rename-column' ? this.locale.renameColumn : this.locale.setWipLimit;
    }

    private get submitLabel(): string {
        if (this.mode === 'add-column') return this.locale.addColumn;
        return this.mode === 'rename-column' ? this.locale.rename : this.locale.setLimit;
    }

    private submit(): void {
        const wip = Number.parseInt(this.formWip, 10);
        this.dispatchEvent(
            new CustomEvent<KanbanColumnDialogSubmit>('submitted', {
                detail: {
                    mode: this.mode,
                    name: this.formName.trim() || undefined,
                    wipLimit: Number.isNaN(wip) || wip <= 0 ? undefined : wip,
                    columnId: this.editingColumnId || undefined,
                },
            }),
        );
        this.dialogOpen = false;
    }

    protected override render() {
        const l = this.locale;
        return html`<ge-dialog ?open=${this.dialogOpen} @open-change=${(e: CustomEvent<boolean>) => (this.dialogOpen = e.detail)}>
            <ge-dialog-content>
                <ge-dialog-header><ge-dialog-title>${this.heading}</ge-dialog-title></ge-dialog-header>
                <div class="form" data-slot="kanban-column-dialog-form">
                    ${this.showName
                        ? html`<div class="field">
                              <ge-label>${l.columnNameLabel}</ge-label>
                              <ge-input .value=${this.formName} placeholder=${l.columnNamePlaceholder} @input=${(e: Event) => (this.formName = (e.target as HTMLInputElement).value)}></ge-input>
                          </div>`
                        : nothing}
                    ${this.showWip
                        ? html`<div class="field">
                              <ge-label>${l.wipLimitLabel}</ge-label>
                              <ge-input type="number" .value=${this.formWip} placeholder=${l.noLimitPlaceholder} @input=${(e: Event) => (this.formWip = (e.target as HTMLInputElement).value)}></ge-input>
                          </div>`
                        : nothing}
                </div>
                <ge-dialog-footer>
                    <ge-button variant="outline" @click=${() => (this.dialogOpen = false)}>${l.cancel}</ge-button>
                    <ge-button ?disabled=${!this.canSubmit} @click=${() => this.submit()}>${this.submitLabel}</ge-button>
                </ge-dialog-footer>
            </ge-dialog-content>
        </ge-dialog>`;
    }
}
