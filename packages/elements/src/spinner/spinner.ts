import { html, nothing, svg, unsafeCSS, type TemplateResult } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './spinner.css?inline';

export type SpinnerSize = 'xs' | 'sm' | 'default' | 'lg' | 'xl' | 'page';
export type SpinnerVariant = 'ring' | 'dots' | 'bars' | 'pulse';

const BARS = [0, 1, 2, 3, 4];
const DOTS = [0, 1, 2];

/**
 * A loading indicator.
 *
 * @slot - A custom loader. When anything is slotted, it replaces the built-in spinner.
 * @attr {'ring' | 'dots' | 'bars' | 'pulse'} variant - Animation style.
 * @attr {'xs' | 'sm' | 'default' | 'lg' | 'xl' | 'page'} size - Size preset.
 * @attr {number} custom-size - Ring only: exact width and height in px, overriding `size`.
 * @attr {string} label - Accessible name announced for the status. Defaults to "Loading".
 */
export class GeSpinner extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        variant: { reflect: true },
        size: { reflect: true },
        customSize: { attribute: 'custom-size', type: Number },
        label: {},
    };

    declare variant: SpinnerVariant;
    declare size: SpinnerSize;
    declare customSize: number | null;
    declare label: string;

    constructor() {
        super();
        this.variant = 'ring';
        this.size = 'default';
        this.customSize = null;
        this.label = 'Loading';
    }

    // The built-in spinner is the slot's fallback content, so projecting anything replaces it
    // without any content-detection code.
    protected override render() {
        return html`<slot>${this.builtIn()}</slot>`;
    }

    private builtIn(): TemplateResult {
        switch (this.variant) {
            case 'dots':
                return html`<output class="dots" part="base" aria-label=${this.label}>${DOTS.map(() => html`<div class="dot"></div>`)}</output>`;
            case 'bars':
                return html`<output class="bars" part="base" aria-label=${this.label}>${BARS.map(() => html`<div class="bar"></div>`)}</output>`;
            case 'pulse':
                return html`<output class="pulse" part="base" aria-label=${this.label}></output>`;
            default:
                return this.ring();
        }
    }

    private ring(): TemplateResult {
        const px = this.customSize ? `width: ${this.customSize}px; height: ${this.customSize}px;` : nothing;
        return html`<output class="ring" part="base" aria-label=${this.label}>
            ${svg`<svg style=${px} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>`}
        </output>`;
    }
}
