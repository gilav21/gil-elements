import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { resolveCommonLocale, type CommonLocale } from '../shared/common-locales.js';
import css from './toast.css?inline';
import type { ToastVariant } from './toast-service.js';

/**
 * One toast. `ge-toaster` renders these from the `toast` service; use one on its own for a static message, and
 * remove it yourself when `closed` fires, since it never hides itself.
 *
 * `destructive` is announced assertively (`role="alert"`); the other variants are `status` and polite.
 *
 * @fires closed - The close button was clicked or Escape was pressed on the toast.
 * @fires action - The action button was clicked. It does not dismiss the toast.
 * @attr {'default' | 'destructive' | 'success' | 'info' | 'warning'} variant - Visual style, which also sets the announcement politeness.
 * @attr {string} heading - Bold first line. Omit it for a description-only toast.
 * @attr {string} description - Secondary line, plain text.
 * @attr {string} action-label - Label of the action button; without it no button is drawn.
 * @attr {boolean} show-countdown - Shows the remaining seconds beside the action label and a draining bar. Needs `duration`.
 * @attr {number} countdown-seconds - Seconds left; the toast service ticks it, this element only shows it.
 * @attr {number} duration - Total lifetime in ms; only the bar's denominator here, since the clock lives in the service.
 * @attr {boolean} loading - Draws a spinner before the heading.
 * @attr {string} locale - Locale id for the close button label; follows the page's `lang` when unset.
 */
export class GeToast extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        variant: { reflect: true },
        heading: {},
        description: {},
        actionLabel: { attribute: 'action-label' },
        showCountdown: { attribute: 'show-countdown', type: Boolean },
        countdownSeconds: { attribute: 'countdown-seconds', type: Number },
        duration: { type: Number },
        loading: { type: Boolean },
        locale: {},
    };
    declare variant: ToastVariant;
    declare heading: string;
    declare description: string;
    declare actionLabel: string;
    declare showCountdown: boolean;
    declare countdownSeconds: number | null;
    declare duration: number | null;
    declare loading: boolean;
    declare locale: string | CommonLocale | null;

    constructor() {
        super();
        this.variant = 'default';
        this.heading = '';
        this.description = '';
        this.actionLabel = '';
        this.showCountdown = false;
        this.countdownSeconds = null;
        this.duration = null;
        this.loading = false;
        this.locale = null;
        this.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') this.emitClosed();
        });
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'toast';
    }

    private get text(): CommonLocale {
        return resolveCommonLocale(this.locale);
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('variant') || changed.has('locale') || !this.hasAttribute('role')) {
            const destructive = this.variant === 'destructive';
            this.setAttribute('role', destructive ? 'alert' : 'status');
            this.setAttribute('aria-live', destructive ? 'assertive' : 'polite');
            this.dir = this.text.rtl ? 'rtl' : '';
        }
    }

    private emitClosed(): void {
        this.dispatchEvent(new CustomEvent('closed', { bubbles: true, composed: true }));
    }

    private get progressPercent(): number {
        if (!this.duration || this.countdownSeconds === null) return 0;
        return Math.max(0, (this.countdownSeconds / Math.ceil(this.duration / 1000)) * 100);
    }

    protected override render() {
        const countdown = this.showCountdown && this.countdownSeconds !== null;
        return html`${this.loading ? html`<div class="spinner" data-slot="toast-spinner" aria-hidden="true"></div>` : nothing}
            <div class="body">
                ${this.heading ? html`<div class="heading" data-slot="toast-title">${this.heading}</div>` : nothing}
                ${this.description ? html`<div class="description" data-slot="toast-description">${this.description}</div>` : nothing}
            </div>
            ${this.actionLabel
                ? html`<button class="action" type="button" @click=${() => this.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true }))}>${this.actionLabel}${countdown ? html`<span class="countdown">${`(${this.countdownSeconds}s)`}</span>` : nothing}</button>`
                : nothing}
            <button class="close" type="button" aria-label=${this.text.close} @click=${() => this.emitClosed()}>
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            ${this.showCountdown && this.duration
                ? html`<div class="progress" data-slot="toast-progress"><div style="width: ${this.progressPercent}%"></div></div>`
                : nothing}`;
    }
}
