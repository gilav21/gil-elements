import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { arrowNavigation, ownItems } from '../../shared/menu.js';
import { MENUBAR_MENU_REGISTER, type MenubarMenuHost } from './menubar-menu.js';
import css from './menubar-content.css?inline';

/**
 * The panel of a menu (`role="menu"`); it draws nothing until its menu is open. Up and Down move through the
 * items with wraparound, Left and Right switch to the neighbouring menu (mirrored in right-to-left text), and
 * Escape closes it and returns focus to the trigger.
 *
 * @slot - Items, separators and submenus.
 */
export class GeMenubarContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private menu?: MenubarMenuHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menu');
        this.tabIndex = -1;
        this.dataset.slot = 'menubar-content';
        this.menu = findParent<MenubarMenuHost, GeMenubarContent>(this, MENUBAR_MENU_REGISTER);
        this.menu?.register(this);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('keydown', this.onKeydown);
        this.menu = undefined;
    }

    /** Moves focus to the first enabled item. */
    focusFirst(): void {
        ownItems(this)[0]?.focus();
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (arrowNavigation(event, this)) return;
        const step = this.menu?.stepFor(event.key);
        if (!step) return;
        event.preventDefault();
        this.menu?.focusAdjacent(step);
    };

    protected override updated(): void {
        if (this.menu?.open) this.dataset.state = 'open';
        else delete this.dataset.state;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
