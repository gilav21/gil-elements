import { html, render, unsafeCSS, type PropertyValues, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren, byDocumentOrder } from '../shared/compound.js';
import { isRtl } from '../shared/menu.js';
import css from './tree.css?inline';
import type { GeTreeItem } from './sub/tree-item.js';

export const TREE_REGISTER = 'ge-tree-register';
export type TreeSelectable = 'single' | 'multiple' | 'none';

/** One node of the `data` property. `key` is the identity every emitted key array uses; keep it unique. */
export interface TreeNode {
    key: string;
    label: string;
    icon?: string;
    children?: TreeNode[];
    data?: unknown;
}

/** Draws the content of a node's label instead of its icon and text. */
export type TreeNodeContent = (node: TreeNode) => TemplateResult | string | Node;

/** What the items need from their tree. */
export interface TreeHost extends HTMLElement {
    readonly selectable: TreeSelectable;
    readonly rtl: boolean;
    isExpanded(key: string): boolean;
    isSelected(key: string): boolean;
    isFocused(key: string): boolean;
    toggleExpanded(key: string): void;
    toggleSelected(key: string): void;
    setFocused(key: string): void;
    register(item: GeTreeItem): void;
    unregister(item: GeTreeItem): void;
}

interface KeyContext {
    items: GeTreeItem[];
    values: string[];
    focused: string | null;
    index: number;
}

const HANDLED = new Set(['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Home', 'End', '*', 'ArrowLeft', 'ArrowRight']);

/**
 * A hierarchy of expandable, optionally selectable nodes. Write `ge-tree-item`s yourself, or hand the `data`
 * property a list of nodes and the tree draws them.
 *
 * The whole tree is one tab stop. Up and Down move through the visible nodes, Home and End jump to the first
 * and last, Right and Left expand and collapse (swapped in RTL) or step to the first child or the parent, `*`
 * expands every visible parent and Enter or Space selects. Moving focus never selects.
 *
 * @slot - `ge-tree-item`s (ignored while `data` has nodes).
 * @fires selection-change - After the selection changes; `detail` is every selected key.
 * @fires expand-change - After a node expands or collapses, and when `initial-expand-depth` applies; `detail` is every expanded key.
 * @attr {'single' | 'multiple' | 'none'} selectable - Selection mode. `none` (default) leaves selection off.
 * @attr {number} initial-expand-depth - Levels of `data` open on load: `0` none, `n` down to depth `n`, `-1` all. Re-applied whenever `data` changes.
 */
