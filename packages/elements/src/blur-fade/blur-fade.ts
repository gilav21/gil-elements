import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './blur-fade.css?inline';

export type BlurFadeDirection = 'up' | 'down' | 'left' | 'right';

const defaultTrue = { fromAttribute: (value: string | null) => value !== 'false', toAttribute: (value: boolean) => (value ? null : 'false') };

const FROM: Record<BlurFadeDirection, string> = {
    up: 'translateY(8px)',
    down: 'translateY(-8px)',
    left: 'translateX(8px)',
    right: 'translateX(-8px)',
};

/**
 * Reveals whatever it wraps: the content fades in from blurred while sliding 8px towards its place. The element is the box
 * that moves, so put the spacing and size on it. It waits until about a tenth of it is on screen, plays once and stops
 * watching. Under `prefers-reduced-motion: reduce` the content is simply shown.
 *
 * @fires replay - `playAnimation()` restarted a reveal that had already run. The first reveal, automatic or manual, is not a replay.
 * @attr {number} delay - Milliseconds to wait before the reveal begins once it is triggered. Defaults to 0.
 * @attr {number} duration - Length of the fade, blur and slide in milliseconds. Defaults to 500.
 * @attr {string} direction - The way the content travels towards: `up` (default; it starts low and rises), `down`, `left` or `right`. Physical, so it does not flip in right-to-left pages.
 * @attr {boolean} in-view - Wait for the element to scroll into view. On by default; `in-view="false"` plays at once, which suits a container that is already visible, such as a dialog.
 */
export class GeBlurFade extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        delay: { type: Number },
        duration: { type: Number },
        direction: { type: String },
        inView: { attribute: 'in-view', converter: defaultTrue },
    };

    declare delay: number;
    declare duration: number;
    declare direction: BlurFadeDirection;
    declare inView: boolean;

    private observer: IntersectionObserver | null = null;
    private animation: Animation | null = null;
    private revealed = false;

    constructor() {
        super();
        this.delay = 0;
        this.duration = 500;
        this.direction = 'up';
        this.inView = true;
    }

    protected override render() {
        return html`<slot></slot>`;
    }

    protected override firstUpdated(): void {
        this.arm();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.observer?.disconnect();
        this.observer = null;
        this.animation?.cancel();
    }

    override connectedCallback(): void {
        super.connectedCallback();
        // Moved or re-attached after its first render: it must not stay hidden with nothing left to reveal it.
        if (this.hasUpdated && !this.revealed && !this.observer) this.arm();
    }

    /**
     * Runs the reveal from the start, cancelling one in flight. It is the only way to play it again, since the automatic
     * trigger stops watching after the first run. Unlike that trigger it does not check `prefers-reduced-motion`.
     */
    playAnimation(): void {
        const replay = this.revealed;
        this.animation?.cancel();
        this.style.opacity = '0';
        this.animation = this.animate(
            [
                { opacity: 0, filter: 'blur(8px)', transform: FROM[this.direction] ?? FROM.up },
                { opacity: 1, filter: 'blur(0)', transform: 'translate(0, 0)' },
            ],
            { duration: this.duration, delay: this.delay, easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)', fill: 'forwards' },
        );
        this.revealed = true;
        if (replay) this.dispatchEvent(new CustomEvent('replay', { bubbles: true, composed: true }));
    }

    private arm(): void {
        this.style.opacity = '0';
        if (prefersReducedMotion()) {
            this.style.opacity = '1';
            return;
        }
        if (!this.inView) {
            this.playAnimation();
            return;
        }
        // No IntersectionObserver (SSR, an old engine): nothing would ever reveal the content, so show it.
        if (typeof IntersectionObserver !== 'function') {
            this.style.opacity = '1';
            return;
        }
        this.observer = new IntersectionObserver(
            (entries) => {
                if (!entries.some((entry) => entry.isIntersecting)) return;
                this.playAnimation();
                this.observer?.disconnect();
                this.observer = null;
            },
            { threshold: 0.1 },
        );
        this.observer.observe(this);
    }
}
