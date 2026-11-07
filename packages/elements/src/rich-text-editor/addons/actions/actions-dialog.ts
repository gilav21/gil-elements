import { html, nothing, type TemplateResult } from 'lit';
import '../../../button/define.js';
import '../../../dialog/define.js';
import { interpolate } from '../../rich-text-locales.js';
import { actionFieldsValid, renderActionsForm } from './actions-form.js';
import type { RichTextActionsLocale } from './actions-locale.js';
import type {
    ActionParams, ActionParamsMode, ActionTargetKind, RichTextActionDefinition,
    RichTextActionParamsForm, RichTextActionTrigger,
} from './actions-types.js';

/** What the attach/edit dialog is opened for. */
export interface ActionsDialogContext {
    mode: 'create' | 'edit';
    targetKind: ActionTargetKind;
    selectionText: string;
    /** Triggers already taken on the target; they get a "replaces existing" hint and flip Attach to Replace. */
    occupiedTriggers: RichTextActionTrigger[];
    /** Edit mode: the action to start from. */
    prefill: {
        def: RichTextActionDefinition;
        trigger: RichTextActionTrigger;
        params: ActionParams;
        /** Hover params, supplied when editing a combined `paramsMode:'separate'` action. */
        hoverParams?: ActionParams;
    } | null;
}

/** The confirmed attach/edit payload. */
export interface ActionsDialogConfirm {
    def: RichTextActionDefinition;
    trigger: RichTextActionTrigger;
    params: ActionParams;
    /** Present when `def.combined`: per-trigger params for both attributes; the caller branches on this, not on `trigger`. */
    combinedParams?: { click: ActionParams; hover: ActionParams };
}

export interface ActionsDialogOptions {
    /** The full catalogue; the picker filters it by target kind and search text. */
    definitions: readonly RichTextActionDefinition[];
    context: ActionsDialogContext;
    locale: RichTextActionsLocale;
    /** Called after every state change, so the owner re-renders. */
    requestUpdate(): void;
    /** Fires only while the form is valid. The dialog does not close itself: the owner tears it down once the action applied. */
    onConfirm(payload: ActionsDialogConfirm): void;
    /** Cancel button, Escape, backdrop or the close button. */
    onDismiss(): void;
    /** A definition was selected in the picker, before any params are gathered. */
    onPick(def: RichTextActionDefinition): void;
}

const hasFields = (fields: readonly unknown[] | undefined): boolean => (fields?.length ?? 0) > 0;

/** Attach/edit dialog: a searchable action picker plus the form that gathers the picked action's params. */
export class ActionsDialog {
    query = '';
    selectedDef: RichTextActionDefinition | null = null;
    selectedTrigger: RichTextActionTrigger | null = null;
    busy = false;
    private clickParams: ActionParams = {};
    private hoverParams: ActionParams = {};
    private clickValid = false;
    private hoverValid = true;
    private customForm: RichTextActionParamsForm | null = null;

    constructor(private readonly options: ActionsDialogOptions) {
        const { prefill } = options.context;
        if (!prefill) return;
        this.select(prefill.def.id);
        this.selectedTrigger = prefill.trigger;
        this.clickParams = { ...prefill.params };
        this.clickValid = true;
        if (prefill.hoverParams) this.hoverParams = { ...prefill.hoverParams };
    }

    private get locale(): RichTextActionsLocale {
        return this.options.locale;
    }

    get isCombined(): boolean {
        return this.selectedDef?.combined === true && this.selectedDef.triggers.length >= 2;
    }

    /** `separate` supports tier-1 `fieldsByTrigger` only; a form tag or `resolveParams` falls back to `shared`. */
    get paramsMode(): ActionParamsMode {
        const def = this.selectedDef;
        if (!def?.combined || def.paramsMode !== 'separate') return 'shared';
        return def.formTag || def.resolveParams ? 'shared' : 'separate';
    }

    get visibleDefs(): RichTextActionDefinition[] {
        const q = this.query.toLowerCase();
        const { targetKind } = this.options.context;
        return this.options.definitions
            .filter((d) => (d.targets ?? ['text', 'image']).includes(targetKind))
            .filter((d) => !q || d.label.toLowerCase().includes(q) || (d.description ?? '').toLowerCase().includes(q));
    }

