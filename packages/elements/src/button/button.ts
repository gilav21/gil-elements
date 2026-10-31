import { html, nothing, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './button.css?inline';

export type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
export type ButtonSize = 'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg';
export type ButtonType = 'button' | 'submit' | 'reset';

/**
 * A button.
 *
 * It is a form-associated element: `type="submit"` submits the form it sits in and
 * `type="reset"` resets it, exactly like a native button, even though the real `<button>` lives
 * inside the shadow root where a form cannot see it.
 *
 * @slot - The label. Shown instead of the `label` attribute when present.
 * @attr {'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'} variant - Colour treatment.
 * @attr {'default' | 'sm' | 'lg' | 'icon' | 'icon-sm' | 'icon-lg'} size - Height, padding and corner radius; the `icon` sizes are square.
 * @attr {'button' | 'submit' | 'reset'} type - What a click does inside a form. Defaults to `button`.
 * @attr {boolean} disabled - Blocks interaction and dims the button.
 * @attr {boolean} loading - Disables the button and shows a spinner.
 * @attr {boolean} skeleton - Show a placeholder instead of the button.
 * @attr {boolean} ripple - Show a ripple from the pointer on click.
 * @attr {string} ripple-color - CSS colour of the ripple. Defaults to a tint of the text colour.
 * @attr {string} label - Plain text label for the simple case.
 * @attr {string} aria-label - Accessible name; forwarded to the inner button.
 * @attr {string} aria-expanded - Forwarded to the inner button.
 * @attr {string} aria-pressed - Forwarded to the inner button.
 * @attr {string} aria-haspopup - Forwarded to the inner button.
 * @csspart base - The inner `<button>` element.
 * @cssprop --density-button - Height and padding multiplier for this component; falls back to `--density`.
 */
export class GeButton extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    // Focus enters the host's inner button, so Tab, `focus()` and a click on a label all work.
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static formAssociated = true;
    static override properties = {
        variant: { reflect: true },
        size: { reflect: true },
        type: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        loading: { type: Boolean, reflect: true },
        skeleton: { type: Boolean, reflect: true },
        ripple: { type: Boolean, reflect: true },
        rippleColor: { attribute: 'ripple-color' },
        label: {},
        ariaLabel: { attribute: 'aria-label' },
        ariaExpanded: { attribute: 'aria-expanded' },
        ariaPressed: { attribute: 'aria-pressed' },
        ariaHasPopup: { attribute: 'aria-haspopup' },
        fieldsetDisabled: { state: true },
    };

    declare variant: ButtonVariant;
    declare size: ButtonSize;
    declare type: ButtonType;
    declare disabled: boolean;
    declare loading: boolean;
    declare skeleton: boolean;
    declare ripple: boolean;
    declare rippleColor: string;
    declare label: string;
    declare ariaLabel: string | null;
    declare ariaExpanded: string | null;
    declare ariaPressed: string | null;
    declare ariaHasPopup: string | null;
    declare fieldsetDisabled: boolean;

    private readonly internals?: ElementInternals;

    constructor() {
        super();
        this.variant = 'default';
        this.size = 'default';
        this.type = 'button';
        this.disabled = false;
        this.loading = false;
        this.skeleton = false;
        this.ripple = false;
        this.rippleColor = 'color-mix(in srgb, currentColor 35%, transparent)';
        this.label = '';
        this.ariaLabel = null;
        this.ariaExpanded = null;
        this.ariaPressed = null;
        this.ariaHasPopup = null;
        this.fieldsetDisabled = false;
        // Not available while server rendering.
        this.internals = this.attachInternals?.();
        this.addEventListener('click', this.onClick);
    }

    /** True when a click should do nothing: disabled directly, by an ancestor fieldset, or busy. */
    get isDisabled(): boolean {
        return this.disabled || this.fieldsetDisabled || this.loading;
    }

    /** Called by the browser when a `<fieldset disabled>` ancestor starts or stops covering this control. */
    formDisabledCallback(disabled: boolean): void {
        this.fieldsetDisabled = disabled;
    }

    protected override render() {
        if (this.skeleton) return html`<span class="skeleton" part="skeleton" aria-hidden="true"></span>`;
        return html`<button
            part="base"
            data-slot="button"
            type="button"
            ?disabled=${this.isDisabled}
            aria-label=${this.ariaLabel ?? nothing}
            aria-expanded=${this.ariaExpanded ?? nothing}
            aria-pressed=${this.ariaPressed ?? nothing}
            aria-haspopup=${this.ariaHasPopup ?? nothing}
            @click=${this.onRipple}
        >
            ${this.loading
                ? html`<div class="spinner" aria-hidden="true">${svg`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>`}</div>`
                : nothing}
            <slot>${this.label}</slot>
        </button>`;
    }

    // The native button inside the shadow root is not associated with the page's form, so the
    // host forwards what a native button would do. A listener that cancels the click in the capture
    // phase (or earlier) still stops it, as with a native button.
    private readonly onClick = (event: Event) => {
        if (this.isDisabled || event.defaultPrevented) return;
        const form = this.internals?.form;
        if (!form) return;
        // Called through the prototype: a control named "reset" or "submit" in the form shadows the method on the form itself.
        if (this.type === 'submit') HTMLFormElement.prototype.requestSubmit.call(form);
        else if (this.type === 'reset') HTMLFormElement.prototype.reset.call(form);
    };

    private readonly onRipple = (event: MouseEvent) => {
        if (!this.ripple || globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
        const host = event.currentTarget as HTMLElement;
        const rect = host.getBoundingClientRect();
        const diameter = Math.max(rect.width, rect.height) * 2;
        const wave = document.createElement('span');
        Object.assign(wave.style, {
            position: 'absolute',
            width: `${diameter}px`,
            height: `${diameter}px`,
            left: `${event.clientX - rect.left - diameter / 2}px`,
            top: `${event.clientY - rect.top - diameter / 2}px`,
            borderRadius: '50%',
            pointerEvents: 'none',
            backgroundColor: this.rippleColor,
        });
        host.append(wave);
        const animation = wave.animate(
            [
                { transform: 'scale(0)', opacity: '1' },
                { transform: 'scale(1)', opacity: '0' },
            ],
            { duration: 600, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'forwards' },
        );
        animation.onfinish = () => wave.remove();
    };
}
