import { html, unsafeCSS } from 'lit';
import { GeSidebarPart } from './sidebar-part.js';
import css from './sidebar-menu-sub.css?inline';

/** `expanded` is on unless the attribute says `false`, because a bare boolean attribute cannot default to true. */
const defaultTrue = { fromAttribute: (attribute: string | null): boolean => attribute !== 'false', toAttribute: String };

/**
 * A nested list under a menu row, opened and closed by a `ge-sidebar-menu-sub-trigger`. Its rows stay in the DOM and
 * collapse with a grid-row transition; while closed they are `inert`, so Tab skips them. On a collapsed rail it is
 * always closed.
 *
 * @slot - `ge-sidebar-menu-sub-item`s.
 * @fires expanded-change - After the user opens or closes it; read `expanded`.
 * @attr {boolean} expanded - Whether it is open. On unless set to `false`.
 */
export class GeSidebarMenuSub extends GeSidebarPart {
    static override readonly styles = [GeSidebarPart.styles, unsafeCSS(css)];
    static override readonly properties = {
        expanded: { converter: defaultTrue, reflect: true },
    };

    declare expanded: boolean;
    private readonly triggers = new Set<HTMLElement & { requestUpdate(): void }>();

    constructor() {
        super();
        this.expanded = true;
    }

    /** Whether the rows are showing: expanded, and not squeezed into a collapsed rail. */
    get isOpen(): boolean {
        return this.expanded && !this.collapsedState;
    }

    /** Opens the list if closed and closes it otherwise. */
    toggle(): void {
        this.expanded = !this.expanded;
        this.dispatchEvent(new CustomEvent<boolean>('expanded-change', { detail: this.expanded, bubbles: true }));
    }

    registerTrigger(trigger: HTMLElement & { requestUpdate(): void }): void {
        this.triggers.add(trigger);
    }

    unregisterTrigger(trigger: HTMLElement & { requestUpdate(): void }): void {
        this.triggers.delete(trigger);
    }

    protected override updated(): void {
        for (const trigger of this.triggers) trigger.requestUpdate();
    }

    protected override render() {
        const open = this.isOpen;
        return html`<div class="wrap" data-slot="sidebar-menu-sub" data-state=${open ? 'open' : 'closed'}>
            <div class="clip"><ul ?inert=${!open}><slot></slot></ul></div>
        </div>`;
    }
}