    /** The params as the form holds them now: a custom form element is read live. */
    get params(): ActionParams {
        return this.customForm?.params ?? this.clickParams;
    }

    private get formValid(): boolean {
        return this.customForm?.valid ?? this.clickValid;
    }

    get canConfirm(): boolean {
        const def = this.selectedDef;
        if (!def || def.resolveParams) return false;
        if (this.isCombined) return this.formValid && (this.paramsMode === 'shared' || this.hoverValid);
        if (!this.selectedTrigger) return false;
        return def.formTag || hasFields(def.fields) ? this.formValid : true;
    }

    get confirmLabel(): string {
        return this.isOccupied() ? this.locale.dialog.replace : this.locale.dialog.attach;
    }

    private isOccupied(): boolean {
        const occupied = this.options.context.occupiedTriggers;
        if (this.isCombined) return occupied.includes('click') || occupied.includes('hover');
        return !!this.selectedTrigger && occupied.includes(this.selectedTrigger);
    }

    /**
     * Selects the definition with `id` and resets the form around it: the initial trigger (the only
     * one, `click` for a combined action, otherwise none), the params from the prefill when it is for
     * this same action, and validity. An unknown id clears the selection and announces nothing.
     */
    pickAction(id: string): void {
        this.select(id);
        if (this.selectedDef) this.options.onPick(this.selectedDef);
        this.options.requestUpdate();
    }

    private select(id: string): void {
        const def = this.options.definitions.find((d) => d.id === id) ?? null;
        const prefill = this.options.context.prefill;
        this.selectedDef = def;
        this.selectedTrigger = this.initialTrigger(def);
        this.clickParams = prefill?.def.id === id ? { ...prefill.params } : {};
        this.hoverParams = {};
        this.clickValid = !!def && !def.formTag && !hasFields(def.fields);
        this.hoverValid = true;
        this.syncCustomForm();
    }

    private initialTrigger(def: RichTextActionDefinition | null): RichTextActionTrigger | null {
        if (def?.triggers.length === 1) return def.triggers[0] ?? null;
        return def?.combined ? 'click' : null;
    }

    private syncCustomForm(): void {
        this.customForm = null;
        const def = this.selectedDef;
        if (!def?.formTag || def.resolveParams) return;
        const form = document.createElement(def.formTag) as RichTextActionParamsForm;
        const { context } = this.options;
        form.context = {
            mode: context.mode, trigger: this.selectedTrigger ?? def.triggers[0] ?? 'click',
            currentParams: this.clickParams, selectionText: context.selectionText,
            targetKind: context.targetKind, targetElement: null,
        };
        form.params = { ...this.clickParams };
        const refresh = (): void => this.options.requestUpdate();
        form.addEventListener('change', refresh);
        form.addEventListener('input', refresh);
        this.customForm = form;
    }

    /** Freezes the picker while the owner runs an external `resolveParams` flow it started from `onPick`. */
    setBusy(value: boolean): void {
        this.busy = value;
        this.options.requestUpdate();
    }

    selectTrigger(trigger: RichTextActionTrigger): void {
        this.selectedTrigger = trigger;
        this.options.requestUpdate();
    }

    /** Emits the confirm payload; a silent no-op while the form is incomplete or no trigger is chosen. */
    confirm(): void {
        const def = this.selectedDef;
        if (!def || !this.canConfirm) return;
        const shared = this.params;
        if (this.isCombined) {
            const hover = this.paramsMode === 'separate' ? this.hoverParams : { ...shared };
            this.options.onConfirm({ def, trigger: 'click', params: shared, combinedParams: { click: shared, hover } });
            return;
        }
        if (this.selectedTrigger) this.options.onConfirm({ def, trigger: this.selectedTrigger, params: shared });
    }

    dismiss(): void {
        this.options.onDismiss();
    }

    private triggerLabels(triggers: readonly RichTextActionTrigger[]): string {
        return triggers.map((t) => this.locale.triggers[t]).join(' / ');
    }

    private title(): string {
        const { mode, targetKind, selectionText } = this.options.context;
        if (mode === 'edit') return this.locale.dialog.editTitle;
        if (targetKind === 'image') return this.locale.dialog.attachToImage;
        return interpolate(this.locale.dialog.attachToText, { text: selectionText });
    }

