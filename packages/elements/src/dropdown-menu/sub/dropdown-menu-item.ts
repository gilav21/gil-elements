import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { activateAsClick, blockDisabledActivation } from '../../shared/menu.js';
import { DROPDOWN_MENU_REGISTER, type DropdownMenuHost } from '../dropdown-menu.js';
import css from './dropdown-menu-item.css?inline';

/**
 * A row. Activating it (click, Enter or Space) closes the menu; bind your own `click` listener for the action. A key
 * activation is a real click, so that listener runs once for pointer and keyboard alike, and never while disabled.
 *
 * @slot - The label.
 * @attr {boolean} disabled - Dims the row, blocks activation and removes it from the arrow-key ring.
 * @attr {boolean} inset - Indents the label to line up with rows that carry an icon.
 * @attr {string} shortcut - Hint text on the right, such as `⌘K`. Decorative: it binds no key.
 * @cssprop --density-menu - Spacing multiplier for this component; falls back to `--density`.
 */
export class GeDropdownMenuItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        disabled: { type: Boolean, reflect: true },
        inset: { type: Boolean, reflect: true },
        shortcut: {},
    };

    declare disabled: boolean;
    declare inset: boolean;
    declare shortcut: string;
    private menu?: DropdownMenuHost;
    private unblock?: () => void;

    constructor() {
        super();
        this.disabled = false;
        this.inset = false;
        this.shortcut = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menuitem');
        this.tabIndex = -1;
        this.dataset.slot = 'dropdown-item';
        this.menu = findParent<DropdownMenuHost, GeDropdownMenuItem>(this, DROPDOWN_MENU_REGISTER);
        this.unblock = blockDisabledActivation(this, () => this.disabled);
        this.addEventListener('click', this.onClick);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.unblock?.();
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('keydown', this.onKeydown);
        this.menu = undefined;
    }

    // A disabled row never gets here: the capture guard stops its click first.
    private readonly onClick = () => this.menu?.hide();

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') activateAsClick(event, this, this.disabled);
    };

    protected override updated(): void {
        this.toggleAttribute('data-disabled', this.disabled);
        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
    }

    protected override render() {
        return html`<slot></slot>${this.shortcut ? html`<span class="shortcut" part="shortcut">${this.shortcut}</span>` : nothing}`;
    }
}
