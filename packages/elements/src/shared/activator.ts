import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from './compound.js';
import css from './activator.css?inline';

/** What counts as a control the user can already reach and operate on its own. */
export const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [tabindex], ge-button, ge-toggle';

/**
 * The wrapper around whatever opens (or closes) an overlay. Plain content becomes a button; a control of your own
 * (a `ge-button`) is left as the one tab stop. A subclass names the parent's registration event and what activating does.
 *
 * @slot - The content, or a control of your own.
 * @csspart base - The wrapper.
 */
export abstract class GeActivator<Host> extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        ownsControl: { state: true },
    };

    declare ownsControl: boolean;
    protected parent?: Host;

    protected abstract readonly registerEvent: string;
    protected abstract readonly slotName: string;
    protected abstract activate(): void;
    /** An accessible name for the wrapper while it is the button; a projected control carries its own. */
    protected accessibleName(): string | undefined {
        return undefined;
    }
    /** Mirrored as `data-state` on the wrapper, for a subclass that styles on it. */
    protected stateName(): string | undefined {
        return undefined;
    }

    constructor() {
        super();
        this.ownsControl = true;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.parent = findParent<Host, GeActivator<Host>>(this, this.registerEvent);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.parent = undefined;
    }

    protected override render() {
        const owns = this.ownsControl;
        return html`<span
            part="base"
            data-slot=${this.slotName}
            role=${owns ? 'button' : nothing}
            tabindex=${owns ? '0' : nothing}
            aria-label=${(owns && this.accessibleName()) || nothing}
            data-state=${this.stateName() ?? nothing}
            @click=${this.onClick}
            @keydown=${this.onKeydown}
            ><slot @slotchange=${this.onSlotChange}></slot
        ></span>`;
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        // Only when this wrapper is the button: a projected control turns Enter and Space into its own click.
        if (!this.ownsControl || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        this.activate();
    };

    private readonly onClick = () => this.activate();

    private readonly onSlotChange = (event: Event) => {
        const slot = event.target as HTMLSlotElement;
        this.ownsControl = !slot.assignedElements({ flatten: true }).some((el) => el.matches(INTERACTIVE) || el.querySelector(INTERACTIVE));
    };
}