export class GeTree extends UiElement implements TreeHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        selectable: { reflect: true },
        initialExpandDepth: { attribute: 'initial-expand-depth', type: Number },
        data: { attribute: false },
        nodeContent: { attribute: false },
        expandedKeys: { state: true },
        selectedKeys: { state: true },
        focusedKey: { state: true },
        rtl: { state: true },
    };

    declare selectable: TreeSelectable;
    declare initialExpandDepth: number;
    /** Nodes to draw. When non-empty the tree renders them itself and ignores projected items. */
    declare data: TreeNode[];
    /** Draws each node's label content in place of its icon and text. */
    declare nodeContent: TreeNodeContent | undefined;
    declare expandedKeys: ReadonlySet<string>;
    declare selectedKeys: ReadonlySet<string>;
    declare focusedKey: string | null;
    declare rtl: boolean;

    private readonly registry = new Set<GeTreeItem>();

    constructor() {
        super();
        this.selectable = 'none';
        this.initialExpandDepth = 0;
        this.data = [];
        this.expandedKeys = new Set();
        this.selectedKeys = new Set();
        this.focusedKey = null;
        this.rtl = false;
        adoptChildren<TreeHost, GeTreeItem>(this, TREE_REGISTER, (item) => this.register(item));
        this.addEventListener('keydown', this.onKeydown);
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'tree');
        this.dataset.slot = 'tree';
        if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
        this.rtl = isRtl(this);
    }

    register(item: GeTreeItem): void {
        this.registry.add(item);
        item.requestUpdate();
    }

    unregister(item: GeTreeItem): void {
        this.registry.delete(item);
    }

    isExpanded(key: string): boolean {
        return this.expandedKeys.has(key);
    }

    isSelected(key: string): boolean {
        return this.selectedKeys.has(key);
    }

    isFocused(key: string): boolean {
        return this.focusedKey === key;
    }

    setFocused(key: string): void {
        this.focusedKey = key;
    }

    /** Expands the node if collapsed and collapses it otherwise. Its descendants keep their own flags. */
    toggleExpanded(key: string): void {
        const next = new Set(this.expandedKeys);
        if (!next.delete(key)) next.add(key);
        this.setExpanded(next);
    }

    /** Selects the node or deselects it. Does nothing while `selectable` is `none`; `single` drops the previous key first. */
    toggleSelected(key: string): void {
        if (this.selectable === 'none') return;
        const next = new Set(this.selectable === 'single' ? [] : this.selectedKeys);
        if (this.selectedKeys.has(key)) next.delete(key);
        else next.add(key);
        this.selectedKeys = next;
        this.dispatchEvent(new CustomEvent<string[]>('selection-change', { detail: [...next], bubbles: true }));
    }

    /** Makes exactly `keys` the expanded set; pass every parent you want open. */
    expandAll(keys: string[]): void {
        this.setExpanded(new Set(keys));
    }

    collapseAll(): void {
        this.setExpanded(new Set());
    }

    /** Moves focus to the tree and points it at `key`; with no key it keeps the current node, or takes the first. */
    focusNode(key?: string | null): void {
        if (key) this.focusedKey = key;
        else if (!this.focusedKey) this.focusedKey = this.orderedItems()[0]?.value ?? null;
        this.focus();
    }

    private setExpanded(keys: Set<string>): void {
        this.expandedKeys = keys;
        this.dispatchEvent(new CustomEvent<string[]>('expand-change', { detail: [...keys], bubbles: true }));
    }

    private orderedItems(): GeTreeItem[] {
        return [...this.registry].sort(byDocumentOrder);
    }

    private visibleItems(): GeTreeItem[] {
        return this.orderedItems().filter((item) => item.ancestorKeys().every((key) => this.isExpanded(key)));
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if ((changed.has('data') || changed.has('initialExpandDepth')) && this.data.length > 0 && this.initialExpandDepth !== 0) {
            this.setExpanded(this.keysToDepth(this.data, this.initialExpandDepth));
        }
    }

    private keysToDepth(nodes: TreeNode[], maxDepth: number, depth = 0, keys = new Set<string>()): Set<string> {
        if (maxDepth !== -1 && depth >= maxDepth) return keys;
        for (const node of nodes) {
            if (!node.children?.length) continue;
            keys.add(node.key);
            this.keysToDepth(node.children, maxDepth, depth + 1, keys);
        }
        return keys;
    }

    protected override updated(): void {
        // Read again on every update: a tree built inside another element is connected before that element's `dir` reaches it.
        const rtl = isRtl(this);
        if (rtl !== this.rtl) this.rtl = rtl;
        this.setAttribute('aria-multiselectable', String(this.selectable === 'multiple'));
        const active = this.focusedKey === null ? undefined : this.orderedItems().find((item) => item.value === this.focusedKey);
        if (active) this.setAttribute('aria-activedescendant', active.id);
        else this.removeAttribute('aria-activedescendant');
        for (const item of this.registry) item.requestUpdate();
        // The items are light children, so the tree draws them into itself rather than into its shadow root.
        render(this.data.length > 0 ? this.nodes(this.data) : html``, this, { host: this });
    }

    private nodes(nodes: TreeNode[]): TemplateResult[] {
        return nodes.map((node) => {
            const expandable = !!node.children?.length;
            return html`<ge-tree-item .value=${node.key} .hasNested=${expandable}>
                <ge-tree-label>${this.nodeContent ? this.nodeContent(node) : html`${node.icon ? html`<ge-tree-icon>${node.icon}</ge-tree-icon>` : ''} ${node.label}`}</ge-tree-label>
                ${expandable && this.isExpanded(node.key) ? this.nodes(node.children ?? []) : ''}
            </ge-tree-item>`;
        });
    }

    protected override render() {
        return html`<slot></slot>`;
    }

    private readonly onKeydown = (event: KeyboardEvent): void => {
        const items = this.visibleItems();
        const expandKey = this.rtl ? 'ArrowLeft' : 'ArrowRight';
        const collapseKey = this.rtl ? 'ArrowRight' : 'ArrowLeft';
        const handled = HANDLED.has(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey;
        // ArrowLeft/Right are only the expand and collapse keys here; either way both of them are consumed.
        if (items.length === 0 || !handled) return;
        const values = items.map((item) => item.value);
        const context = { items, values, focused: this.focusedKey, index: this.focusedKey ? values.indexOf(this.focusedKey) : -1 };
        event.preventDefault();
        this.dispatchKey(event.key, context, expandKey, collapseKey);
    };

    private dispatchKey(key: string, context: KeyContext, expandKey: string, collapseKey: string): void {
        const { items, values, focused, index } = context;
        if (key === expandKey) this.expandOrDescend(context);
        else if (key === collapseKey) this.collapseOrAscend(items, focused);
        else if (key === 'ArrowDown') this.moveTo(values[index + 1]);
        else if (key === 'ArrowUp') this.moveTo(index === -1 ? values.at(-1) : values[index - 1]);
        else if (key === 'Home') this.moveTo(values[0]);
        else if (key === 'End') this.moveTo(values.at(-1));
        else if (key === '*') this.expandVisibleParents(items);
        else if ((key === 'Enter' || key === ' ') && focused) this.toggleSelected(focused);
    }

    private moveTo(key: string | undefined): void {
        if (key !== undefined) this.focusedKey = key;
    }

    private expandOrDescend({ items, values, focused, index }: KeyContext): void {
        const item = items.find((candidate) => candidate.value === focused);
        if (!focused || !item?.hasChildren) return;
        if (!this.isExpanded(focused)) this.toggleExpanded(focused);
        else this.moveTo(values[index + 1]);
    }

    private collapseOrAscend(items: GeTreeItem[], focused: string | null): void {
        if (!focused) return;
        if (this.isExpanded(focused)) {
            this.toggleExpanded(focused);
            return;
        }
        const parent = items.find((candidate) => candidate.value === focused)?.parentItem?.value;
        if (parent === undefined) return;
        this.focusedKey = parent;
        if (this.isExpanded(parent)) this.toggleExpanded(parent);
    }

    private expandVisibleParents(items: GeTreeItem[]): void {
        const closed = items.filter((item) => item.hasChildren && !this.isExpanded(item.value));
        if (closed.length === 0) return;
        this.setExpanded(new Set([...this.expandedKeys, ...closed.map((item) => item.value)]));
    }
}
