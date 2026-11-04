import { css, html, svg } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { resolveCommonLocale } from '../../shared/common-locales.js';
import { CAROUSEL_REGISTER, type CarouselHost } from '../carousel.js';

export const NAV_STYLES = css`
    :host {
        display: contents;
    }
    button {
        position: absolute;
        z-index: 10;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 2rem;
        height: 2rem;
        padding: 0;
        border: 1px solid var(--input);
        border-radius: 9999px;
        background: color-mix(in oklab, var(--background) 80%, transparent);
        color: inherit;
        box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
        backdrop-filter: blur(4px);
        cursor: pointer;
        outline: none;
        transition: color 150ms, background-color 150ms;
    }
    button:hover {
        background: var(--accent);
        color: var(--accent-foreground);
    }
    button:focus {
        box-shadow: 0 0 0 2px #fff, 0 0 0 4px var(--ring), 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1);
    }
    button:disabled {
        pointer-events: none;
        opacity: 0.5;
    }
    :host([data-side='start']) button {
        left: 0.5rem;
    }
    :host([data-side='end']) button {
        right: 0.5rem;
    }
    :host([data-orientation='horizontal']) button {
        top: 50%;
        translate: 0 -50%;
    }
    :host([data-orientation='vertical']) button {
        left: 50%;
        right: auto;
        top: auto;
        translate: -50% 0;
        rotate: 90deg;
    }
    :host([data-orientation='vertical'][data-side='start']) button {
        top: -3rem;
    }
    :host([data-orientation='vertical'][data-side='end']) button {
        bottom: -3rem;
    }
    @media (min-width: 640px) {
        button {
            background: var(--background);
            backdrop-filter: none;
        }
        :host([data-orientation='horizontal'][data-side='start']) button {
            left: -3rem;
        }
        :host([data-orientation='horizontal'][data-side='end']) button {
            right: -3rem;
        }
    }
    svg {
        width: 1rem;
        height: 1rem;
    }
`;

/** Shared by the previous and next buttons: `side` is where the button sits, `start` (left) or `end` (right). */
export abstract class GeCarouselNav extends UiElement {
    static override styles = [UiElement.styles, NAV_STYLES];
    static override properties = { locale: {} };
    declare locale: string | null;
    protected abstract readonly side: 'start' | 'end';
    private host?: CarouselHost;

    constructor() {
        super();
        this.locale = null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = `carousel-${this.side === 'start' ? 'previous' : 'next'}`;
        this.dataset.side = this.side;
        this.host = findParent<CarouselHost, GeCarouselNav>(this, CAROUSEL_REGISTER);
        this.host?.attach(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.host?.detach(this);
    }

    protected override render() {
        const host = this.host;
        if (!host) return html``;
        this.dataset.orientation = host.orientation;
        // The button stays on its physical side, so in a right-to-left page the left one goes forward.
        const forward = this.side === 'end' !== (host.orientation === 'horizontal' && host.rtl);
        const enabled = forward ? host.canScrollNext : host.canScrollPrev;
        const text = resolveCommonLocale(this.locale);
        const label = this.side === 'start' ? text.previousSlide : text.nextSlide;
        const path = this.side === 'start' ? svg`<path d="m15 18-6-6 6-6" />` : svg`<path d="m9 18 6-6-6-6" />`;
        return html`<button
            type="button"
            aria-label=${label}
            ?disabled=${!enabled}
            @click=${() => (forward ? host.scrollNext() : host.scrollPrev())}
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>
        </button>`;
    }
}
