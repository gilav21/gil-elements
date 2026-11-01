import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { deepActive, focusFirst, trapTab } from '../../shared/overlay.js';
import { DIALOG_REGISTER, type DialogHost } from '../dialog.js';
import css from './dialog-content.css?inline';

/**
 * The dialog box. It draws nothing until the dialog is open.
 *
 * Simple mode: set `heading` (and optionally `description`) and the header is generated. Custom mode: slot a
 * `ge-dialog-header` and `ge-dialog-footer` yourself. Anything else you slot is shown in both.
 *
 * `heading` is not called `title` because `title` is a native attribute: the browser would show its text as a
 * tooltip over the whole box.
 *
 * Focus moves into the box when it opens, stays inside while it is open, and returns to where it was on close.
 *
 * @slot - The body: header, text, forms, footer.
 * @attr {string} heading - Simple-mode title.
 * @attr {string} description - Simple-mode text under the title; only shown when `heading` is set.
 * @attr {string} close-label - Accessible name of the overlay and of the close button. Defaults to "Close".
 * @csspart panel - The box.
 * @cssprop --density-dialog - Spacing multiplier for this component; falls back to `--density`.
 */
export class GeDialogContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        heading: {},
        description: {},
        closeLabel: { attribute: 'close-label' },
        slottedTitle: { state: true },
    };

    declare heading: string;
    declare description: string;
    declare closeLabel: string;
    declare slottedTitle: string;
    private dialog?: DialogHost;
    private returnTo?: HTMLElement;
    private wasOpen = false;

    constructor() {
        super();
        this.heading = '';
        this.description = '';
        this.closeLabel = 'Close';
        this.slottedTitle = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dialog = findParent<DialogHost, GeDialogContent>(this, DIALOG_REGISTER);
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
        if (open) this.enter();
        else this.leave();
    }

    private enter(): void {
        const previous = deepActive();
        this.returnTo = previous instanceof HTMLElement ? previous : undefined;
        const panel = this.shadowRoot?.querySelector<HTMLElement>('.panel');
        if (panel) focusFirst(panel, panel);
    }

    private leave(): void {
        this.returnTo?.focus();
        this.returnTo = undefined;
    }

    protected override render() {
        if (!this.dialog?.open) return nothing;
        const label = this.heading || this.slottedTitle;
        return html`<div class="root" data-slot="dialog">
            <button type="button" class="overlay" tabindex="-1" data-slot="dialog-overlay" aria-label=${this.closeLabel} @click=${this.close}></button>
            <div
                class="panel"
                part="panel"
                role="dialog"
                aria-modal="true"
                aria-label=${label || nothing}
                data-slot="dialog-content"
                tabindex="-1"
                @keydown=${this.onKeydown}
            >
                ${this.heading ? this.generatedHeader() : nothing}
                <slot @slotchange=${this.onSlotChange}></slot>
                <button type="button" class="close" aria-label=${this.closeLabel} @click=${this.close}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    <span class="sr-only">${this.closeLabel}</span>
                </button>
            </div>
        </div>`;
    }

    private generatedHeader() {
        return html`<ge-dialog-header>
            <ge-dialog-title>${this.heading}</ge-dialog-title>
            ${this.description ? html`<ge-dialog-description>${this.description}</ge-dialog-description>` : nothing}
        </ge-dialog-header>`;
    }

    private readonly close = () => this.dialog?.hide();

    private readonly onKeydown = (event: KeyboardEvent) => {
        const panel = event.currentTarget as HTMLElement;
        trapTab(event, panel, panel);
    };

    private readonly onSlotChange = () => {
        this.slottedTitle = this.querySelector('ge-dialog-title')?.textContent?.trim() ?? '';
    };
}
