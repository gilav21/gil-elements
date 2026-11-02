import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { isTouchDevice } from '../../shared/touch.js';
import { TOOLTIP_REGISTER, TOUCH_AUTO_DISMISS_MS, type TooltipHost } from '../tooltip.js';
import css from './tooltip-trigger.css?inline';

/**
 * What the tooltip describes. Hover opens it after the dwell time, keyboard focus opens it at once, and on a touch
 * screen a tap opens it for a couple of seconds or until the next touch elsewhere.
 *
 * @slot - The content the tooltip belongs to, usually a button.
 * @csspart base - The wrapper.
 */
export class GeTooltipTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    private tooltip?: TooltipHost;
    private delayTimer?: ReturnType<typeof setTimeout>;
    private dismissTimer?: ReturnType<typeof setTimeout>;
    private stopOutsideTouch?: () => void;

    override connectedCallback(): void {
        super.connectedCallback();
        this.tooltip = findParent<TooltipHost, GeTooltipTrigger>(this, TOOLTIP_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        clearTimeout(this.delayTimer);
        this.clearDismiss();
        this.tooltip = undefined;
    }

    protected override render() {
        return html`<span
            part="base"
            data-slot="tooltip-trigger"
            @mouseenter=${this.onMouseEnter}
            @mouseleave=${this.onMouseLeave}
            @touchstart=${this.onTouchStart}
            @focusin=${this.onFocus}
            @focusout=${this.onBlur}
            ><slot></slot
        ></span>`;
    }

    // Touch devices fire emulated mouse events after a tap, which would open and dismiss in the same gesture.
    private readonly onMouseEnter = () => {
        if (isTouchDevice()) return;
        clearTimeout(this.delayTimer);
        this.delayTimer = setTimeout(() => this.tooltip?.show(), this.tooltip?.delayDuration ?? 200);
    };

    private readonly onMouseLeave = () => {
        if (isTouchDevice()) return;
        clearTimeout(this.delayTimer);
        this.tooltip?.hide();
    };

    private readonly onFocus = () => this.tooltip?.show();
    private readonly onBlur = () => this.tooltip?.hide();

    private readonly onTouchStart = () => {
        if (!isTouchDevice()) return;
        if (this.tooltip?.open) {
            this.dismissTouch();
            return;
        }
        this.tooltip?.show();
        this.scheduleDismiss();
    };

    private scheduleDismiss(): void {
        this.clearDismiss();
        this.dismissTimer = setTimeout(() => this.dismissTouch(), TOUCH_AUTO_DISMISS_MS);
        const onTouch = (event: TouchEvent) => {
            if (!event.composedPath().includes(this)) this.dismissTouch();
        };
        document.addEventListener('touchstart', onTouch, true);
        this.stopOutsideTouch = () => document.removeEventListener('touchstart', onTouch, true);
    }

    private dismissTouch(): void {
        this.clearDismiss();
        this.tooltip?.hide();
    }

    private clearDismiss(): void {
        clearTimeout(this.dismissTimer);
        this.stopOutsideTouch?.();
        this.stopOutsideTouch = undefined;
    }
}
