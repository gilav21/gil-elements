import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './marquee.css?inline';

export type MarqueeDirection = 'left' | 'right' | 'up' | 'down';

/**
 * A strip of content that scrolls forever and loops without a seam: the slotted content is copied once and the track
 * slides by exactly one copy plus the gap.
 *
 * Direction values are physical, so `left` does not flip in RTL. For `up` and `down` give the marquee a bounded height
 * (on the host or the `viewport` part), otherwise there is nothing to scroll within. Under `prefers-reduced-motion: reduce`
 * nothing moves and nothing is copied. The copy is a plain clone: it is hidden from assistive tech and carries no listeners.
 *
 * @attr {string} direction - `left` (default), `right`, `up` or `down`.
 * @attr {number} speed - Seconds for one loop, i.e. to pass a single copy of the content; more content moves faster at the same value. Defaults to 20.
 * @attr {boolean} pause-on-hover - Pause while the pointer is over it, or while a touch is held. Resumes where it stopped.
 * @attr {number} gap - Pixels between items and between the content and its copy. Defaults to 16.
 * @csspart viewport - The clipping box.
 * @slot - The items to scroll.
 */
export class GeMarquee extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        direction: { type: String, reflect: true },
        speed: { type: Number, reflect: true },
        pauseOnHover: { type: Boolean, attribute: 'pause-on-hover', reflect: true },
        gap: { type: Number, reflect: true },
    };

    declare direction: MarqueeDirection;
    declare speed: number;
    declare pauseOnHover: boolean;
    declare gap: number;

    private animation?: Animation;
    private frameId: number | null = null;

    constructor() {
        super();
        this.direction = 'left';
        this.speed = 20;
        this.pauseOnHover = false;
        this.gap = 16;
    }

    protected override updated(changed: PropertyValues): void {
        if (changed.has('direction') || changed.has('speed') || changed.has('gap')) this.scheduleSetup();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.teardown();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (this.hasUpdated) this.scheduleSetup();
    }

    protected override render() {
        const vertical = this.direction === 'up' || this.direction === 'down';
        return html`<div class="viewport" part="viewport" data-slot="marquee"
            @mouseenter=${this.hold} @mouseleave=${this.release} @touchstart=${this.hold} @touchend=${this.release}>
            <div class="track" style="gap: ${this.gap}px"><div class="segment ${vertical ? 'column' : ''}" style="gap: ${this.gap}px"><slot @slotchange=${this.scheduleSetup}></slot></div></div>
        </div>`;
    }

    private hold = (): void => {
        if (this.pauseOnHover) this.animation?.pause();
    };

    private release = (): void => {
        if (this.pauseOnHover) this.animation?.play();
    };

    private scheduleSetup = (): void => {
        this.teardown();
        // The slotted items are laid out only after the first frame, and the loop distance is measured from them.
        this.frameId = requestAnimationFrame(() => {
            this.frameId = null;
            this.setup();
        });
    };

    private teardown(): void {
        // A frame still pending here would start an infinite animation after teardown with nothing left to cancel it.
        if (this.frameId !== null) cancelAnimationFrame(this.frameId);
        this.frameId = null;
        this.animation?.cancel();
        this.animation = undefined;
        this.renderRoot.querySelector('.copy')?.remove();
    }

    private setup(): void {
        if (prefersReducedMotion()) return;
        const track = this.renderRoot.querySelector<HTMLElement>('.track');
        const segment = this.renderRoot.querySelector<HTMLElement>('.segment');
        const slot = this.renderRoot.querySelector<HTMLSlotElement>('slot');
        if (!track || !segment || !slot) return;

        const copy = segment.cloneNode(false) as HTMLElement;
        copy.classList.add('copy');
        copy.setAttribute('aria-hidden', 'true');
        for (const node of slot.assignedNodes({ flatten: true })) copy.append(node.cloneNode(true));
        track.append(copy);

        const vertical = this.direction === 'up' || this.direction === 'down';
        const reverse = this.direction === 'right' || this.direction === 'down';
        const distance = (vertical ? segment.offsetHeight : segment.offsetWidth) + this.gap;
        const axis = vertical ? 'translateY' : 'translateX';
        this.animation = track.animate([{ transform: `${axis}(0)` }, { transform: `${axis}(-${distance}px)` }], {
            duration: this.speed * 1000,
            iterations: Infinity,
            easing: 'linear',
            direction: reverse ? 'reverse' : 'normal',
        });
    }
}