    private renderForm(def: RichTextActionDefinition): TemplateResult | typeof nothing {
        const required = this.locale.form.required;
        const refresh = this.options.requestUpdate;
        if (this.isCombined && this.paramsMode === 'separate') {
            const group = (trigger: RichTextActionTrigger, params: ActionParams, apply: (p: ActionParams) => void, valid: (v: boolean) => void) => {
                const fields = def.fieldsByTrigger?.[trigger] ?? [];
                return html`
                    <p class="section-header" data-slot="rich-text-actions-dialog-section-header">${this.locale.triggers[trigger]}</p>
                    ${renderActionsForm({ fields, params, requiredTemplate: required, onChange: (next) => {
                        apply(next);
                        valid(actionFieldsValid(fields, next));
                        refresh();
                    } })}`;
            };
            return html`<div class="groups">
                ${group('hover', this.hoverParams, (p) => { this.hoverParams = p; }, (v) => { this.hoverValid = v; })}
                ${group('click', this.clickParams, (p) => { this.clickParams = p; }, (v) => { this.clickValid = v; })}
            </div>`;
        }
        if (def.formTag) return html`<div class="custom-form">${this.customForm}</div>`;
        if (!hasFields(def.fields)) return nothing;
        const fields = def.fields ?? [];
        return renderActionsForm({ fields, params: this.clickParams, requiredTemplate: required, onChange: (next) => {
            this.clickParams = next;
            this.clickValid = actionFieldsValid(fields, next);
            refresh();
        } });
    }

    private renderTriggerChoice(def: RichTextActionDefinition): TemplateResult | typeof nothing {
        if (this.isCombined) return html`<span class="badge">${this.locale.dialog.combinedBadge}</span>`;
        if (def.triggers.length < 2) return nothing;
        const occupied = this.options.context.occupiedTriggers;
        return html`<div class="triggers">${def.triggers.map((t) => html`
            <label>
                <input type="radio" name="rta-trigger" .checked=${this.selectedTrigger === t} @change=${() => this.selectTrigger(t)} />
                ${this.locale.triggers[t]}
                ${occupied.includes(t) ? html`<span class="hint">${this.locale.dialog.replacesExisting}</span>` : nothing}
            </label>`)}</div>`;
    }

    render(): TemplateResult {
        const { dialog } = this.locale;
        const def = this.selectedDef;
        const defs = this.visibleDefs;
        return html`<ge-dialog open @open-change=${(e: CustomEvent<boolean>) => { if (!e.detail) this.dismiss(); }}>
            <ge-dialog-content data-slot="rich-text-actions-dialog" dir=${this.locale.rtl ? 'rtl' : nothing}>
                <ge-dialog-header><ge-dialog-title>${this.title()}</ge-dialog-title></ge-dialog-header>
                <div class="body">
                    <input type="text" class="search" .value=${this.query} placeholder=${dialog.searchPlaceholder} aria-label=${dialog.searchLabel}
                        @input=${(e: Event) => { this.query = (e.target as HTMLInputElement).value; this.options.requestUpdate(); }} />
                    <div class="picker" ?data-busy=${this.busy}>
                        ${defs.length === 0 ? html`<p class="empty">${dialog.noActions}</p>` : defs.map((d) => html`
                            <button type="button" data-action-option=${d.id} aria-pressed=${String(def?.id === d.id)}
                                @click=${() => this.pickAction(d.id)}>
                                <span class="label">${d.label}</span>
                                <span class="hint">${this.triggerLabels(d.triggers)}</span>
                            </button>`)}
                    </div>
                    ${def ? html`${this.renderTriggerChoice(def)}${this.renderForm(def)}` : nothing}
                </div>
                <ge-dialog-footer>
                    <ge-button data-testid="rta-cancel" variant="ghost" @click=${() => this.dismiss()}>${dialog.cancel}</ge-button>
                    <ge-button data-testid="rta-confirm" ?disabled=${!this.canConfirm} @click=${() => this.confirm()}>${this.confirmLabel}</ge-button>
                </ge-dialog-footer>
            </ge-dialog-content>
        </ge-dialog>`;
    }
}
