import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { TREE_REGISTER, type TreeHost } from '../tree.js';
import css from './tree-item.css?inline';

let nextId = 0;

/** `has-nested` is true when present, false when set to `false`, and unset (count the child items) when absent. */
const tristate = {
    fromAttribute: (attribute: string | null): boolean | undefined => (attribute === null ? undefined : attribute !== 'false'),
};

/**
 * One node of a tree: a row with an expand chevron and a `ge-tree-label`, and its child `ge-tree-item`s.
 *
 * Selection, expansion and focus belong to the tree and are keyed by `value`, so keep it unique in the tree.
 *
 * @slot label - The `ge-tree-label` (it assigns itself here).
 * @slot - Child `ge-tree-item`s.
 * @attr {string} value - The node's key. Required.
 * @attr {boolean} has-nested - Forces the chevron on (`true`, for lazily loaded branches) or off (`false`); left unset the item counts its child items.
 */
export class GeTreeItem extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        value: { reflect: true },
        hasNested: { attribute: 'has-nested', converter: tristate },
        childCount: { state: true },
    };

    declare value: string;
    declare hasNested: boolean | undefined;
    declare childCount: number;

    private tree?: TreeHost;
    private observer?: MutationObserver;
    private readonly autoId = `ge-tree-item-${++nextId}`;

    constructor() {
        super();
        this.value = '';
        this.hasNested = undefined;
        this.childCount = 0;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'treeitem');
        this.dataset.slot = 'tree-item';
        if (!this.id) this.id = this.autoId;
        this.tree = findParent<TreeHost, GeTreeItem>(this, TREE_REGISTER);
        this.tree?.register(this);
        this.countChildren();
        this.observer = new MutationObserver(() => this.countChildren());
        this.observer.observe(this, { childList: true });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.observer?.disconnect();
        this.tree?.unregister(this);
        this.tree = undefined;
    }

    /** The item this one is nested in, if any. */
    get parentItem(): GeTreeItem | null {
        return this.parentElement?.closest<GeTreeItem>('ge-tree-item') ?? null;
    }

    get hasChildren(): boolean {
        return this.hasNested ?? this.childCount > 0;
    }

    /** Keys of every ancestor item, nearest first. */
    ancestorKeys(): string[] {
        const keys: string[] = [];
        for (let item = this.parentItem; item; item = item.parentItem) keys.push(item.value);
        return keys;
    }

    private countChildren(): void {
        this.childCount = this.querySelectorAll(':scope > ge-tree-item').length;
    }

    protected override updated(changed: PropertyValues<this>): void {
        const tree = this.tree;
        const expanded = tree?.isExpanded(this.value) ?? false;
        const selected = tree?.isSelected(this.value) ?? false;
        const focused = tree?.isFocused(this.value) ?? false;
        this.dataset.expanded = String(expanded);
        this.dataset.selected = String(selected);
        this.dataset.focused = String(focused);
        this.toggleAttribute('data-rtl', tree?.rtl ?? false);
        if (this.hasChildren) this.setAttribute('aria-expanded', String(expanded));
        else this.removeAttribute('aria-expanded');
        if (tree && tree.selectable !== 'none') this.setAttribute('aria-selected', String(selected));
        else this.removeAttribute('aria-selected');
        // aria-activedescendant never moves the browser's scroll, so the row is brought into view by hand.
        if (focused && !changed.has('childCount')) this.shadowRoot?.querySelector('.header')?.scrollIntoView({ block: 'nearest' });
    }

    protected override render() {
        const expanded = this.tree?.isExpanded(this.value) ?? false;
        const chevron = html`<button class="expand" type="button" tabindex="-1" aria-hidden="true" @click=${this.onExpandClick}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </button>`;
        return html`<div class="header" tabindex="-1" @click=${this.onHeaderClick}>
                ${this.hasChildren ? chevron : html`<span class="spacer"></span>`}<slot name="label"></slot>
            </div>
            ${this.hasChildren ? html`<div class="group" role="group" ?hidden=${!expanded}><slot></slot></div>` : nothing}`;
    }

    private readonly onExpandClick = (event: MouseEvent): void => {
        // Opening a parent must not also select it.
        event.stopPropagation();
        this.tree?.toggleExpanded(this.value);
    };

    private readonly onHeaderClick = (): void => {
        this.tree?.setFocused(this.value);
        this.tree?.toggleSelected(this.value);
    };
}
