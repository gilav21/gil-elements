import { html, nothing, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import {
    shortcutBindings,
    type ShortcutBindingView,
    type ShortcutCatalogItem,
    type ShortcutOverrideSchema,
} from '../shared/shortcut-bindings.js';
import { COMMON_LOCALES } from '../shared/common-locales.js';
import { interpolate, resolveShortcutBindingsDialogLocale, type ShortcutBindingsDialogLocale } from './shortcut-bindings-dialog.locales.js';
import css from './shortcut-bindings-dialog.css?inline';

interface DialogInstance {
    componentId: string;
    displayName: string;
    defaultShortcut: string;
    effectiveShortcut: string;
}

interface DialogBinding extends ShortcutCatalogItem {
    instances: DialogInstance[];
}

interface DialogGroup {
    componentName: string;
    bindings: DialogBinding[];
    activeBindings: number;
}

/** On unless the attribute says `false`, because a bare boolean attribute cannot default to true. */
const defaultTrue = { fromAttribute: (attribute: string | null): boolean => attribute !== 'false' };
const stop = (event: Event): void => event.stopPropagation();
const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
const instanceNumber = (componentId: string): number => {
    const match = /-(\d+)$/.exec(componentId);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

/**
 * A ready-made settings dialog for every keyboard shortcut registered with the shared `shortcutBindings`
 * registry: search actions, rebind a key for all instances of a component or for one instance, spot conflicts,
 * and export or import the mapping. Rebinds apply at once; nothing is stored unless you listen for `mapping-save`.
 *
 * The English titles and button words are fixed, as in shadcn-angular; only the search placeholder, the conflict
 * badge and the two rebind labels follow `locale`.
 *
 * @fires open-change - When the user closes (or opens) it; `detail` is the new state. Setting `open` yourself does not fire it.
 * @fires mapping-save - The user pressed "Save Changes" (needs `allow-save-mapping`); `detail` is the exported override schema.
 * @attr {boolean} open - Whether the dialog is showing.
 * @attr {boolean} allow-save-mapping - Shows the "Save Changes" button. Off by default, because rebinds apply at once.
 * @attr {boolean} replace-on-schema-load - How `mappingSchema` is imported: on (the default) it replaces the overrides, `="false"` merges.
 * @attr {string} locale - Locale id or object; defaults to the page's `lang`, then `en`.
 * @prop {ShortcutOverrideSchema | null} mappingSchema - Overrides to import, applied whenever their JSON differs from the last import.
 * @csspart panel - The dialog box.
 */
export class GeShortcutBindingsDialog extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        open: { type: Boolean, reflect: true },
        allowSaveMapping: { type: Boolean, attribute: 'allow-save-mapping' },
        replaceOnSchemaLoad: { converter: defaultTrue, attribute: 'replace-on-schema-load' },
        locale: {},
        mappingSchema: { attribute: false },
        search: { state: true },
        capturing: { state: true },
        revision: { state: true },
    };

    declare open: boolean;
    declare allowSaveMapping: boolean;
    declare replaceOnSchemaLoad: boolean;
    declare locale: string | ShortcutBindingsDialogLocale;
    declare mappingSchema: ShortcutOverrideSchema | null;
    declare search: string;
    declare capturing: string | null;
    declare revision: number;

    private lastAppliedSchema: string | null = null;
    private appliedRevision = -1;

    constructor() {
        super();
        this.open = false;
        this.allowSaveMapping = false;
        this.replaceOnSchemaLoad = true;
        this.locale = '';
        this.mappingSchema = null;
        this.search = '';
        this.capturing = null;
        this.revision = 0;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        shortcutBindings.addEventListener('change', this.onRegistryChange);
        this.dataset.slot = 'shortcut-bindings-dialog';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        shortcutBindings.removeEventListener('change', this.onRegistryChange);
    }

    private readonly onRegistryChange = (): void => {
        this.revision++;
    };

    // ---- state the template reads ----------------------------------------------------------------------

    private get text(): ShortcutBindingsDialogLocale {
        return resolveShortcutBindingsDialogLocale(this.locale);
    }

    private get searchActive(): boolean {
        return this.search.trim().length > 0;
    }

    private format(shortcut: string): string {
        return shortcutBindings.formatShortcutForDisplay(shortcut);
    }

    private filteredBindings(): ShortcutCatalogItem[] {
        const query = this.search.trim().toLowerCase();
        const sorted = [...shortcutBindings.getShortcutCatalog()].sort((a, b) => {
            const categoryA = (a.category ?? '').toLowerCase();
            const categoryB = (b.category ?? '').toLowerCase();
            if (categoryA !== categoryB) return categoryA.localeCompare(categoryB);
            return a.description.localeCompare(b.description);
        });
        if (!query) return sorted;
        return sorted.filter((binding) =>
            [
                binding.description,
                binding.actionId,
                binding.componentName,
                binding.category ?? '',
                this.format(binding.effectiveShortcut),
                this.format(binding.defaultShortcut),
            ]
                .join(' ')
                .toLowerCase()
                .includes(query),
        );
    }

    private groupedBindings(): DialogGroup[] {
        const viewsByAction = this.viewsByAction(shortcutBindings.getShortcutBindingViews());
        const groups = new Map<string, DialogBinding[]>();
        for (const binding of this.filteredBindings()) {
            const views = viewsByAction.get(this.actionKey(binding.actionId, binding.componentName)) ?? [];
            const item: DialogBinding = { ...binding, instances: this.instancesOf(binding, views) };
            groups.set(binding.componentName, [...(groups.get(binding.componentName) ?? []), item]);
        }
        return Array.from(groups.entries())
            .map(([componentName, bindings]) => ({
                componentName,
                bindings,
                activeBindings: bindings.filter((binding) => binding.instances.length > 0).length,
            }))
            .sort((a, b) => a.componentName.localeCompare(b.componentName));
    }

    private viewsByAction(views: ShortcutBindingView[]): Map<string, ShortcutBindingView[]> {
        const map = new Map<string, ShortcutBindingView[]>();
        for (const view of views) {
            const key = this.actionKey(view.actionId, view.componentId.replace(/-\d+$/, ''));
            map.set(key, [...(map.get(key) ?? []), view]);
        }
        return map;
    }

    private instancesOf(binding: ShortcutCatalogItem, views: ShortcutBindingView[]): DialogInstance[] {
        const unique = new Map<string, ShortcutBindingView>();
        for (const view of views) if (!unique.has(view.componentId)) unique.set(view.componentId, view);
        return Array.from(unique.values())
            .sort((a, b) => instanceNumber(a.componentId) - instanceNumber(b.componentId))
            .map((view) => ({
                componentId: view.componentId,
                displayName: this.instanceName(view.componentId, binding.componentName),
                defaultShortcut: view.defaultShortcut,
                effectiveShortcut: view.effectiveShortcut,
            }));
    }

    private instanceName(componentId: string, componentName: string): string {
        const index = instanceNumber(componentId);
        return index === Number.MAX_SAFE_INTEGER ? componentId : `${componentName} #${index}`;
    }

    private conflictingActions(): Set<string> {
        const ids = new Set<string>();
        for (const conflict of shortcutBindings.getConflicts()) for (const id of conflict.actionIds) ids.add(id);
        return ids;
    }

    private actionKey(actionId: string, componentName: string): string {
        return `${componentName}::${actionId}`;
    }

    private groupValue(componentName: string): string {
        return `group::${componentName}`;
    }

    private actionValue(actionId: string, componentName: string): string {
        return `action::${this.actionKey(actionId, componentName)}`;
    }

    private captureComponentKey(actionId: string, componentName: string): string {
        return `component::${componentName}::${actionId}`;
    }

    private captureInstanceKey(actionId: string, componentId: string): string {
        return `instance::${componentId}::${actionId}`;
    }

    // ---- actions -----------------------------------------------------------------------------------------

    private readonly onSearchInput = (event: Event): void => {
        this.search = (event.target as HTMLInputElement).value ?? '';
        this.revision++;
    };

    private save(): void {
        this.dispatchEvent(new CustomEvent<ShortcutOverrideSchema>('mapping-save', { detail: shortcutBindings.exportOverrideSchema(), bubbles: true, composed: true }));
    }

    private startCapture(key: string, event: Event): void {
        this.capturing = key;
        (event.currentTarget as HTMLElement).focus();
    }

    /** Consumes the key pressed while `key` is armed. Escape cancels; a bare modifier is skipped so a chord can be built. */
    private capture(event: KeyboardEvent, key: string, apply: (shortcut: string) => void): void {
        if (this.capturing !== key) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            this.capturing = null;
            return;
        }
        const shortcut = shortcutBindings.shortcutFromEvent(event);
        if (!shortcut) return;
        event.preventDefault();
        event.stopPropagation();
        apply(shortcut);
        this.capturing = null;
    }

    private readonly onOpenChange = (event: Event): void => {
        event.stopPropagation();
        this.open = (event as CustomEvent<boolean>).detail;
        this.dispatchEvent(new CustomEvent<boolean>('open-change', { detail: this.open, bubbles: true, composed: true }));
    };

    // ---- lifecycle ---------------------------------------------------------------------------------------

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (!changed.has('mappingSchema') || !this.mappingSchema) return;
        const serialized = JSON.stringify(this.mappingSchema);
        if (serialized === this.lastAppliedSchema) return;
        shortcutBindings.importOverrideSchema(this.mappingSchema, this.replaceOnSchemaLoad);
        this.lastAppliedSchema = serialized;
    }

    /** While a query is present every matching group and action is forced open, whatever the user had open before. */
    protected override updated(): void {
        if (!this.searchActive || this.appliedRevision === this.revision) {
            this.appliedRevision = this.revision;
            return;
        }
        this.appliedRevision = this.revision;
        const groups = this.groupedBindings();
        const outer = this.shadowRoot?.querySelector<HTMLElement & { value: string[] }>('.groups');
        if (outer) outer.value = groups.map((group) => this.groupValue(group.componentName));
        for (const group of groups) {
            const inner = this.shadowRoot?.querySelector<HTMLElement & { value: string[] }>(`[data-group="${CSS.escape(group.componentName)}"] .actions`);
            if (inner) inner.value = group.bindings.map((binding) => this.actionValue(binding.actionId, binding.componentName));
        }
    }

    // ---- template ----------------------------------------------------------------------------------------

    protected override render() {
        const t = this.text;
        const groups = this.groupedBindings();
        const conflicts = this.conflictingActions();
        return html`<ge-dialog .open=${this.open} @open-change=${this.onOpenChange}>
            <ge-dialog-content close-label=${COMMON_LOCALES.en.close} dir=${t.rtl ? 'rtl' : nothing}>
                <ge-dialog-header class="header">
                    <ge-dialog-title>Keyboard Shortcuts</ge-dialog-title>
                    <ge-dialog-description>Browse available shortcuts and rebind actions for this app.</ge-dialog-description>
                    <div class="search-row">
                        <input type="text" class="search" aria-label=${t.searchPlaceholder} .value=${this.search} placeholder=${t.searchPlaceholder} @input=${this.onSearchInput} />
                    </div>
                    ${this.allowSaveMapping
                        ? html`<div class="save-row"><ge-button size="sm" variant="secondary" @click=${() => this.save()}>Save Changes</ge-button></div>`
                        : nothing}
                </ge-dialog-header>
                <ge-scroll-area class="scroll">
                    <div class="body">
                        <ge-accordion class="groups" type="multiple">${groups.map((group) => this.renderGroup(group, conflicts, t))}</ge-accordion>
                        ${groups.length === 0 ? html`<div class="empty">No shortcuts matched your search.</div>` : nothing}
                    </div>
                </ge-scroll-area>
            </ge-dialog-content>
        </ge-dialog>`;
    }

    private renderGroup(group: DialogGroup, conflicts: Set<string>, t: ShortcutBindingsDialogLocale): TemplateResult {
        return html`<ge-accordion-item class="group" data-group=${group.componentName} value=${this.groupValue(group.componentName)}>
            <ge-accordion-trigger class="group-trigger">
                <div class="group-heading">
                    <h3>${group.componentName}</h3>
                    <p>${`${plural(group.activeBindings, 'active action')} / ${group.bindings.length} total`}</p>
                </div>
            </ge-accordion-trigger>
            <ge-accordion-content class="group-content">
                <ge-accordion class="actions" type="multiple">${group.bindings.map((binding) => this.renderBinding(binding, conflicts, t))}</ge-accordion>
            </ge-accordion-content>
        </ge-accordion-item>`;
    }

    private renderBinding(binding: DialogBinding, conflicts: Set<string>, t: ShortcutBindingsDialogLocale): TemplateResult {
        const key = this.captureComponentKey(binding.actionId, binding.componentName);
        const armed = this.capturing === key;
        return html`<ge-accordion-item class="action" value=${this.actionValue(binding.actionId, binding.componentName)}>
            <ge-accordion-trigger class="action-trigger">
                <div class="action-row">
                    <div class="action-info">
                        <div class="action-title">
                            <p class="description">${binding.description}</p>
                            ${binding.category ? html`<ge-badge variant="secondary">${binding.category}</ge-badge>` : nothing}
                            ${conflicts.has(binding.actionId) ? html`<ge-badge variant="destructive">${t.conflict}</ge-badge>` : nothing}
                        </div>
                        <p class="meta"><span class="strong">Action:</span>${` ${binding.actionId}`}</p>
                        <p class="meta">${plural(binding.instances.length, 'active instance')}</p>
                    </div>
                    <div class="controls" tabindex="-1" @click=${stop} @keydown=${stop}>
                        <button
                            type="button"
                            class="capture"
                            ?data-armed=${armed}
                            aria-label=${interpolate(t.rebindAllInstances, { binding: binding.description })}
                            @click=${(event: Event) => this.startCapture(key, event)}
                            @keydown=${(event: KeyboardEvent) => this.capture(event, key, (shortcut) => shortcutBindings.setShortcutOverrideForAllInstances(binding.actionId, shortcut, binding.componentName))}
                        >${armed ? 'Press keys...' : `All: ${this.format(binding.effectiveShortcut)}`}</button>
                        <ge-button
                            class="reset"
                            variant="ghost"
                            size="sm"
                            ?disabled=${!shortcutBindings.hasShortcutOverrideForAllInstances(binding.actionId, binding.componentName)}
                            @click=${() => this.resetComponent(binding)}
                        >Reset all</ge-button>
                    </div>
                </div>
            </ge-accordion-trigger>
            <ge-accordion-content class="action-content">${this.renderInstances(binding)}</ge-accordion-content>
        </ge-accordion-item>`;
    }

    private renderInstances(binding: DialogBinding): TemplateResult {
        if (binding.instances.length === 0) {
            return html`<div class="no-instances">No active instances. Use the "All" control to define the shared shortcut for future instances.</div>`;
        }
        return html`<div class="instances">${binding.instances.map((instance) => this.renderInstance(binding, instance))}</div>`;
    }

    private renderInstance(binding: DialogBinding, instance: DialogInstance): TemplateResult {
        const key = this.captureInstanceKey(binding.actionId, instance.componentId);
        const armed = this.capturing === key;
        return html`<div class="instance">
            <div class="instance-row">
                <div class="instance-info">
                    <p class="instance-name">${instance.displayName}</p>
                    <p class="instance-default">${`Default: ${this.format(instance.defaultShortcut)}`}</p>
                </div>
                <div class="instance-controls">
                    <button
                        type="button"
                        class="capture"
                        ?data-armed=${armed}
                        aria-label=${interpolate(this.text.rebindInstance, { name: instance.displayName, binding: binding.description })}
                        @click=${(event: Event) => this.startCapture(key, event)}
                        @keydown=${(event: KeyboardEvent) => this.capture(event, key, (shortcut) => shortcutBindings.setShortcutOverrideForInstance(binding.actionId, shortcut, instance.componentId))}
                    >${armed ? 'Press keys...' : this.format(instance.effectiveShortcut)}</button>
                    <ge-button
                        class="reset"
                        variant="ghost"
                        size="sm"
                        ?disabled=${!shortcutBindings.hasShortcutOverrideForInstance(binding.actionId, instance.componentId)}
                        @click=${() => this.resetInstance(binding, instance)}
                    >Reset</ge-button>
                </div>
            </div>
        </div>`;
    }

    private resetComponent(binding: DialogBinding): void {
        shortcutBindings.clearShortcutOverrideForAllInstances(binding.actionId, binding.componentName);
        this.capturing = null;
    }

    private resetInstance(binding: DialogBinding, instance: DialogInstance): void {
        shortcutBindings.clearShortcutOverrideForInstance(binding.actionId, instance.componentId);
        this.capturing = null;
    }
}
