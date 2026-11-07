import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { prefersReducedMotion } from '../shared/motion.js';
import css from './ripple.css?inline';

/**
 * Makes whatever it wraps ripple from the point of a click, like a Material button. The element is the box: it is
 * relatively positioned and clips the ripple, so give it the border radius, size and background of the thing that
 * should ripple (or wrap a single block-level child that has them). It is `display: block`; set `display: inline-block`
 * on it to sit in a line of text.
 *
 * A click made from the keyboard has no pointer position, so its ripple spreads from the centre. Under
 * `prefers-reduced-motion: reduce` no ripple is drawn.
 *
 * @attr {string} color - Ripple colour. Defaults to a translucent tint of the current text colour, so it suits any background.
 * @attr {number} duration - Milliseconds one ripple takes to finish. Defaults to 600.
 * @attr {boolean} disabled - Stops it rippling, and stops clipping and positioning the host.
 * @slot - The content that ripples.
 */
export class GeRipple extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        color: { type: String, reflect: true },
        duration: { type: Number, reflect: true },
        disabled: { type: Boolean, reflect: true },
    };

    declare color: string;
    declare duration: number;
    declare disabled: boolean;

    constructor() {
        super();
        this.color = 'color-mix(in srgb, currentColor 35%, transparent)';
        this.duration = 600;
        this.disabled = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.addEventListener('click', this.ripple);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('click', this.ripple);
        for (const wave of this.renderRoot.querySelectorAll('.wave')) wave.remove();
    }

    protected override render() {
        return html`<slot></slot>`;
    }

    private readonly ripple = (event: MouseEvent): void => {
        if (this.disabled || prefersReducedMotion()) return;
        const rect = this.getBoundingClientRect();
        // A click from the keyboard reports 0,0: spread from the middle instead of from the page corner.
        const fromKeyboard = event.detail === 0 && event.clientX === 0 && event.clientY === 0;
        const x = fromKeyboard ? rect.width / 2 : event.clientX - rect.left;
        const y = fromKeyboard ? rect.height / 2 : event.clientY - rect.top;
        const diameter = Math.max(rect.width, rect.height) * 2;

        const wave = document.createElement('span');
        wave.className = 'wave';
        wave.style.cssText = `width:${diameter}px;height:${diameter}px;left:${x - diameter / 2}px;top:${y - diameter / 2}px;background-color:${this.color}`;
        this.renderRoot.append(wave);
        wave.animate([{ transform: 'scale(0)', opacity: '1' }, { transform: 'scale(1)', opacity: '0' }], {
            duration: this.duration,
            easing: 'cubic-bezier(0.2, 0.6, 0.35, 1)',
            fill: 'forwards',
        }).onfinish = () => wave.remove();
    };
}
