import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { isTouchDevice } from '../../shared/touch.js';
import { MENUBAR_MENU_REGISTER, type MenubarMenuHost } from './menubar-menu.js';
import css from './menubar-trigger.css?inline';

/**
 * The label of a menu in the bar. A click opens or closes the menu; while another menu is open, hovering opens this
 * one instead. Left and Right walk the bar (mirrored in right-to-left text), carrying an open menu along; Down and
 * Enter open the menu and move focus to its first item; Space toggles it.
 *
 * @slot - The label.
 */
export class GeMenubarTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private menu?: MenubarMenuHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menuitem');
        this.setAttribute('aria-haspopup', 'menu');
        this.tabIndex = 0;
        this.dataset.slot = 'menubar-trigger';
        this.menu = findParent<MenubarMenuHost, GeMenubarTrigger>(this, MENUBAR_MENU_REGISTER);
        this.menu?.register(this);
        this.addEventListener('click', this.onClick);
        this.addEventListener('mouseenter', this.onEnter);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('mouseenter', this.onEnter);
        this.removeEventListener('keydown', this.onKeydown);
        this.menu = undefined;
    }

    private readonly onClick = () => {
        this.menu?.toggle();
    };

    // Hover only switches menus once the bar is open; with touch the tap is the only way in.
    private readonly onEnter = () => {
        if (!isTouchDevice() && this.menu?.barIsOpen) this.menu.show();
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (!this.menu) return;
        const step = this.menu.stepFor(event.key);
        if (step) {
            event.preventDefault();
            this.menu.focusAdjacent(step);
        } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
            event.preventDefault();
            this.menu.show();
            this.menu.focusFirstItem();
        } else if (event.key === ' ') {
            event.preventDefault();
            this.click();
        }
    };

    protected override updated(): void {
        const open = this.menu?.open ?? false;
        this.setAttribute('aria-expanded', String(open));
        this.dataset.state = open ? 'open' : 'closed';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
