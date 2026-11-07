import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import type { KanbanColumn, KanbanColumnDeleteEvent } from '../kanban-types.js';
import { KANBAN_LOCALES, type KanbanLocale } from '../kanban.locales.js';
import css from './kanban-dialogs.css?inline';

/**
 * The confirmation the board opens before a column goes. When the column holds cards it asks where they should go. It
 * deletes nothing: it reports the choice on `confirmed` and closes.
 *
 * @fires confirmed - The user confirmed; `detail` is `{ columnId, moveCardsTo }`. `moveCardsTo` is `undefined` for "delete the cards too".
 * @prop {KanbanColumn[]} columns - Every column on the board, including the one being deleted. With a single column there is nowhere to move cards, and the dialog warns that they go too.
 */
export class GeKanbanDeleteColumnDialog extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        locale: { attribute: false },
        columns: { attribute: false },
        dialogOpen: { state: true },
        columnToDelete: { state: true },
        cardCount: { state: true },
        selectedTarget: { state: true },
    };

    declare locale: KanbanLocale;
    declare columns: KanbanColumn[];
    declare dialogOpen: boolean;
    declare columnToDelete: KanbanColumn | undefined;
    declare cardCount: number;
    declare selectedTarget: string | undefined;

    constructor() {
        super();
        this.locale = KANBAN_LOCALES['en'] as KanbanLocale;
        this.columns = [];
        this.dialogOpen = false;
        this.columnToDelete = undefined;
        this.cardCount = 0;
        this.selectedTarget = undefined;
    }

    /** Opens for `column`, forgetting any earlier choice. `cardCount` decides whether the card picker shows. */
    open(column: KanbanColumn, cardCount: number): void {
        this.columnToDelete = column;
        this.cardCount = cardCount;
        this.selectedTarget = undefined;
        this.dialogOpen = true;
    }

    private get isLastColumn(): boolean {
        return this.columns.length <= 1;
    }

    private moveOptions(): { label: string; value: string | undefined }[] {
        const column = this.columnToDelete;
        if (!column) return [];
        const options: { label: string; value: string | undefined }[] = this.columns
            .filter((c) => c.id !== column.id)
            .map((c) => ({ label: `${this.locale.moveToColumn} "${c.title}"`, value: c.id }));
        options.push({ label: this.locale.deleteAllCards, value: undefined });
        return options;
    }

    private confirm(): void {
        const column = this.columnToDelete;
        if (!column) return;
        this.dispatchEvent(new CustomEvent<KanbanColumnDeleteEvent>('confirmed', { detail: { columnId: column.id, moveCardsTo: this.selectedTarget } }));
        this.dialogOpen = false;
    }

    protected override render() {
        const l = this.locale;
        let description = l.deleteEmptyColumn;
        if (this.isLastColumn) description = l.lastColumnWarning;
        else if (this.cardCount > 0) description = l.columnHasCards;
        return html`<ge-alert-dialog ?open=${this.dialogOpen} @open-change=${(e: CustomEvent<boolean>) => (this.dialogOpen = e.detail)}>
            <ge-alert-dialog-content>
                <ge-alert-dialog-header>
                    <ge-alert-dialog-title>${l.deleteColumn}</ge-alert-dialog-title>
                    <ge-alert-dialog-description>${description}</ge-alert-dialog-description>
                </ge-alert-dialog-header>
                ${!this.isLastColumn && this.cardCount > 0
                    ? html`<div class="options" data-slot="kanban-delete-column-options">
                          ${this.moveOptions().map(
                              (option) => html`<button type="button" class="option" aria-pressed=${this.selectedTarget === option.value} @click=${() => (this.selectedTarget = option.value)}>${option.label}</button>`,
                          )}
                      </div>`
                    : nothing}
                <ge-alert-dialog-footer>
                    <ge-alert-dialog-cancel>${l.cancel}</ge-alert-dialog-cancel>
                    <ge-button variant="destructive" @click=${() => this.confirm()}>${l.deleteColumn}</ge-button>
                </ge-alert-dialog-footer>
            </ge-alert-dialog-content>
        </ge-alert-dialog>`;
    }
}
