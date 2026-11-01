import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { TOGGLE_GROUP_REGISTER, type ToggleGroupHost } from '../toggle-group.js';
import css from './toggle-group-item.css?inline';

/**
 * One button in a `ge-toggle-group`. The group decides whether it is on, and its variant and size.
 *
 * @slot - The content, usually text or an icon.
 * @attr {string} value - What the group's value holds while this item is on. Required.
 * @attr {boolean} disabled - Blocks this item and dims it.
 * @attr {string} aria-label - Accessible name, for an icon-only item; forwarded to the inner button.
 * @csspart base - The inner `<button>`.
 * @cssprop --density-button - Height and padding multiplier; falls back to `--density`.
 */
export class GeToggleGroupItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        value: { reflect: true },
        disabled: { type: Boolean, reflect: true },
        ariaLabel: { attribute: 'aria-label' },
    };

    declare value: string;
    declare disabled: boolean;
    declare ariaLabel: string | null;
    /** Set by the group: whether the join after this item is drawn darker. */
    divider = false;

    private group?: ToggleGroupHost;

    constructor() {
        super();
        this.value = '';
        this.disabled = false;
        this.ariaLabel = null;
    }

    get on(): boolean {
        return this.group?.isSelected(this.value) ?? false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.group = findParent<ToggleGroupHost, GeToggleGroupItem>(this, TOGGLE_GROUP_REGISTER);
        this.group?.register(this);
        this.requestUpdate();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.group?.unregister(this);
        this.group = undefined;
    }

    protected override render() {
        const on = this.on;
        return html`<button
            part="base"
            type="button"
            data-slot="toggle-group-item"
            data-variant=${this.group?.variant ?? 'default'}
            data-size=${this.group?.size ?? 'default'}
            data-state=${on ? 'on' : 'off'}
            ?data-divider=${this.divider}
            aria-pressed=${String(on)}
            aria-label=${this.ariaLabel ?? nothing}
            ?disabled=${this.disabled || (this.group?.isDisabled ?? false)}
            @click=${this.onClick}
        >
            <slot></slot>
        </button>`;
    }

    private readonly onClick = () => {
        this.group?.toggle(this.value);
    };
}
