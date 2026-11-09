import { html, nothing, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { defaultTrue } from '../shared/chart/chart-base.js';
import { WidgetCache } from '../shared/widget-cache.js';
import css from './page-builder.css?inline';
import type { ComponentMeta, PageBuilderViewMode, PageDashboardItem, PageData } from './page-builder.types.js';
import { interpolate } from '../shared/interpolate.js';
import { resolvePageBuilderLocale, type PageBuilderLocale } from './page-builder.locales.js';
import { PROPERTY_EDITOR_LOCALES } from './sub/property-editor.locales.js';
import { isPageData, nextFreeRow, normaliseLength, toDashboardItem, withInputs } from './page-builder.utils.js';
import type { PropertyChange } from './sub/property-editor.js';

interface FilePickerWindow {
    showSaveFilePicker?(options: unknown): Promise<{ createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }> }>;
    showOpenFilePicker?(options: unknown): Promise<Array<{ getFile(): Promise<File> }>>;
}

type LengthSetting = 'gridRowHeight' | 'gridGap' | 'gridColumnWidth' | 'gridBorderRadius' | 'gridItemPadding';

const GEOMETRY = new Set(['x', 'y', 'cols', 'rows', 'bindings']);
const JSON_TYPES = [{ description: 'JSON File', accept: { 'application/json': ['.json'] } }];
const EXPORT_NAME = 'page-builder-export.json';

/**
 * A visual page editor: a palette of components on the left, a grid canvas in the middle and an inspector on the right
 * (the grid's own settings, or the selected widget's size and inputs). Drag a palette entry onto the canvas, or choose
 * Add from the grid's context menu; drag, resize, merge and split widgets in the grid. Save emits the layout as a
 * `PageData` that `ge-page-renderer` draws.
 *
 * Each palette entry names a custom element by `tag`. The inputs the inspector offers are read from that element's
 * class (its Lit properties); an entry can also declare `inputs` to force a control type, such as a select.
 *
 * The shell fills its parent, so give that parent a height.
 *
 * @fires save - The Save button was pressed. `detail` is the current `PageData`.
 * @fires view-mode-change - Edit and preview were swapped. `detail` is `'edit'` or `'preview'`.
 * @prop {ComponentMeta[]} components - The palette, also the lookup used when loading a layout: items whose `componentId` is missing from it are dropped, so `data` waits for a non-empty palette.
 * @prop {PageData | null} data - Layout to load. A new value replaces the board, like Import.
 * @attr {boolean} enable-save - Shows the Save button (default true; `enable-save="false"` hides it).
 * @attr {boolean} enable-export - Shows the Export button, which downloads the layout as JSON (default false).
 * @attr {string} locale - Locale id or a dictionary object for the builder's own words; defaults to the page's `lang`, then `en`. Component names, categories and input labels come from `components` and are not translated. The inspector follows the same language by its code, so a custom dictionary object localises the builder only.
 */
