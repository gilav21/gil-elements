import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import type { KanbanCard, KanbanCardAddEvent, KanbanLabel } from '../kanban-types.js';
import { KANBAN_LOCALES, type KanbanLocale } from '../kanban.locales.js';
import css from './kanban-dialogs.css?inline';

const LABEL_PRESETS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];
const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };

type Priority = NonNullable<KanbanCard['priority']> | 'none';
type Assignee = { name: string; avatar?: string };

/** `detail` of `submitted`. */
export interface KanbanCardDialogSubmit {
    mode: 'add' | 'edit';
    columnId: string;
    /** The original card in edit mode. */
    card?: KanbanCard;
    data: KanbanCardAddEvent;
}

/**
 * The form the board opens to add or edit a card. It owns no board state: it reports the form on `submitted` and closes.
 *
 * @fires submitted - The user saved; `detail` is `{ mode, columnId, card?, data }`.
 * @attr {boolean} have-labels - Shows the label editor and its preset colours. On by default; `have-labels="false"` hides it.
 * @attr {boolean} have-assignees - Shows the assignee editor. On by default; `have-assignees="false"` hides it.
 * @prop {{ name: string, avatar?: string }[]} assigneeOptions - Known assignees. Non-empty switches the field to a multi-select autocomplete that keeps each avatar.
 */
