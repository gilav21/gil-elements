import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { TOOLTIP_REGISTER, type TooltipHost } from '../tooltip.js';
import css from './tooltip-content.css?inline';

/**
 * The bubble. It draws nothing until the tooltip is open.
 *
 * @slot - The label.
 * @csspart bubble - The bubble.
 */
export class GeTooltipContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    private tooltip?: TooltipHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.tooltip = findParent<TooltipHost, GeTooltipContent>(this, TOOLTIP_REGISTER);
        this.tooltip?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.tooltip?.unregister(this);
        this.tooltip = undefined;
    }

    protected override render() {
        if (!this.tooltip?.open) return nothing;
        return html`<div class="bubble" part="bubble" role="tooltip" data-slot="tooltip-content" data-side=${this.tooltip.side}><slot></slot></div>`;
    }
}
