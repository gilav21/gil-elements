import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { DIALOG_REGISTER, type DialogHost } from '../dialog.js';
import css from './dialog-trigger.css?inline';

/** What counts as a control the user can already reach and operate on its own. */
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [tabindex], ge-button, ge-toggle';

/**
 * Opens and closes the enclosing `ge-dialog` when clicked. Plain content becomes a button; a control of your own
 * (a `ge-button`) is left as the one tab stop.
 *
 * @slot - The content, or a control of your own.
 * @csspart base - The wrapper.
 */
export class GeDialogTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        ownsControl: { state: true },
    };

    declare ownsControl: boolean;
    private dialog?: DialogHost;

    constructor() {
        super();
        this.ownsControl = true;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dialog = findParent<DialogHost, GeDialogTrigger>(this, DIALOG_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dialog = undefined;
    }

    protected override render() {
        const owns = this.ownsControl;
        return html`<span
            part="base"
            data-slot="dialog-trigger"
            role=${owns ? 'button' : nothing}
            tabindex=${owns ? '0' : nothing}
            @click=${this.toggle}
            @keydown=${this.onKeydown}
            ><slot @slotchange=${this.onSlotChange}></slot
        ></span>`;
    }

    private readonly toggle = () => this.dialog?.toggle();

    private readonly onKeydown = (event: KeyboardEvent) => {
        // Only when this wrapper is the button: a projected control turns Enter and Space into its own click.
        if (!this.ownsControl || (event.key !== 'Enter' && event.key !== ' ')) return;
        event.preventDefault();
        this.dialog?.toggle();
    };

    private readonly onSlotChange = (event: Event) => {
        const slot = event.target as HTMLSlotElement;
        this.ownsControl = !slot.assignedElements({ flatten: true }).some((el) => el.matches(INTERACTIVE) || el.querySelector(INTERACTIVE));
    };
}
