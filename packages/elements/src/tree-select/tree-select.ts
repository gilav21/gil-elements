import { html, nothing, unsafeCSS } from 'lit';
import { INTERACTIVE } from '../shared/activator.js';
import { UiElement } from '@gilav21/elements-base';
import { GePopover } from '../popover/popover.js';
import { resolveCommonLocale, type CommonLocale } from '../shared/common-locales.js';
import type { GeTree, TreeNode } from '../tree/tree.js';
import css from './tree-select.css?inline';

export type { TreeNode } from '../tree/tree.js';

const CHEVRON = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="chevron" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>`;

let nextId = 0;

function findNode(nodes: TreeNode[], key: string): TreeNode | null {
    for (const node of nodes) {
        if (node.key === key) return node;
        const found = node.children ? findNode(node.children, key) : null;
        if (found) return found;
    }
    return null;
}

/**
 * A select whose options are the nodes of a tree. Give it `nodes` and it draws its own combobox button and a
 * single-select `ge-tree` in a popover; leave `nodes` empty and project a `ge-popover-trigger` and
 * `ge-popover-content` (optionally wrapped in `ge-tree-select-trigger` / `ge-tree-select-content`), then call
 * `select(key)` from your own content.
 *
 * It takes part in forms: the selected node's key is submitted under `name`.
 *
 * @slot - Custom mode: a `ge-popover-trigger` and a `ge-popover-content`. Ignored while `nodes` has entries.
 * It is a `ge-popover` itself, so `open`, `show()`, `hide()` and `close-on-scroll` work as they do there.
 *
 * @attr {boolean} open - Whether the popover is showing.
 * @attr {string} placeholder - Text while nothing is selected. Defaults to the locale's "Select...".
 * @attr {boolean} disabled - Disables the built-in trigger (not a projected one).
 * @attr {string} value - Key of the selected node, or empty for none.
 * @attr {string} name - Form field name for the selected key.
 * @attr {string} locale - Locale id or object; defaults to the page's `lang`, then `en`.
 * @prop {TreeNode[]} nodes - `{ key, label, icon?, children?, disabled?, data? }` nodes for the built-in popover.
 * @fires selection-change - After the user picks; `detail` is the selected keys (at most one; empty when cleared). Setting `value` does not fire it.
 * @fires change - Same moment, as for any form field.
 * @fires open-change - The popover opened or closed by the user; `detail` is the new state.
 * @csspart trigger - The combobox button (built-in trigger only).
 */
export class GeTreeSelect extends GePopover {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static readonly formAssociated = true;
    static override readonly properties = {
        ...GePopover.properties,
        nodes: { attribute: false },
        placeholder: {},
        disabled: { type: Boolean, reflect: true },
        value: {},
        name: { reflect: true },
        locale: { reflect: true },
        panelWidth: { state: true },
        fieldsetDisabled: { state: true },
    };

    declare nodes: TreeNode[];
    declare placeholder: string | null;
    declare disabled: boolean;
    declare value: string | null;
    declare name: string;
    declare locale: string | CommonLocale;
    declare protected panelWidth: number;
    declare protected fieldsetDisabled: boolean;
    private readonly internals?: ElementInternals;
    private readonly popupId = `ge-tree-select-popup-${++nextId}`;
    private defaultValue: string | null = null;
    private focusTimer?: ReturnType<typeof setTimeout>;

    constructor() {
        super();
        this.nodes = [];
        this.placeholder = null;
        this.disabled = false;
        this.value = null;
        this.name = '';
        this.locale = '';
        this.panelWidth = 0;
        this.fieldsetDisabled = false;
        this.internals = this.attachInternals?.();
    }

    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** `true` when `nodes` has entries and the component draws its own trigger and tree. */
    get isDataDriven(): boolean {
        return this.nodes.length > 0;
    }

    /** The node `value` points at, or `null`. */
    get selectedNode(): TreeNode | null {
        return this.value ? findNode(this.nodes, this.value) : null;
    }

    private get text(): CommonLocale {
        return resolveCommonLocale(this.locale);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'tree-select';
        this.defaultValue = this.value;
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        clearTimeout(this.focusTimer);
    }

    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    formResetCallback(): void {
        this.value = this.defaultValue;
    }

    override show(): void {
        if (!this.isDisabled) super.show();
    }

    override toggle(): void {
        if (this.open) this.hide();
        else this.show();
    }

    /** The trigger lives in this element's own shadow root when it draws it, and in the light DOM when it is projected. */
    private triggerPart(): HTMLElement | null {
        return this.renderRoot.querySelector<HTMLElement>('ge-popover-trigger') ?? this.querySelector<HTMLElement>('ge-popover-trigger');
    }

    override triggerRect(): DOMRect | null {
        return this.triggerPart()?.shadowRoot?.querySelector('[part="base"]')?.getBoundingClientRect() ?? null;
    }

    override triggerFocusTarget(): HTMLElement | null {
        const trigger = this.triggerPart();
        return trigger?.querySelector<HTMLElement>(INTERACTIVE) ?? trigger?.shadowRoot?.querySelector<HTMLElement>('[part="base"]') ?? null;
    }

    /**
     * Selects a node by key (or clears with `null`), closes the popover and fires `selection-change`. For custom
     * content, which has no tree to report a pick for it. It does not check `disabled`.
     */
    select(key: string | null): void {
        this.value = key;
        this.emitChange(key ? [key] : []);
        this.hide();
    }

    private emitChange(selection: string[]): void {
        this.dispatchEvent(new CustomEvent<string[]>('selection-change', { detail: selection, bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    }

    private readonly onSelectionChange = (event: CustomEvent<string[]>) => {
        const keys = event.detail;
        this.value = keys[0] ?? null;
        this.emitChange(keys);
        this.hide();
    };

    protected override willUpdate(changed: Map<PropertyKey, unknown>): void {
        if (changed.has('open') && this.open) {
            const trigger = this.renderRoot.querySelector<HTMLElement>('.trigger');
            if (trigger) this.panelWidth = trigger.getBoundingClientRect().width;
        }
    }

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        super.updated(changed);
        this.internals?.setFormValue(this.value);
        if (changed.has('open') && this.open) this.focusTreeSoon();
    }

    /** Waits a beat so the popover has placed the panel, then puts the tree's focus on the selected row. */
    private focusTreeSoon(): void {
        clearTimeout(this.focusTimer);
        this.focusTimer = setTimeout(() => {
            this.renderRoot.querySelector<GeTree>('ge-tree')?.focusNode(this.value);
        }, 50);
    }

    protected override render() {
        const rtl = this.text.rtl ? 'rtl' : nothing;
        if (!this.isDataDriven) return html`<slot></slot>`;
        const placeholder = this.placeholder ?? this.text.selectPlaceholder;
        const selected = this.selectedNode;
        return html`<div class="root" dir=${rtl}>
            <ge-popover-trigger>
                <button
                    type="button"
                    role="combobox"
                    class="trigger"
                    part="trigger"
                    data-slot="tree-select-trigger"
                    ?disabled=${this.isDisabled}
                    aria-expanded=${this.open ? 'true' : 'false'}
                    aria-label=${placeholder}
                    aria-controls=${this.popupId}
                    aria-haspopup="tree"
                >
                    <span class="label">${selected ? selected.label : html`<span class="placeholder">${placeholder}</span>`}</span>
                    ${CHEVRON}
                </button>
            </ge-popover-trigger>
            <ge-popover-content id=${this.popupId} strategy="fixed" align="start" style="--_width:${this.panelWidth}px">
                <div dir=${rtl}>
                    ${this.open
                        ? html`<ge-tree class="tree" .data=${this.nodes} selectable="single" @selection-change=${this.onSelectionChange}></ge-tree>`
                        : nothing}
                </div>
            </ge-popover-content>
        </div>`;
    }
}
