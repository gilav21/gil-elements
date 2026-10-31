import { html, nothing, svg, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './checkbox.css?inline';

const CHECK = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`;
const DASH = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 12h14" /></svg>`;

/**
 * A checkbox.
 *
 * The host itself is the control (`role="checkbox"`, focusable, toggled by click and Space), not a
 * native `<input>` hidden in the shadow root. That is what lets a `ge-label`, `aria-label`,
 * `aria-describedby` and `id` on the host work with no forwarding: ID references stop at a shadow
 * boundary, but the host lives in the same tree as the label.
 *
 * @attr {boolean} checked - Checked state. Toggled by the user, and reflected so CSS can match it.
 * @attr {boolean} indeterminate - Show the dash. Purely visual: it does not change `checked`, and toggling does not clear it.
 * @attr {boolean} disabled - Blocks interaction and dims the box.
 * @attr {boolean} skeleton - Show a placeholder instead of the checkbox.
 * @attr {string} label - Plain text label beside the box, for the simple case. Clicking it toggles.
 * @fires change - After the user toggles the checkbox.
 * @fires input - Alongside `change`, as a native checkbox does.
 * @csspart box - The square.
 * @csspart label - The label text.
 * @cssprop --density-checkbox - Size multiplier for this component; falls back to `--density`.
 */
export class GeCheckbox extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static formAssociated = true;
    static override properties = {
        checked: { type: Boolean, reflect: true },
        indeterminate: { type: Boolean, reflect: true },
        disabled: { type: Boolean, reflect: true },
        skeleton: { type: Boolean, reflect: true },
        label: { reflect: true },
        fieldsetDisabled: { state: true },
    };

    declare checked: boolean;
    declare indeterminate: boolean;
    declare disabled: boolean;
    declare skeleton: boolean;
    declare label: string | null;
    declare fieldsetDisabled: boolean;

    private readonly internals?: ElementInternals;

    constructor() {
        super();
        this.checked = false;
        this.indeterminate = false;
        this.disabled = false;
        this.skeleton = false;
        this.label = null;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
        this.addEventListener('click', this.onClick);
        this.addEventListener('keydown', this.onKeyDown);
        this.addEventListener('keyup', this.onKeyUp);
    }

    /** True when interaction should do nothing: disabled directly or by an ancestor fieldset. */
    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled;
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        // A form-associated element that is disabled, directly or by a fieldset, is not focusable and gets no
        // clicks from the browser itself, so the tab stop needs no disabled handling here.
        if (!this.hasAttribute('tabindex')) this.tabIndex = 0;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (!this.internals) return;
        if (changed.has('checked') || changed.has('indeterminate') || changed.has('skeleton')) {
            this.internals.role = this.skeleton ? null : 'checkbox';
            this.internals.ariaChecked = this.indeterminate ? 'mixed' : String(this.checked);
        }
        if (changed.has('disabled') || changed.has('fieldsetDisabled')) {
            this.internals.ariaDisabled = this.isDisabled ? 'true' : null;
        }
    }

    protected override render() {
        if (this.skeleton) {
            return html`<span class="skeleton box-skeleton" part="skeleton" aria-hidden="true"></span>
                ${this.label ? html`<span class="skeleton label-skeleton" aria-hidden="true"></span>` : nothing}`;
        }
        const state = this.indeterminate ? 'indeterminate' : this.checked ? 'checked' : 'unchecked';
        return html`<span class="box" part="box" data-slot="checkbox" data-state=${state}
                >${this.indeterminate ? DASH : this.checked ? CHECK : nothing}</span
            >${this.label ? html`<span class="label" part="label">${this.label}</span>` : nothing}`;
    }

    private readonly onClick = (event: Event) => {
        if (this.isDisabled || this.skeleton || event.defaultPrevented) return;
        this.checked = !this.checked;
        this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        this.dispatchEvent(new Event('change', { bubbles: true }));
    };

    // A native checkbox toggles when Space is released, and Space must not scroll the page.
    private readonly onKeyDown = (event: KeyboardEvent) => {
        if (event.key === ' ') event.preventDefault();
    };

    private readonly onKeyUp = (event: KeyboardEvent) => {
        if (event.key === ' ') this.click();
    };
}
