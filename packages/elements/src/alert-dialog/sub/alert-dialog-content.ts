import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { ModalFocus } from '../../shared/overlay.js';
import { DIALOG_REGISTER, type DialogHost } from '../../dialog/dialog.js';
import css from './alert-dialog-content.css?inline';

/**
 * The alert box. It draws nothing until the dialog is open, has no close button, and the overlay does not dismiss it.
 *
 * Simple mode: set `heading` (and optionally `description`) and the header and a Cancel / Continue footer are
 * generated. Custom mode: slot a `ge-alert-dialog-header` and `ge-alert-dialog-footer` yourself.
 *
 * `heading` is not called `title` because `title` is a native attribute: the browser would show its text as a
 * tooltip over the whole box.
 *
 * @slot - The body: header, text, footer.
 * @attr {string} heading - Simple-mode title.
 * @attr {string} description - Simple-mode text under the title; only shown when `heading` is set.
 * @attr {string} action-text - Simple-mode label of the confirm button. Defaults to "Continue".
 * @attr {string} cancel-text - Simple-mode label of the cancel button. Defaults to "Cancel".
 * @fires action-click - The generated confirm button was clicked (the dialog closes too).
 * @fires cancel-click - The generated cancel button was clicked (the dialog closes too).
 * @csspart panel - The box.
 */
export class GeAlertDialogContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        heading: {},
        description: {},
        actionText: { attribute: 'action-text' },
        cancelText: { attribute: 'cancel-text' },
        slottedTitle: { state: true },
    };

    declare heading: string;
    declare description: string;
    declare actionText: string;
    declare cancelText: string;
    declare slottedTitle: string;
    private dialog?: DialogHost;
    private readonly modal = new ModalFocus();
    private wasOpen = false;

    constructor() {
        super();
        this.heading = '';
        this.description = '';
        this.actionText = 'Continue';
        this.cancelText = 'Cancel';
        this.slottedTitle = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dialog = findParent<DialogHost, GeAlertDialogContent>(this, DIALOG_REGISTER);
        this.dialog?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dialog?.unregister(this);
        this.dialog = undefined;
    }

    protected override updated(): void {
        const open = this.dialog?.open ?? false;
        if (open === this.wasOpen) return;
        this.wasOpen = open;
        const panel = this.shadowRoot?.querySelector<HTMLElement>('.panel');
        if (open && panel) this.modal.enter(panel);
        else if (!open) this.modal.leave();
    }

    protected override render() {
        if (!this.dialog?.open) return nothing;
        const label = this.heading || this.slottedTitle;
        return html`<div class="root" data-slot="alert-dialog" @keydown=${this.modal.trap}>
            <div class="overlay" data-slot="alert-dialog-overlay"></div>
            <div
                class="panel"
                part="panel"
                role="alertdialog"
                aria-modal="true"
                aria-label=${label || nothing}
                data-slot="alert-dialog-content"
                tabindex="-1"
            >
                ${this.heading ? this.generatedHeader() : nothing}
                <slot @slotchange=${this.onSlotChange}></slot>
                ${this.heading ? this.generatedFooter() : nothing}
            </div>
        </div>`;
    }

    private generatedHeader() {
        return html`<ge-alert-dialog-header>
            <ge-alert-dialog-title>${this.heading}</ge-alert-dialog-title>
            ${this.description ? html`<ge-alert-dialog-description>${this.description}</ge-alert-dialog-description>` : nothing}
        </ge-alert-dialog-header>`;
    }

    private generatedFooter() {
        return html`<ge-alert-dialog-footer>
            <ge-alert-dialog-cancel @click=${this.onCancel}>${this.cancelText}</ge-alert-dialog-cancel>
            <ge-alert-dialog-action @click=${this.onAction}>${this.actionText}</ge-alert-dialog-action>
        </ge-alert-dialog-footer>`;
    }

    private readonly onCancel = () => this.dispatchEvent(new CustomEvent('cancel-click', { bubbles: true, composed: true }));

    private readonly onAction = () => this.dispatchEvent(new CustomEvent('action-click', { bubbles: true, composed: true }));

    private readonly onSlotChange = () => {
        this.slottedTitle = this.querySelector('ge-alert-dialog-title')?.textContent?.trim() ?? '';
    };
}
