import { html, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import type { GeSidebarMenuSub } from './sidebar-menu-sub.js';
import css from './sidebar-menu-sub-trigger.css?inline';

/**
 * The row that opens and closes a `ge-sidebar-menu-sub`. Point `for` at the sub-menu's id.
 *
 * `aria-controls` is left out on purpose: the button and the list live in different shadow trees, where an id
 * reference cannot resolve, and `aria-expanded` already carries the state.
 *
 * @slot - Usually an icon followed by a `<span>` label; on a collapsed rail only the first child stays visible.
 * @attr {string} for - The id of the `ge-sidebar-menu-sub` it controls.
 * @csspart base - The `<button>`.
 */
export class GeSidebarMenuSubTrigger extends GeSidebarPart {
    static override readonly styles = [GeSidebarPart.styles, unsafeCSS(css)];
    static override readonly properties = { for: { reflect: true } };

    /** The id of the controlled sub-menu. */
    declare for: string;
    private target?: GeSidebarMenuSub;

    constructor() {
        super();
        this.for = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.bind();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.target?.unregisterTrigger(this);
        this.target = undefined;
    }

    protected override willUpdate(): void {
        this.bind();
    }

    /** Looks the sub-menu up again, so it also works when the sub-menu is written after the trigger or `for` changes. */
    private bind(): void {
        const next = this.for ? ((this.getRootNode() as Document | ShadowRoot).getElementById(this.for) as GeSidebarMenuSub | null) : null;
        if (next === this.target) return;
        this.target?.unregisterTrigger(this);
        this.target = next ?? undefined;
        this.target?.registerTrigger(this);
    }

    protected override render() {
        const open = this.target?.isOpen ?? false;
        return html`<button
            part="base"
            type="button"
            data-slot="sidebar-menu-sub-trigger"
            data-state=${open ? 'open' : 'closed'}
            ?data-collapsed=${this.collapsedState}
            aria-expanded=${String(open)}
            @click=${() => this.target?.toggle()}
        >
            <slot></slot>
            <svg class="chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
        </button>`;
    }
}
