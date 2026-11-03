import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './banner.css?inline';

export type BannerVariant = 'info' | 'warning' | 'success' | 'destructive';

/**
 * A persistent, page-level announcement bar: the slot `ge-alert` (inline, within content) and a toast
 * (transient) do not fill.
 *
 * Simple mode: set `message`. Custom mode: project your own content (a link, a button) and it replaces the
 * message entirely.
 *
 * Every variant but `destructive` announces politely as a status; `destructive` is an assertive alert that
 * interrupts a screen reader, so reserve it for real failures. A dismissed banner keeps its place in the page
 * but stops being a live region.
 *
 * @slot - Replaces `message`.
 * @fires dismissed - Once, when the user closes a `dismissible` banner.
 * @attr {'info' | 'warning' | 'success' | 'destructive'} variant - Colour treatment and announcement urgency.
 * @attr {string} message - Plain-text announcement; ignored when content is projected.
 * @attr {boolean} dismissible - Shows a close button that hides the banner.
 * @attr {string} close-label - Accessible name of the close button. Defaults to "Close".
 */
export class GeBanner extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        variant: { reflect: true },
        message: {},
        dismissible: { type: Boolean, reflect: true },
        closeLabel: { attribute: 'close-label' },
        dismissedState: { state: true },
    };

    declare variant: BannerVariant;
    declare message: string;
    declare dismissible: boolean;
    declare closeLabel: string;
    declare dismissedState: boolean;

    constructor() {
        super();
        this.variant = 'info';
        this.message = '';
        this.dismissible = false;
        this.closeLabel = 'Close';
        this.dismissedState = false;
    }

    /** `false` once the banner has been dismissed. */
    get visible(): boolean {
        return !this.dismissedState;
    }

    /** Hides the banner and fires `dismissed`. Does nothing the second time. */
    dismiss(): void {
        if (this.dismissedState) return;
        this.dismissedState = true;
        this.dispatchEvent(new CustomEvent('dismissed', { bubbles: true, composed: true }));
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'banner';
    }

    protected override updated(): void {
        // The host keeps its box in the layout until it is hidden; `hidden` removes it.
        this.toggleAttribute('hidden', this.dismissedState);
    }

    // The live-region role lives on an inner node, as in `ge-alert`: a host cannot set its own attributes
    // safely during construction or server rendering.
    protected override render() {
        if (this.dismissedState) return nothing;
        const destructive = this.variant === 'destructive';
        return html`<div class="row" role=${destructive ? 'alert' : 'status'} aria-live=${destructive ? 'assertive' : 'polite'}>
            <div class="message" part="message"><slot>${this.message}</slot></div>
            ${this.dismissible
                ? html`<ge-button class="dismiss" part="dismiss" variant="ghost" size="icon-sm" aria-label=${this.closeLabel} @click=${this.dismiss}>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                  </ge-button>`
                : nothing}
        </div>`;
    }
}
