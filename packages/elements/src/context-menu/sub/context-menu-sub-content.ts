import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { MENU_SUB_REGISTER, type MenuSubHost } from '../../shared/menu-parts.js';
import { arrowNavigation, isRtl, ownItems } from '../../shared/menu.js';
import { CONTEXT_MENU_REGISTER, type ContextMenuHost } from '../context-menu.js';
import css from './context-menu-sub-content.css?inline';

const EDGE = 8;
const GAP = 4;

/**
 * The submenu panel (`role="menu"`), in the browser's top layer beside its trigger row; it opens on the other side
 * when it would leave the viewport. Up, Down, Home and End move through its own items; Escape, and the back arrow
 * (Left, or Right in right-to-left text), close it and return focus to its trigger; Tab closes the whole menu.
 *
 * @slot - Items, labels, separators and further submenus.
 */
export class GeContextMenuSubContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private sub?: MenuSubHost;
    private root?: ContextMenuHost;
    private wasOpen = false;
    private frame = 0;

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menu');
        this.setAttribute('popover', 'manual');
        this.tabIndex = -1;
        this.dataset.slot = 'context-menu-sub-content';
        this.sub = findParent<MenuSubHost, GeContextMenuSubContent>(this, MENU_SUB_REGISTER);
        this.sub?.register(this);
        this.root = findParent<ContextMenuHost, GeContextMenuSubContent>(this, CONTEXT_MENU_REGISTER);
        this.addEventListener('mouseenter', this.onEnter);
        this.addEventListener('mouseleave', this.onLeave);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        cancelAnimationFrame(this.frame);
        this.sub?.unregister(this);
        this.sub = undefined;
        this.root?.unregister(this);
        this.root = undefined;
        this.removeEventListener('mouseenter', this.onEnter);
        this.removeEventListener('mouseleave', this.onLeave);
        this.removeEventListener('keydown', this.onKeydown);
    }

    /** Moves focus to the first enabled item. */
    focusFirst(): void {
        ownItems(this)[0]?.focus();
    }

    private readonly onEnter = () => this.sub?.enter();
    private readonly onLeave = () => this.sub?.leave();

    private readonly onKeydown = (event: KeyboardEvent) => {
        // Every key stops here, so the parent panel neither moves its own focus nor closes on this key.
        event.stopPropagation();
        if (event.ctrlKey || event.altKey || event.metaKey) return;
        const back = isRtl(this) ? 'ArrowRight' : 'ArrowLeft';
        if (event.key === back || event.key === 'Escape') {
            event.preventDefault();
            this.sub?.leave();
            this.sub?.focusTrigger();
        } else if (event.key === 'Tab') {
            event.preventDefault();
            this.root?.close();
        } else {
            arrowNavigation(event, this, { edges: true });
        }
    };

    protected override updated(): void {
        const open = this.sub?.open ?? false;
        if (open && !this.wasOpen) {
            this.showPopover();
            // Two frames: layout has to settle before the panel can be measured.
            cancelAnimationFrame(this.frame);
            this.frame = requestAnimationFrame(() => {
                this.frame = requestAnimationFrame(() => this.place());
            });
        } else if (!open && this.wasOpen) {
            cancelAnimationFrame(this.frame);
            if (this.matches(':popover-open')) this.hidePopover();
        }
        this.wasOpen = open;
    }

    private place(): void {
        const trigger = this.parentElement?.querySelector<HTMLElement>(':scope > [aria-haspopup="true"]');
        if (!trigger) return;
        const t = trigger.getBoundingClientRect();
        const c = this.getBoundingClientRect();
        const x = this.resolveX(t, c);
        const y = Math.max(EDGE, Math.min(t.top, innerHeight - c.height - EDGE));
        this.style.setProperty('--_x', `${x}px`);
        this.style.setProperty('--_y', `${y}px`);
    }

    /** Beside the row on the reading side; across it when that side has no room; always inside the viewport. */
    private resolveX(t: DOMRect, c: DOMRect): number {
        let x: number;
        if (isRtl(this)) {
            x = t.left - c.width - GAP;
            if (x < EDGE) x = t.right + GAP;
        } else {
            x = t.right + GAP;
            if (x + c.width > innerWidth - EDGE) x = t.left - c.width - GAP;
        }
        if (x < EDGE) x = EDGE;
        if (x + c.width > innerWidth - EDGE) x = innerWidth - c.width - EDGE;
        return x;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
