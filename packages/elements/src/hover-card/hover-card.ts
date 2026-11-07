import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import css from './hover-card.css?inline';

export const HOVER_CARD_REGISTER = 'ge-hover-card-register';

const OPEN_DELAY_MS = 200;
const CLOSE_DELAY_MS = 300;

/** What the parts of a hover card need from it. */
export interface HoverCardHost {
    readonly open: boolean;
    /** Opens after the hover dwell. */
    show(): void;
    /** Closes after a grace period in which the pointer can travel onto the card. */
    hide(): void;
    /** Opens or closes at once; the touch path. */
    toggle(): void;
    /** Aborts a pending {@link hide}. */
    cancelClose(): void;
    register(part: HoverCardPart): void;
    unregister(part: HoverCardPart): void;
}

/** A part that re-renders when the card opens or closes. */
export interface HoverCardPart extends HTMLElement {
    requestUpdate(): void;
}

/**
 * A preview card that appears when the pointer rests on a trigger or the trigger takes keyboard focus. Put a
 * `ge-hover-card-trigger` and a `ge-hover-card-content` inside it. On a touch screen a tap opens it and a tap
 * elsewhere closes it. It never traps focus.
 *
 * @slot - `ge-hover-card-trigger` and `ge-hover-card-content`.
 * @attr {boolean} open - Whether the card is showing. Hover, focus and touch drive it; `toggle()` does too.
 */
export class GeHoverCard extends UiElement implements HoverCardHost {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        open: { type: Boolean, reflect: true },
    };

    declare open: boolean;
    private readonly parts = new Set<HoverCardPart>();
    private openTimer?: ReturnType<typeof setTimeout>;
    private closeTimer?: ReturnType<typeof setTimeout>;
    private stopOutsideListener?: () => void;

    constructor() {
        super();
        this.open = false;
        adoptChildren<HoverCardHost, HoverCardPart>(this, HOVER_CARD_REGISTER, (part) => this.register(part));
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        clearTimeout(this.openTimer);
        clearTimeout(this.closeTimer);
        this.stopOutsideListener?.();
        this.stopOutsideListener = undefined;
    }

    register(part: HoverCardPart): void {
        this.parts.add(part);
    }

    unregister(part: HoverCardPart): void {
        this.parts.delete(part);
    }

    show(): void {
        this.cancelClose();
        this.openTimer = setTimeout(() => {
            this.open = true;
        }, OPEN_DELAY_MS);
    }

    hide(): void {
        clearTimeout(this.openTimer);
        this.closeTimer = setTimeout(() => {
            this.open = false;
        }, CLOSE_DELAY_MS);
    }

    toggle(): void {
        if (this.open) this.closeNow();
        else this.openNow();
    }

    cancelClose(): void {
        clearTimeout(this.closeTimer);
        this.closeTimer = undefined;
    }

    private openNow(): void {
        this.cancelClose();
        this.open = true;
        this.listenOutside();
    }

    private closeNow(): void {
        clearTimeout(this.openTimer);
        this.open = false;
        this.stopOutsideListener?.();
        this.stopOutsideListener = undefined;
    }

    // A card opened by touch has no pointer-leave to close it, so the first interaction elsewhere does.
    private listenOutside(): void {
        this.stopOutsideListener?.();
        const onOutside = (event: Event) => {
            if (!event.composedPath().includes(this)) this.closeNow();
        };
        document.addEventListener('click', onOutside, true);
        document.addEventListener('touchend', onOutside, true);
        this.stopOutsideListener = () => {
            document.removeEventListener('click', onOutside, true);
            document.removeEventListener('touchend', onOutside, true);
        };
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
