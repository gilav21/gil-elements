import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { COLLAPSIBLE_REGISTER, type CollapsibleHost } from '../collapsible.js';
import css from './collapsible-trigger.css?inline';

/** What counts as a control the user can already reach and operate on its own. */
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [tabindex], ge-button, ge-toggle';

/**
 * Opens and closes the enclosing `ge-collapsible` when clicked.
 *
 * With plain content (a label and a chevron) it is the button itself: focusable, with `aria-expanded`, toggled by
 * Enter and Space. When the content already holds a control (a `ge-button`, a link) it stays out of the way, so
 * there is one tab stop and no button nested in a button; a click on that control still toggles.
 *
 * @slot - The content, or a control of your own.
 * @csspart base - The wrapper that carries the button role.
 */
export class GeCollapsibleTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        ownsControl: { state: true },
    };

    declare ownsControl: boolean;
    private collapsible?: CollapsibleHost;

    constructor() {
        super();
        this.ownsControl = true;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.collapsible = findParent<CollapsibleHost, GeCollapsibleTrigger>(this, COLLAPSIBLE_REGISTER);
        this.collapsible?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.collapsible?.unregister(this);
        this.collapsible = undefined;
    }

    protected override render() {
        const open = this.collapsible?.open ?? false;
        const owns = this.ownsControl;
        return html`<span
            part="base"
            class=${owns ? 'owns' : nothing}
            data-slot="collapsible-trigger"
            data-state=${open ? 'open' : 'closed'}
            role=${owns ? 'button' : nothing}
            tabindex=${owns ? '0' : nothing}
            aria-expanded=${owns ? String(open) : nothing}
            aria-disabled=${owns && this.collapsible?.disabled ? 'true' : nothing}
            @click=${this.toggle}
            @keydown=${this.onKeydown}
            ><slot @slotchange=${this.onSlotChange}></slot
        ></span>`;
    }

    private readonly toggle = () => this.collapsible?.toggle();

    private readonly onKeydown = (event: KeyboardEvent) => {
        // Only when this wrapper is the button: a projected control turns Enter and Space into its own click.
        if (!this.ownsControl || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        this.collapsible?.toggle();
    };

    private readonly onSlotChange = (event: Event) => {
        const slot = event.target as HTMLSlotElement;
        this.ownsControl = !slot.assignedElements({ flatten: true }).some((el) => el.matches(INTERACTIVE) || el.querySelector(INTERACTIVE));
    };
}
