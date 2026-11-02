import { html, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { isRtl } from '../../shared/menu.js';
import { isTouchDevice } from '../../shared/touch.js';
import { DROPDOWN_SUB_REGISTER, type DropdownSubHost } from './dropdown-menu-sub.js';
import css from './dropdown-menu-sub-trigger.css?inline';

const CHEVRON = svg`<path d="m9 18 6-6-6-6" />`;

/**
 * The row that opens a submenu: on hover, on a tap (touch), on Enter and on the forward arrow (Right, or Left in
 * right-to-left text), which also moves focus into it.
 *
 * @slot - The label.
 * @attr {boolean} disabled - Dims the row and stops hover, tap and keys from opening the submenu.
 * @attr {boolean} inset - Indents the label to line up with rows that carry an icon.
 */
export class GeDropdownMenuSubTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        disabled: { type: Boolean, reflect: true },
        inset: { type: Boolean, reflect: true },
    };

    declare disabled: boolean;
    declare inset: boolean;
    private sub?: DropdownSubHost;

    constructor() {
        super();
        this.disabled = false;
        this.inset = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'menuitem');
        this.setAttribute('aria-haspopup', 'true');
        this.tabIndex = -1;
        this.dataset.slot = 'dropdown-menu-sub-trigger';
        this.sub = findParent<DropdownSubHost, GeDropdownMenuSubTrigger>(this, DROPDOWN_SUB_REGISTER);
        this.sub?.register(this);
        this.addEventListener('mouseenter', this.onEnter);
        this.addEventListener('mouseleave', this.onLeave);
        this.addEventListener('click', this.onClick);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.sub?.unregister(this);
        this.sub = undefined;
        this.removeEventListener('mouseenter', this.onEnter);
        this.removeEventListener('mouseleave', this.onLeave);
        this.removeEventListener('click', this.onClick);
        this.removeEventListener('keydown', this.onKeydown);
    }

    private readonly onEnter = () => {
        if (!this.disabled && !isTouchDevice()) this.sub?.enter();
    };

    private readonly onLeave = () => {
        if (!isTouchDevice()) this.sub?.leave();
    };

    // Touch only: with a mouse, a click would immediately close the submenu that hover just opened.
    private readonly onClick = () => {
        if (this.disabled || !isTouchDevice() || !this.sub) return;
        if (this.sub.open) this.sub.leave();
        else this.sub.enter();
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (this.disabled || event.target !== this) return;
        const forward = isRtl(this) ? 'ArrowLeft' : 'ArrowRight';
        if (event.key !== forward && event.key !== 'Enter') return;
        event.preventDefault();
        this.sub?.enter();
        this.sub?.focusContent();
    };

    protected override updated(): void {
        this.toggleAttribute('data-disabled', this.disabled);
        if (this.disabled) this.setAttribute('aria-disabled', 'true');
        else this.removeAttribute('aria-disabled');
        this.setAttribute('aria-expanded', String(this.sub?.open ?? false));
    }

    protected override render() {
        return html`<slot></slot><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CHEVRON}</svg>`;
    }
}
