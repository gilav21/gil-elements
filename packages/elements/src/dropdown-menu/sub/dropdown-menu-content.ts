import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { arrowNavigation, ownItems } from '../../shared/menu.js';
import type { Align } from '../../shared/anchor.js';
import { DROPDOWN_MENU_REGISTER, type DropdownMenuHost } from '../dropdown-menu.js';
import css from './dropdown-menu-content.css?inline';

/**
 * The panel; it is the element with `role="menu"`, and draws nothing until the menu is open. Up and Down move
 * through the items with wraparound, Tab cycles inside it, and Escape closes the menu. Focus lands on the first
 * enabled item as the menu opens.
 *
 * @slot - Items, labels, separators and submenus.
 * @attr {string} align - Which edge lines up with the trigger: `start` (default), `center` or `end`. `start` and `end` follow the text direction.
 */
export class GeDropdownMenuContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        align: { reflect: true },
    };

    declare align: Align;
    private owner?: DropdownMenuHost;
    private wasOpen = false;

    constructor() {
        super();
        this.align = 'start';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menu');
        this.tabIndex = -1;
        this.dataset.slot = 'dropdown-content';
        this.addEventListener('keydown', this.onKeydown);
        this.owner = findParent<DropdownMenuHost, GeDropdownMenuContent>(this, DROPDOWN_MENU_REGISTER);
        this.owner?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('keydown', this.onKeydown);
        this.owner?.unregister(this);
        this.owner = undefined;
    }

    /** Moves focus to the first enabled item; call it after changing the items while the menu is open. */
    focusFirst(): void {
        ownItems(this)[0]?.focus();
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        arrowNavigation(event, this, { trapTab: true });
    };

    protected override updated(): void {
        const open = this.owner?.open ?? false;
        if (open) this.dataset.state = 'open';
        else delete this.dataset.state;
        const opened = open && !this.wasOpen;
        this.wasOpen = open;
        // One tick: the items are laid out and focusable only once the panel has stopped being display: none.
        if (opened) setTimeout(() => this.focusFirst());
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
