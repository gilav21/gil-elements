import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { arrowNavigation, isRtl, ownItems } from '../../shared/menu.js';
import { isTouchDevice } from '../../shared/touch.js';
import { MENU_SUB_REGISTER, type MenuSubHost } from '../../shared/menu-parts.js';
import css from './dropdown-menu-sub-content.css?inline';

/**
 * The submenu panel (`role="menu"`). Up and Down move through its own items; Escape, and the back arrow (Left, or
 * Right in right-to-left text), close it and return focus to its trigger without closing the parent menu.
 *
 * @slot - Items, labels, separators and further submenus.
 */
export class GeDropdownMenuSubContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private sub?: MenuSubHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menu');
        this.tabIndex = -1;
        this.dataset.slot = 'dropdown-menu-sub-content';
        this.sub = findParent<MenuSubHost, GeDropdownMenuSubContent>(this, MENU_SUB_REGISTER);
        this.sub?.register(this);
        this.addEventListener('mouseenter', this.onEnter);
        this.addEventListener('mouseleave', this.onLeave);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.sub?.unregister(this);
        this.sub = undefined;
        this.removeEventListener('mouseenter', this.onEnter);
        this.removeEventListener('mouseleave', this.onLeave);
        this.removeEventListener('keydown', this.onKeydown);
    }

    /** Moves focus to the first enabled item. */
    focusFirst(): void {
        ownItems(this)[0]?.focus();
    }

    // On touch the trigger's tap owns the state.
    private readonly onEnter = () => {
        if (!isTouchDevice()) this.sub?.enter();
    };

    private readonly onLeave = () => {
        if (!isTouchDevice()) this.sub?.leave();
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        // Every key stops here, so the root menu neither moves its own focus nor closes on this Escape.
        event.stopPropagation();
        const back = isRtl(this) ? 'ArrowRight' : 'ArrowLeft';
        if (event.key === back || event.key === 'Escape') {
            event.preventDefault();
            this.sub?.leave();
            this.sub?.focusTrigger();
            return;
        }
        arrowNavigation(event, this);
    };

    protected override updated(): void {
        if (this.sub?.open) this.dataset.state = 'open';
        else delete this.dataset.state;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
