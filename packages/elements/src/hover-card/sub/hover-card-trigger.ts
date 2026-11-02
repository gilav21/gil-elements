import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { isTouchDevice } from '../../shared/touch.js';
import { HOVER_CARD_REGISTER, type HoverCardHost } from '../hover-card.js';
import css from './hover-card-trigger.css?inline';

/**
 * What the card previews. The wrapper is itself a tab stop, so keyboard users reach the card too.
 *
 * On a touch screen a tap (or Enter or Space) toggles the card and cancels the content's own default action, so do
 * not wrap a link or submit button that must still work there.
 *
 * @slot - The content to hover.
 * @csspart base - The focusable wrapper.
 */
export class GeHoverCardTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    private card?: HoverCardHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.card = findParent<HoverCardHost, GeHoverCardTrigger>(this, HOVER_CARD_REGISTER);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.card = undefined;
    }

    protected override render() {
        return html`<span
            part="base"
            tabindex="0"
            data-slot="hover-card-trigger"
            @mouseenter=${this.onEnter}
            @mouseleave=${this.onLeave}
            @focus=${this.onEnter}
            @blur=${this.onLeave}
            @click=${this.onPress}
            @keydown=${this.onKeydown}
            ><slot></slot
        ></span>`;
    }

    // Touch devices fire emulated mouse events after a tap; the tap path owns those.
    private readonly onEnter = () => {
        if (!isTouchDevice()) this.card?.show();
    };

    private readonly onLeave = () => {
        if (!isTouchDevice()) this.card?.hide();
    };

    private readonly onPress = (event: Event) => {
        if (!isTouchDevice()) return;
        event.preventDefault();
        this.card?.toggle();
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') this.onPress(event);
    };
}
