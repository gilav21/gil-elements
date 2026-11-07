import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { resolveIdRefs } from '../../shared/aria-refs.js';
import { SELECT_REGISTER, type SelectHost } from '../select.js';
import css from './select-trigger.css?inline';

/**
 * The button that shows the current value and opens the panel (`role="combobox"`). Enter, Space and the Down
 * arrow open it (Up too when the select is built from `options`); a click toggles it.
 *
 * Put a `ge-select-value` inside it. The width is the host's: set `width` on this element.
 *
 * @slot - Usually a `ge-select-value`.
 * @attr {boolean} loading - Shows a spinner in place of the chevron and disables the button. Needs `ge-spinner`.
 * @attr {boolean} skeleton - Shows a placeholder block in place of the button. Needs `ge-skeleton`.
 * @attr {string} aria-label - Accessible name. Defaults to the select's `aria-label`, then its placeholder.
 * @attr {boolean} fill - Take the width of the select instead of the width of the content.
 */
export class GeSelectTrigger extends UiElement {
    static override readonly shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        loading: { type: Boolean, reflect: true },
        skeleton: { type: Boolean, reflect: true },
        fill: { type: Boolean, reflect: true },
    };

    declare loading: boolean;
    declare skeleton: boolean;
    declare fill: boolean;
    private select?: SelectHost;

    constructor() {
        super();
        this.loading = false;
        this.skeleton = false;
        this.fill = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'select-trigger';
        this.select = findParent<SelectHost, GeSelectTrigger>(this, SELECT_REGISTER);
        this.select?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.select?.unregister(this);
        this.select = undefined;
    }

    private readonly onClick = () => {
        this.select?.toggle();
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        const opens = event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown' || (event.key === 'ArrowUp' && this.select?.dataDriven);
        if (!opens) return;
        // Not a click: it would close a panel the key just opened.
        event.preventDefault();
        this.select?.show();
    };

    // Firefox clicks a button on the keyup of Space whatever keydown did.
    private readonly onKeyup = (event: KeyboardEvent) => {
        if (event.key === ' ') event.preventDefault();
    };

    private get label(): string {
        return this.getAttribute('aria-label') ?? this.select?.host.getAttribute('aria-label') ?? this.select?.resolvedPlaceholder ?? 'Select';
    }

    protected override updated(): void {
        const button = this.renderRoot.querySelector<HTMLButtonElement>('button');
        if (!button || !this.select) return;
        const host = this.select.host;
        button.ariaLabelledByElements = host ? resolveIdRefs(host, host.getAttribute('aria-labelledby')) : null;
        // Element references, not ids: the panel is in another tree than the button's shadow root.
        const content = this.select.content;
        button.ariaControlsElements = content ? [content] : null;
    }

    protected override render() {
        if (this.skeleton) return html`<ge-skeleton></ge-skeleton>`;
        const open = this.select?.open ?? false;
        const labelledBy = !!this.select?.host.getAttribute('aria-labelledby');
        return html`<button
            type="button"
            part="base"
            class="base"
            role="combobox"
            aria-expanded=${open}
            aria-label=${labelledBy ? nothing : this.label}
            data-state=${open ? 'open' : 'closed'}
            ?disabled=${this.select?.isDisabled || this.loading}
            @click=${this.onClick}
            @keydown=${this.onKeydown}
            @keyup=${this.onKeyup}
        >
            <slot></slot>
            ${this.loading
                ? html`<ge-spinner size="xs" custom-size="16"></ge-spinner>`
                : html`<svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>`}
        </button>`;
    }
}
