import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { DIALOG_REGISTER, type DialogHost } from '../../dialog/dialog.js';
import css from './alert-dialog-action.css?inline';

/**
 * The action choice. It closes the enclosing `ge-alert-dialog`; do your own work in a click listener on it.
 *
 * @slot - The label.
 * @csspart base - The `<button>`.
 */
export class GeAlertDialogAction extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };

    private dialog?: DialogHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dialog = findParent<DialogHost, GeAlertDialogAction>(this, DIALOG_REGISTER);
        this.dialog?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dialog?.unregister(this);
        this.dialog = undefined;
    }

    protected override render() {
        return html`<button part="base" type="button" data-slot="alert-dialog-action" @click=${this.close}><slot></slot></button>`;
    }

    private readonly close = () => this.dialog?.hide();
}
