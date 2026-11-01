import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './toggle.css?inline';

export type ToggleVariant = 'default' | 'outline';
export type ToggleSize = 'default' | 'sm' | 'lg';

/**
 * A two-state button that stays pressed until pressed again.
 *
 * @slot - The content, usually text or an icon.
 * @attr {boolean} pressed - Pressed state. Toggled by the user, and reflected so CSS can match it; set it in markup for an initially pressed toggle.
 * @attr {'default' | 'outline'} variant - Plain, or with a border and shadow.
 * @attr {'default' | 'sm' | 'lg'} size - Height, padding and minimum width.
 * @attr {boolean} disabled - Blocks interaction and dims the toggle.
 * @attr {string} aria-label - Accessible name, for an icon-only toggle; forwarded to the inner button.
 * @fires pressed-change - After the user toggles it; `detail` is the new pressed state.
 * @csspart base - The inner `<button>` element.
 * @cssprop --density-button - Height and padding multiplier; falls back to `--density`.
 */
export class GeToggle extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        pressed: { type: Boolean, reflect: true },
        variant: { reflect: true },
        size: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        ariaLabel: { attribute: 'aria-label' },
    };

    declare pressed: boolean;
    declare variant: ToggleVariant;
    declare size: ToggleSize;
    declare disabled: boolean;
    declare ariaLabel: string | null;

    constructor() {
        super();
        this.pressed = false;
        this.variant = 'default';
        this.size = 'default';
        this.disabled = false;
        this.ariaLabel = null;
    }

    protected override render() {
        return html`<button
            part="base"
            type="button"
            data-slot="toggle"
            data-state=${this.pressed ? 'on' : 'off'}
            aria-pressed=${String(this.pressed)}
            aria-label=${this.ariaLabel ?? nothing}
            ?disabled=${this.disabled}
            @click=${this.onClick}
        >
            <slot></slot>
        </button>`;
    }

    private readonly onClick = () => {
        this.pressed = !this.pressed;
        this.dispatchEvent(new CustomEvent('pressed-change', { detail: this.pressed, bubbles: true, composed: true }));
    };
}
