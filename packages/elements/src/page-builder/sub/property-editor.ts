import { html, nothing, unsafeCSS, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './property-editor.css?inline';
import type { ComponentMeta, InputDefinition, PageDashboardItem } from '../page-builder.types.js';

/** `detail` of `item-change`. `prop` is `bindings` for the whole bindings map, a geometry field (`x`, `y`, `cols`, `rows`), or a widget input name. */
export interface PropertyChange {
    id: string;
    prop: string;
    value: unknown;
}

const inputValue = (event: Event): string => (event.target as HTMLInputElement).value;
/** What a number field holds: the number, or `null` when it is empty. */
const numberValue = (event: Event): number | null => {
    const field = event.target as HTMLInputElement;
    return field.value === '' ? null : field.valueAsNumber;
};

/**
 * The inspector for one placed widget: its size on the grid, each input of its component (a switch, a select, a number or a
 * text field) and a button to delete it. Each input can be switched to a binding, a dot-path read from the renderer's context.
 *
 * Fully controlled: it never changes `item`. It fires `item-change` and the owner applies the change and sets a new `item`.
 *
 * @fires item-change - One edit. `detail` is `{ id, prop, value }`.
 * @fires delete - The delete button was pressed. Carries nothing: the owner deletes the selected widget, which is this `item`.
 * @prop {PageDashboardItem | null} item - The widget being edited. `null` shows the empty state.
 * @prop {ComponentMeta | null} componentMeta - Which inputs to offer and with what control. Without it only the size fields show.
 * @attr {boolean} loading - Shows a placeholder while the widget's details are still being worked out. Visual only.
 */
export class GePropertyEditor extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        item: { attribute: false },
        componentMeta: { attribute: false },
        loading: { type: Boolean, reflect: true },
    };

    declare item: PageDashboardItem | null;
    declare componentMeta: ComponentMeta | null;
    declare loading: boolean;

    constructor() {
        super();
        this.item = null;
        this.componentMeta = null;
        this.loading = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'property-editor';
    }

    private emit(prop: string, value: unknown): void {
        if (!this.item) return;
        this.dispatchEvent(new CustomEvent<PropertyChange>('item-change', { detail: { id: this.item.id, prop, value }, bubbles: true, composed: true }));
    }

    private hasBinding(name: string): boolean {
        return this.item?.bindings?.[name] !== undefined;
    }

    private toggleBinding(name: string): void {
        if (!this.item) return;
        const bindings = { ...this.item.bindings };
        if (this.hasBinding(name)) delete bindings[name];
        else bindings[name] = '';
        this.emit('bindings', bindings);
    }

    private setBinding(name: string, value: string): void {
        if (!this.item) return;
        this.emit('bindings', { ...this.item.bindings, [name]: value });
    }

    private numberField(label: string, id: string, icon: string, value: number, prop: 'cols' | 'rows', max?: number) {
        return html`<div class="field">
            <label for=${id} class="muted-label">${label}</label>
            <div class="with-icon">
                <input id=${id} class="text-input icon-input" type="number" min="1" max=${max ?? nothing} .value=${String(value)} @input=${(e: Event) => this.emit(prop, numberValue(e))} />
                <span class="field-icon"><ge-icon name=${icon} size="sm"></ge-icon></span>
            </div>
        </div>`;
    }

    private renderControl(def: InputDefinition): TemplateResult {
        const id = `pe-prop-${def.name}`;
        const label = def.label || def.name;
        const value = this.item?.inputs?.[def.name];
        if (this.hasBinding(def.name)) {
            return html`<div class="with-icon">
                <input id=${id} class="text-input bound-input" type="text" placeholder="e.g. user.name" .value=${this.item?.bindings?.[def.name] ?? ''} @input=${(e: Event) => this.setBinding(def.name, inputValue(e))} />
                <span class="bound-mark">@</span>
            </div>`;
        }
        switch (def.type) {
            case 'boolean':
                return html`<div class="switch-row"><span class="switch-label">${label}</span><ge-switch ?checked=${!!value} aria-label=${label} @change=${(e: Event) => this.emit(def.name, (e.target as HTMLInputElement).checked)}></ge-switch></div>`;
            case 'select':
                return html`<ge-select .options=${def.options ?? []} .value=${value ?? ''} placeholder=${`Select ${label}`} @value-change=${(e: CustomEvent) => this.emit(def.name, e.detail)}></ge-select>`;
            default:
                return html`<input id=${id} class="text-input" type=${def.type === 'number' ? 'number' : 'text'} .value=${value === undefined || value === null ? '' : String(value)} @input=${(e: Event) => this.emit(def.name, def.type === 'number' ? numberValue(e) : inputValue(e))} />`;
        }
    }

    private renderSettings(inputs: InputDefinition[]) {
        return html`<div class="section">
                <div class="section-head"><h4>Settings</h4><span class="tag">Props</span></div>
                ${inputs.map((def) => {
                    const bound = this.hasBinding(def.name);
                    return html`<div class="setting">
                        <div class="setting-head">
                            <label for=${`pe-prop-${def.name}`} class="setting-label">${def.label || def.name}</label>
                            <button type="button" class="bind-toggle" ?data-bound=${bound} title="Toggle Data Binding" @click=${() => this.toggleBinding(def.name)}><ge-icon name="box" size="xs"></ge-icon>${bound ? 'Bound' : 'Static'}</button>
                        </div>
                        ${this.renderControl(def)}
                    </div>`;
                })}
            </div>
            <div class="rule"></div>`;
    }

    private renderLoading() {
        return html`<div class="skeleton">
            <div class="sk-card"><div class="sk-avatar"></div><div class="sk-lines"><div class="sk-line" style="width:75%;height:1rem"></div><div class="sk-line" style="width:50%;height:.75rem"></div></div></div>
            <div class="section"><div class="sk-line" style="width:25%;height:1rem"></div><div class="two"><div class="sk-block"></div><div class="sk-block"></div></div></div>
            <div class="section sk-pad"><div class="sk-line" style="width:33%;height:1rem"></div><div class="stack"><div class="sk-block"></div><div class="sk-block"></div><div class="sk-block"></div></div></div>
        </div>`;
    }

    private renderEditor(item: PageDashboardItem) {
        const meta = this.componentMeta;
        const inputs = meta?.inputs ?? [];
        return html`<div class="head">
                <div class="head-icon"><ge-icon name=${meta?.icon || 'box'} size="lg"></ge-icon></div>
                <div class="head-text"><h3>${meta?.name}</h3><p>${item.id}</p></div>
            </div>
            <div class="section">
                <div class="section-head"><h4>Layout</h4><span class="tag">Grid Config</span></div>
                <div class="two">${this.numberField('Columns (Width)', 'pe-cols', 'columns-2', item.cols, 'cols', 12)}${this.numberField('Rows (Height)', 'pe-rows', 'rows-2', item.rows, 'rows')}</div>
            </div>
            <div class="rule"></div>
            ${inputs.length ? this.renderSettings(inputs) : nothing}
            <div class="delete-row"><button type="button" class="delete" @click=${() => this.dispatchEvent(new CustomEvent('delete', { bubbles: true, composed: true }))}><ge-icon name="trash-2" size="sm"></ge-icon>Delete Component</button></div>`;
    }

    protected override render() {
        const item = this.item;
        if (!item) {
            return html`<div class="panel"><div class="body"><div class="empty">
                <div class="empty-icon"><ge-icon name="mouse-pointer-click" size="xl"></ge-icon></div>
                <h3>No Selection</h3>
                <p>Select an item on the board to edit its layout and properties.</p>
            </div></div></div>`;
        }
        return html`<div class="panel"><div class="body"><div class="content">${this.loading ? this.renderLoading() : this.renderEditor(item)}</div></div></div>`;
    }
}
