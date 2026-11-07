import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { SPEED_DIAL_REGISTER, type SpeedDialHost, type SpeedDialPart } from '../speed-dial.js';
import css from './speed-dial-mask.css?inline';

/**
 * A dimmed, blurred scrim behind an open speed dial. It exists only while the dial is open, and it is the
 * keyboard-reachable way to close it: focusable, `role="button"`, named "Close". It sits below the menu, so it only
 * catches clicks outside the items.
 *
 * @csspart base - The scrim.
 */
export class GeSpeedDialMask extends UiElement implements SpeedDialPart {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    private dial?: SpeedDialHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dial = findParent<SpeedDialHost, GeSpeedDialMask>(this, SPEED_DIAL_REGISTER);
        this.dial?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dial?.unregister(this);
        this.dial = undefined;
    }

    private readonly close = () => this.dial?.hide();

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        this.close();
    };

    protected override render() {
        if (!this.dial?.open) return nothing;
        return html`<div
            part="base"
            class="mask"
            tabindex="0"
            role="button"
            aria-label="Close"
            data-slot="speed-dial-mask"
            @click=${this.close}
            @keydown=${this.onKeydown}
        ></div>`;
    }
}