export class GeKanbanCardDialog extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        locale: { attribute: false },
        haveLabels: { attribute: 'have-labels', converter: defaultTrue },
        haveAssignees: { attribute: 'have-assignees', converter: defaultTrue },
        assigneeOptions: { attribute: false },
        dialogOpen: { state: true },
        mode: { state: true },
        formTitle: { state: true },
        formDescription: { state: true },
        formPriority: { state: true },
        formLabels: { state: true },
        formAssignees: { state: true },
        newLabelColor: { state: true },
    };

    declare locale: KanbanLocale;
    declare haveLabels: boolean;
    declare haveAssignees: boolean;
    declare assigneeOptions: Assignee[];
    declare dialogOpen: boolean;
    declare mode: 'add' | 'edit';
    declare formTitle: string;
    declare formDescription: string;
    declare formPriority: KanbanCard['priority'] | undefined;
    declare formLabels: KanbanLabel[];
    declare formAssignees: Assignee[];
    declare newLabelColor: string;
    private editingCard?: KanbanCard;
    private targetColumnId = '';

    constructor() {
        super();
        this.locale = KANBAN_LOCALES['en'] as KanbanLocale;
        this.haveLabels = true;
        this.haveAssignees = true;
        this.assigneeOptions = [];
        this.dialogOpen = false;
        this.mode = 'add';
        this.formTitle = '';
        this.formDescription = '';
        this.formPriority = undefined;
        this.formLabels = [];
        this.formAssignees = [];
        this.newLabelColor = LABEL_PRESETS[0] as string;
    }

    /** Resets the form, prefilled from `card` in edit mode, and opens it. `columnId` is the column a new card lands in. */
    open(mode: 'add' | 'edit', columnId: string, card?: KanbanCard): void {
        this.mode = mode;
        this.targetColumnId = columnId;
        this.editingCard = card;
        this.formTitle = card?.title ?? '';
        this.formDescription = card?.description ?? '';
        this.formPriority = card?.priority;
        this.formLabels = card?.labels ? [...card.labels] : [];
        this.formAssignees = card?.assignees ? [...card.assignees] : [];
        this.newLabelColor = LABEL_PRESETS[0] as string;
        this.dialogOpen = true;
    }

    private priorityOptions(): { label: string; value: Priority }[] {
        const l = this.locale;
        return [
            { label: l.priorityLow, value: 'low' },
            { label: l.priorityMedium, value: 'medium' },
            { label: l.priorityHigh, value: 'high' },
            { label: l.priorityUrgent, value: 'urgent' },
            { label: l.priorityNone, value: 'none' },
        ];
    }

    private readonly onLabelAdded = (event: Event) => {
        const text = (event as CustomEvent<string>).detail;
        this.formLabels = [...this.formLabels, { text, color: this.newLabelColor }];
    };

    private readonly onLabelRemoved = (event: Event) => {
        const text = (event as CustomEvent<string>).detail;
        this.formLabels = this.formLabels.filter((label) => label.text !== text);
    };

    private readonly onAssigneeAdded = (event: Event) => {
        const name = (event as CustomEvent<string>).detail;
        const option = this.assigneeOptions.find((a) => a.name === name);
        this.formAssignees = [...this.formAssignees, option ?? { name }];
    };

    private readonly onAssigneeRemoved = (event: Event) => {
        const name = (event as CustomEvent<string>).detail;
        this.formAssignees = this.formAssignees.filter((a) => a.name !== name);
    };

    private readonly onAssigneeSelection = (event: Event) => {
        const names = (event as CustomEvent<string[]>).detail;
        this.formAssignees = names.map((name) => this.formAssignees.find((a) => a.name === name) ?? this.assigneeOptions.find((a) => a.name === name) ?? { name });
    };

    private submit(): void {
        const title = this.formTitle.trim();
        if (!title) return;
        const data: KanbanCardAddEvent = {
            columnId: this.targetColumnId,
            title,
            description: this.formDescription.trim() || undefined,
            priority: this.formPriority,
            labels: this.formLabels.length > 0 ? this.formLabels : undefined,
            assignees: this.formAssignees.length > 0 ? this.formAssignees : undefined,
        };
        this.dispatchEvent(
            new CustomEvent<KanbanCardDialogSubmit>('submitted', {
                detail: { mode: this.mode, columnId: this.targetColumnId, card: this.editingCard, data },
            }),
        );
        this.dialogOpen = false;
    }

    private readonly onField = (setter: (value: string) => void) => (event: Event) => setter((event.target as HTMLInputElement).value);

    protected override render() {
        const l = this.locale;
        const adding = this.mode === 'add';
        const names = this.assigneeOptions.map((a) => a.name);
        const assigneeNames = this.formAssignees.map((a) => a.name);
        const colors: Record<string, string> = {};
        for (const label of this.formLabels) colors[label.text] = label.color;
        return html`<ge-dialog ?open=${this.dialogOpen} @open-change=${(e: CustomEvent<boolean>) => (this.dialogOpen = e.detail)}>
            <ge-dialog-content>
                <ge-dialog-header><ge-dialog-title>${adding ? l.addCard : l.editCard}</ge-dialog-title></ge-dialog-header>
                <div class="form" data-slot="kanban-card-dialog-form">
                    <div class="field">
                        <ge-label>${l.titleRequired}</ge-label>
                        <ge-input .value=${this.formTitle} placeholder=${l.cardTitlePlaceholder} @input=${this.onField((v) => (this.formTitle = v))}></ge-input>
                    </div>
                    <div class="field">
                        <ge-label>${l.descriptionLabel}</ge-label>
                        <ge-textarea .value=${this.formDescription} rows="3" placeholder=${l.optionalDescriptionPlaceholder} @input=${this.onField((v) => (this.formDescription = v))}></ge-textarea>
                    </div>
                    <div class="field">
                        <ge-label>${l.priorityLabel}</ge-label>
                        <div class="row">
                            ${this.priorityOptions().map((p) => {
                                const selected = p.value === 'none' ? !this.formPriority : p.value === this.formPriority;
                                return html`<button type="button" class="choice" aria-pressed=${selected} @click=${() => (this.formPriority = p.value === 'none' ? undefined : p.value)}>${p.label}</button>`;
                            })}
                        </div>
                    </div>
                    ${this.haveLabels
                        ? html`<div class="field">
                              <ge-label>${l.labelsLabel}</ge-label>
                              <ge-chip-list
                                  .chipColors=${colors}
                                  .value=${this.formLabels.map((label) => label.text)}
                                  max-rows="3"
                                  placeholder=${l.labelTextPlaceholder}
                                  @chip-added=${this.onLabelAdded}
                                  @chip-removed=${this.onLabelRemoved}
                              ></ge-chip-list>
                              <div class="row">
                                  <span class="swatch-hint">${l.labelsLabel}:</span>
                                  ${LABEL_PRESETS.map(
                                      (color) => html`<button type="button" class="swatch" aria-label=${color} aria-pressed=${this.newLabelColor === color} style="background-color:${color}" @click=${() => (this.newLabelColor = color)}></button>`,
                                  )}
                              </div>
                          </div>`
                        : nothing}
                    ${this.haveAssignees
                        ? html`<div class="field">
                              <ge-label>${l.assigneesLabel}</ge-label>
                              ${names.length > 0
                                  ? html`<ge-autocomplete .options=${names} multiple placeholder=${l.assigneePlaceholder} .value=${assigneeNames} @value-change=${this.onAssigneeSelection}></ge-autocomplete>`
                                  : html`<ge-chip-list placeholder=${l.assigneePlaceholder} .value=${assigneeNames} @chip-added=${this.onAssigneeAdded} @chip-removed=${this.onAssigneeRemoved}></ge-chip-list>`}
                          </div>`
                        : nothing}
                </div>
                <ge-dialog-footer>
                    <ge-button variant="outline" @click=${() => (this.dialogOpen = false)}>${l.cancel}</ge-button>
                    <ge-button ?disabled=${!this.formTitle.trim()} @click=${() => this.submit()}>${adding ? l.addCard : l.saveChanges}</ge-button>
                </ge-dialog-footer>
            </ge-dialog-content>
        </ge-dialog>`;
    }
}