export class GePageBuilder extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        components: { attribute: false },
        data: { attribute: false },
        enableSave: { attribute: 'enable-save', converter: defaultTrue, reflect: true },
        enableExport: { attribute: 'enable-export', type: Boolean, reflect: true },
        locale: {},
        viewMode: { state: true },
        items: { state: true },
        selectedItemId: { state: true },
        gridRowHeight: { state: true },
        gridColumnWidth: { state: true },
        gridCols: { state: true },
        gridGap: { state: true },
        gridShowBorders: { state: true },
        gridBorderRadius: { state: true },
        gridItemPadding: { state: true },
        gridSquareCells: { state: true },
        simulatingData: { state: true },
        instanceTick: { state: true },
    };

    declare components: ComponentMeta[];
    declare data: PageData | null;
    declare enableSave: boolean;
    declare enableExport: boolean;
    declare locale: string | PageBuilderLocale;
    declare viewMode: PageBuilderViewMode;
    declare items: PageDashboardItem[];
    declare selectedItemId: string | null;
    declare gridRowHeight: string;
    declare gridColumnWidth: string;
    declare gridCols: number;
    declare gridGap: string;
    declare gridShowBorders: boolean;
    declare gridBorderRadius: string;
    declare gridItemPadding: string;
    declare gridSquareCells: boolean;
    declare simulatingData: boolean;
    declare instanceTick: number;

    private readonly widgets = new WidgetCache();
    private simulation: ReturnType<typeof setInterval> | undefined;
    private lastAppliedData: PageData | null = null;

    private get t(): PageBuilderLocale {
        return resolvePageBuilderLocale(this.locale);
    }

    /** A sample CSS value as a placeholder ("e.g. 1rem"). */
    private example(value: string): string {
        return interpolate(this.t.exampleValue, { value });
    }

    constructor() {
        super();
        this.components = [];
        this.data = null;
        this.enableSave = true;
        this.enableExport = false;
        this.locale = '';
        this.viewMode = 'edit';
        this.items = [];
        this.selectedItemId = null;
        this.gridRowHeight = '20px';
        this.gridColumnWidth = '1fr';
        this.gridCols = 12;
        this.gridGap = '1.5rem';
        this.gridShowBorders = true;
        this.gridBorderRadius = '0.75rem';
        this.gridItemPadding = '1rem';
        this.gridSquareCells = true;
        this.simulatingData = false;
        this.instanceTick = 0;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'page-builder';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.stopSimulation();
        this.simulatingData = false;
    }

    // ---- derived ------------------------------------------------------------------------------------------

    private get categories(): string[] {
        return [...new Set(this.components.map((component) => component.category))].sort((a, b) => a.localeCompare(b));
    }

    private metaOf(item: PageDashboardItem): ComponentMeta | undefined {
        return this.components.find((component) => component.id === item.componentId);
    }

    private get selectedItem(): PageDashboardItem | null {
        return this.items.find((item) => item.id === this.selectedItemId) ?? null;
    }

    /** The palette entry of the selected widget with its inputs read from the live element, which is why a widget's inputs only get their right controls once it has rendered. */
    private get selectedMeta(): ComponentMeta | null {
        const item = this.selectedItem;
        const meta = item && this.metaOf(item);
        if (!item || !meta) return null;
        return withInputs(meta, this.widgets.element(item.id) as unknown as Record<string, unknown> | undefined);
    }

    // ---- public API ---------------------------------------------------------------------------------------

    /** Flips between `edit` and `preview` and fires `view-mode-change`. Preview hides the inspector and makes the grid non-editable; layout and selection are kept. */
    toggleViewMode(): void {
        this.viewMode = this.viewMode === 'edit' ? 'preview' : 'edit';
        this.dispatchEvent(new CustomEvent<PageBuilderViewMode>('view-mode-change', { detail: this.viewMode, bubbles: true, composed: true }));
    }

    /** Fires `save` with the current layout. */
    saveJson(): void {
        this.dispatchEvent(new CustomEvent<PageData>('save', { detail: this.buildLayout(), bubbles: true, composed: true }));
    }

    /** Empties the canvas and drops the selection. Grid settings are kept. No confirmation and no undo. */
    clearBoard(): void {
        this.items = [];
        this.selectedItemId = null;
        this.widgets.clear();
        this.instanceTick++;
    }

    /**
     * Adds a palette component and selects it so the inspector opens on it. Sized from `defaultCols` and `defaultRows` (2 by 2
     * unless set) with its inputs seeded from `defaultInputs`. Without `x` and `y` it goes below everything already placed;
     * with both it goes exactly there, overlapping whatever is in the way.
     */
    addItem(component: ComponentMeta, x?: number, y?: number): void {
        const placed = x !== undefined && y !== undefined;
        const item: PageDashboardItem = {
            id: crypto.randomUUID(),
            x: x ?? 0,
            y: placed ? y : nextFreeRow(this.items),
            cols: component.defaultCols || 2,
            rows: component.defaultRows || 2,
            content: component.name,
            componentId: component.id,
            inputs: { ...component.defaultInputs },
            bindings: {},
        };
        this.items = [...this.items, item];
        this.selectedItemId = item.id;
    }

    /** Starts or stops the preview data feed: every second, each `progress` widget's `value` steps by 5. It edits the items' inputs, so a layout saved while it runs includes the stepped values. */
    toggleSimulatedData(): void {
        this.simulatingData = !this.simulatingData;
        if (this.simulatingData) this.startSimulation();
        else this.stopSimulation();
    }

    /** Turns square cells on or off. On, the column width follows the row height; off, columns return to `1fr`. Either way it overwrites a column width set by hand. */
    toggleSquareCells(): void {
        this.gridSquareCells = !this.gridSquareCells;
        this.gridColumnWidth = this.gridSquareCells ? this.gridRowHeight : '1fr';
    }

    /** Downloads the layout as `page-builder-export.json`, through the save dialog where the browser has one. A cancelled dialog stops there. */
    async exportJson(): Promise<void> {
        const json = JSON.stringify(this.buildLayout(), null, 2);
        const picker = (globalThis as unknown as FilePickerWindow).showSaveFilePicker;
        if (picker) {
            try {
                const handle = await picker({ suggestedName: EXPORT_NAME, types: JSON_TYPES });
                const writable = await handle.createWritable();
                await writable.write(json);
                await writable.close();
                return;
            } catch (error) {
                if ((error as Error).name === 'AbortError') return;
            }
        }
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = EXPORT_NAME;
        link.style.display = 'none';
        document.body.append(link);
        link.click();
        setTimeout(() => {
            link.remove();
            URL.revokeObjectURL(url);
        }, 2000);
    }

    /** Opens a layout file and replaces the board with it, without asking: the current work is lost. A cancelled dialog leaves the board alone. Items whose component is not in `components` are dropped. */
    async importJson(): Promise<void> {
        const picker = (globalThis as unknown as FilePickerWindow).showOpenFilePicker;
        if (picker) {
            try {
                const [handle] = await picker({ types: JSON_TYPES, multiple: false });
                if (handle) this.loadLayout(await (await handle.getFile()).text());
                return;
            } catch (error) {
                if ((error as Error).name === 'AbortError') return;
            }
        }
        const input = this.renderRoot.querySelector<HTMLInputElement>('input[type="file"]');
        if (input) {
            input.value = '';
            input.click();
        }
    }

    // ---- state changes ------------------------------------------------------------------------------------

    private startSimulation(): void {
        this.simulation = setInterval(() => {
            this.items = this.items.map((item) => {
                if (this.metaOf(item)?.id !== 'progress') return item;
                const current = (item.inputs['value'] as number | undefined) ?? 0;
                return { ...item, inputs: { ...item.inputs, value: (current + 5) % 105 } };
            });
        }, 1000);
    }

    private stopSimulation(): void {
        clearInterval(this.simulation);
        this.simulation = undefined;
    }

    private buildLayout(): PageData {
        return {
            grid: {
                cols: this.gridCols,
                rowHeight: this.gridRowHeight,
                columnWidth: this.gridColumnWidth,
                gap: this.gridGap,
                showBorders: this.gridShowBorders,
                borderRadius: this.gridBorderRadius,
                itemPadding: this.gridItemPadding,
                squareCells: this.gridSquareCells,
            },
            items: this.items.map((item) => ({ id: item.id, x: item.x, y: item.y, cols: item.cols, rows: item.rows, componentId: this.metaOf(item)?.id ?? '', inputs: item.inputs, bindings: item.bindings })),
            timestamp: new Date().toISOString(),
        };
    }

    private loadLayout(text: string): void {
        try {
            const parsed: unknown = JSON.parse(text);
            if (!isPageData(parsed)) {
                alert(this.t.invalidLayout);
                return;
            }
            this.lastAppliedData = parsed;
            this.applyLayout(parsed);
        } catch {
            alert(this.t.parseFailed);
        }
    }

    private applyLayout(page: PageData): void {
        const grid = page.grid;
        if (grid.cols) this.gridCols = grid.cols;
        if (grid.rowHeight) this.gridRowHeight = grid.rowHeight;
        if (grid.columnWidth) this.gridColumnWidth = grid.columnWidth;
        if (grid.gap) this.gridGap = grid.gap;
        if (grid.showBorders !== undefined) this.gridShowBorders = grid.showBorders;
        if (grid.borderRadius) this.gridBorderRadius = grid.borderRadius;
        if (grid.itemPadding) this.gridItemPadding = grid.itemPadding;
        if (grid.squareCells !== undefined) this.gridSquareCells = grid.squareCells;
        this.items = page.items.map((item) => toDashboardItem(item, this.components)).filter((item): item is PageDashboardItem => item !== null);
        this.selectedItemId = null;
        this.widgets.clear();
        this.instanceTick++;
    }

    /** One edit from the inspector. `x`, `y`, `cols`, `rows` and `bindings` land on the item; anything else is a widget input and lands in `inputs`. */
    private onItemChange({ id, prop, value }: PropertyChange): void {
        if (!id) return;
        this.items = this.items.map((item) => {
            if (item.id !== id) return item;
            return GEOMETRY.has(prop) ? { ...item, [prop]: value } : { ...item, inputs: { ...item.inputs, [prop]: value } };
        });
    }

    private onDeleteItem(): void {
        const id = this.selectedItemId;
        if (!id) return;
        this.items = this.items.filter((item) => item.id !== id);
        this.selectedItemId = null;
        this.widgets.forget(id);
        this.instanceTick++;
    }

    private onExternalDrop(detail: { widgetId: string; x?: number; y?: number }): void {
        const component = this.components.find((candidate) => candidate.id === detail.widgetId);
        if (component) this.addItem(component, detail.x, detail.y);
    }

    private onDragStart(event: DragEvent, component: ComponentMeta): void {
        if (!event.dataTransfer) return;
        event.dataTransfer.setData('application/json', JSON.stringify({ type: 'widget', id: component.id }));
        event.dataTransfer.effectAllowed = 'all';
    }

    private setLength(setting: LengthSetting, value: string): void {
        this[setting] = value;
    }

    private commitLength(setting: LengthSetting): void {
        this[setting] = normaliseLength(this[setting]);
    }

    private readonly renderWidget = (item: PageDashboardItem) => {
        const meta = this.metaOf(item);
        if (!meta) return html``;
        return this.widgets.get(item.id, meta.tag, item.inputs, () => queueMicrotask(() => this.instanceTick++));
    };

    // ---- lifecycle ----------------------------------------------------------------------------------------

    protected override willUpdate(changed: PropertyValues<this>): void {
        if ((changed.has('gridSquareCells') || changed.has('gridRowHeight')) && this.gridSquareCells) this.gridColumnWidth = this.gridRowHeight;
        if (changed.has('data') || changed.has('components')) {
            const incoming = this.data;
            if (incoming && incoming !== this.lastAppliedData && this.components.length > 0) {
                this.lastAppliedData = incoming;
                this.applyLayout(incoming);
            }
        }
        if (changed.has('items')) this.widgets.prune(this.items.map((item) => item.id));
    }

    // ---- rendering ----------------------------------------------------------------------------------------

    private renderPalette() {
        return html`<aside aria-label=${this.t.components} class="palette">
            <div class="panel-title"><ge-icon name="box" size="sm" class="muted"></ge-icon>${this.t.components}</div>
            <div class="palette-body">
                ${this.categories.map(
                    (category) => html`<div>
                        <h3 class="category">${category}</h3>
                        <div class="tiles">
                            ${this.components
                                .filter((component) => component.category === category)
                                .map(
                                    (component) => html`<div class="tile" draggable="true" title=${component.name} @dragstart=${(e: DragEvent) => this.onDragStart(e, component)}>
                                        <div class="tile-icon"><ge-icon name=${component.icon || 'box'} size="20"></ge-icon></div>
                                        <span class="tile-name">${component.name}</span>
                                    </div>`,
                                )}
                        </div>
                    </div>`,
                )}
            </div>
        </aside>`;
    }

    private renderToolbar() {
        const preview = this.viewMode === 'preview';
        const simulating = this.simulatingData;
        return html`<header class="toolbar">
            <div class="count"><ge-icon name="layers" size="sm"></ge-icon><span>${interpolate(this.t.itemsCount, { count: this.items.length })}</span></div>
            <div class="actions">
                <div class="sim-group">
                    <button type="button" class="sim" ?data-active=${simulating} title=${this.t.toggleSimulationTitle} @click=${() => this.toggleSimulatedData()}>
                        <ge-icon name=${simulating ? 'refresh-cw' : 'loader'} size="14" class=${simulating ? 'spin' : ''}></ge-icon>
                        <span>${simulating ? this.t.stopSim : this.t.liveDemo}</span>
                    </button>
                </div>
                <button type="button" class="tool" ?data-active=${preview} title=${preview ? this.t.switchToEditTitle : this.t.switchToPreviewTitle} @click=${() => this.toggleViewMode()}>
                    <ge-icon name=${preview ? 'pencil' : 'eye'} size="sm"></ge-icon><span>${preview ? this.t.edit : this.t.preview}</span>
                </button>
                <div class="divider"></div>
                <button type="button" class="tool danger" title=${this.t.clearBoardTitle} @click=${() => this.clearBoard()}><ge-icon name="trash-2" size="sm"></ge-icon><span>${this.t.clear}</span></button>
                <button type="button" class="tool import" title=${this.t.importLayoutTitle} @click=${() => void this.importJson()}><ge-icon name="upload" size="sm"></ge-icon>${this.t.import}</button>
                ${this.enableSave ? html`<button type="button" class="primary" title=${this.t.saveLayoutTitle} @click=${() => this.saveJson()}><ge-icon name="save" size="sm"></ge-icon>${this.t.save}</button>` : nothing}
                ${this.enableExport ? html`<button type="button" class="outline" title=${this.t.exportLayoutTitle} @click=${() => void this.exportJson()}><ge-icon name="download" size="sm"></ge-icon>${this.t.export}</button>` : nothing}
            </div>
        </header>`;
    }

    private renderCanvas() {
        return html`<div class="canvas-scroll">
            <div class="canvas">
                ${this.items.length === 0
                    ? html`<div class="canvas-empty"><div class="canvas-empty-icon"><ge-icon name="layout-template" size="xl"></ge-icon></div><p>${this.t.emptyCanvas}</p></div>`
                    : nothing}
                <ge-bento-grid
                    .items=${this.items}
                    .renderItem=${this.renderWidget}
                    cols=${this.gridCols}
                    row-height=${this.gridRowHeight}
                    column-width=${this.gridColumnWidth}
                    gap=${this.gridGap}
                    show-borders=${this.gridShowBorders}
                    border-radius=${this.gridBorderRadius}
                    item-padding=${this.gridItemPadding}
                    editable=${this.viewMode === 'edit'}
                    @items-change=${(e: CustomEvent<PageDashboardItem[]>) => (this.items = e.detail)}
                    @selection-change=${(e: CustomEvent<string[]>) => (this.selectedItemId = e.detail[0] ?? null)}
                    @external-drop=${(e: CustomEvent<{ widgetId: string; x?: number; y?: number }>) => this.onExternalDrop(e.detail)}
                ></ge-bento-grid>
            </div>
        </div>`;
    }

    private lengthField(id: string, label: string, setting: LengthSetting, placeholder: string, extra: TemplateResult | typeof nothing = nothing) {
        return html`<div class="setting">
            <label for=${id} class="setting-label">${label}</label>
            ${extra === nothing
                ? html`<input id=${id} class="field" type="text" placeholder=${placeholder} .value=${this[setting]} @input=${(e: Event) => this.setLength(setting, (e.target as HTMLInputElement).value)} @blur=${() => this.commitLength(setting)} />`
                : html`<div class="row"><input id=${id} class="field grow" type="text" placeholder=${placeholder} .value=${this[setting]} @input=${(e: Event) => this.setLength(setting, (e.target as HTMLInputElement).value)} @blur=${() => this.commitLength(setting)} />${extra}</div>`}
        </div>`;
    }

    private switchButton(label: string, on: boolean, click: () => void) {
        return html`<button type="button" role="switch" class="switch" aria-label=${label} aria-checked=${on ? 'true' : 'false'} @click=${click}><span class="thumb"></span></button>`;
    }

    private renderGridSettings() {
        const square = this.gridSquareCells;
        const radius = (value: string, cls: string, text: string) => html`<button type="button" class="chip ${cls}" @click=${() => (this.gridBorderRadius = value)}>${text}</button>`;
        return html`<div class="grid-settings">
            <div class="settings-block">
                <div class="block-title"><ge-icon name="grid" size="12"></ge-icon>${this.t.layoutConfiguration}</div>
                <div class="settings-card">
                    ${this.lengthField('pb-row-height', this.t.rowHeight, 'gridRowHeight', this.example('100px'))}
                    ${this.lengthField('pb-gap-size', this.t.gapSize, 'gridGap', this.example('1rem'))}
                    <div class="group tall">
                        <div class="switch-line">
                            <div class="switch-title"><ge-icon name="box-select" size="12" class="muted"></ge-icon><span>${this.t.squareCells}</span></div>
                            ${this.switchButton(this.t.squareCells, square, () => this.toggleSquareCells())}
                        </div>
                        ${square
                            ? nothing
                            : html`<div class="setting"><span class="sub-title">${this.t.columnConfiguration}</span>
                                <div class="two">
                                    <div class="mini"><span class="mini-label">${this.t.count}</span><input class="field small" type="number" .value=${String(this.gridCols)} @input=${(e: Event) => { const value = (e.target as HTMLInputElement).valueAsNumber; if (Number.isFinite(value)) this.gridCols = value; }} /></div>
                                    <div class="mini"><span class="mini-label">${this.t.width}</span><input class="field small" type="text" placeholder=${this.t.columnWidthPlaceholder} .value=${this.gridColumnWidth} @input=${(e: Event) => this.setLength('gridColumnWidth', (e.target as HTMLInputElement).value)} @blur=${() => this.commitLength('gridColumnWidth')} /></div>
                                </div></div>`}
                    </div>
                    <div class="group">
                        <div class="switch-line"><span class="switch-text">${this.t.showBorders}</span>${this.switchButton(this.t.showBorders, this.gridShowBorders, () => (this.gridShowBorders = !this.gridShowBorders))}</div>
                    </div>
                    ${this.lengthField('pb-border-radius', this.t.borderRadius, 'gridBorderRadius', this.example('0.75rem'), html`<div class="chips">${radius('0px', 'sharp', '0')}${radius('0.75rem', 'medium', 'M')}${radius('1.5rem', 'large', 'L')}</div>`)}
                    <div class="group">
                        ${this.lengthField('pb-item-padding', this.t.itemPadding, 'gridItemPadding', this.example('1rem'), html`<button type="button" class="none" @click=${() => (this.gridItemPadding = '0px')}>${this.t.none}</button>`)}
                        <p class="hint">${this.t.itemPaddingHint}</p>
                    </div>
                </div>
            </div>
            <div class="tip"><p class="tip-title">${this.t.tip}</p>${this.t.tipBody}</div>
        </div>`;
    }

    private renderInspector() {
        const selected = this.selectedItemId;
        return html`<aside aria-label=${this.t.properties} class="inspector">
            <div class="panel-title"><ge-icon name="settings-2" size="sm" class="muted"></ge-icon>${selected ? this.t.properties : this.t.gridSettings}</div>
            <div class="inspector-body">
                ${selected
                    ? html`<ge-property-editor
                          .item=${this.selectedItem}
                          .componentMeta=${this.selectedMeta}
                          .loading=${!this.widgets.element(selected)}
                          .locale=${Object.hasOwn(PROPERTY_EDITOR_LOCALES, this.t.code) ? this.t.code : 'en'}
                          @item-change=${(e: CustomEvent<PropertyChange>) => this.onItemChange(e.detail)}
                          @delete=${() => this.onDeleteItem()}
                      ></ge-property-editor>`
                    : this.renderGridSettings()}
            </div>
        </aside>`;
    }

    protected override render() {
        return html`<div class="shell" data-slot="page-builder-shell" dir=${this.t.rtl ? 'rtl' : nothing}>
            ${this.renderPalette()}
            <main class="main">${this.renderToolbar()}${this.renderCanvas()}</main>
            <input type="file" accept=".json" hidden aria-label=${this.t.importJsonLabel} @change=${(e: Event) => void this.onFileChosen(e)} />
            ${this.viewMode === 'edit' ? this.renderInspector() : nothing}
        </div>`;
    }

    private async onFileChosen(event: Event): Promise<void> {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) this.loadLayout(await file.text());
    }
}
