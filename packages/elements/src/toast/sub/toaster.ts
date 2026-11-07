import { css, html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { toast, type ToastService } from '../toast-service.js';

export type ToasterVertical = 'top' | 'center' | 'bottom';
export type ToasterHorizontal = 'start' | 'center' | 'end';

/**
 * The fixed stack that shows the `toast` service's queue. Put one on the page. Toasts are appended in arrival
 * order, so a bottom stack grows downward. While the pointer is over the stack or focus is inside it, every
 * auto-dismiss clock is paused (WCAG 2.2.1).
 *
 * @attr {'top' | 'center' | 'bottom'} vertical - Vertical anchor. Defaults to `bottom`.
 * @attr {'start' | 'center' | 'end'} horizontal - Horizontal anchor; `start` and `end` flip in RTL. Defaults to `end`.
 */
export class GeToaster extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        css`
            :host {
                position: fixed;
                z-index: 100;
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                box-sizing: border-box;
                width: 100%;
                max-width: calc(100vw - 2rem);
                padding: 1rem;
                pointer-events: none;
            }
            :host([vertical='top']) {
                top: 0;
            }
            :host([vertical='center']) {
                top: 50%;
                translate: 0 -50%;
            }
            :host([vertical='bottom']) {
                bottom: 0;
            }
            :host([horizontal='start']) {
                inset-inline-start: 0;
            }
            :host([horizontal='end']) {
                inset-inline-end: 0;
            }
            :host([horizontal='center']) {
                left: 50%;
                translate: -50% 0;
            }
            :host([vertical='center'][horizontal='center']) {
                translate: -50% -50%;
            }
            @media (min-width: 640px) {
                :host {
                    max-width: 420px;
                }
            }
        `,
    ];
    static override readonly properties = { vertical: { reflect: true }, horizontal: { reflect: true } };
    declare vertical: ToasterVertical;
    declare horizontal: ToasterHorizontal;

    /** The queue this toaster shows; the shared `toast` service unless you swap it (before it connects). */
    service: ToastService = toast;

    private pointerInside = false;
    private focusInside = false;
    /** Whether this toaster owns a `pause()` on the service, so it never resumes a pause it did not take. */
    private holding = false;

    constructor() {
        super();
        this.vertical = 'bottom';
        this.horizontal = 'end';
        this.addEventListener('pointerenter', () => this.hold('pointerInside', true));
        this.addEventListener('pointerleave', () => this.hold('pointerInside', false));
        this.addEventListener('focusin', () => this.hold('focusInside', true));
        this.addEventListener('focusout', (event) => {
            if (event.relatedTarget instanceof Node && this.contains(event.relatedTarget)) return;
            this.hold('focusInside', false);
        });
    }

    private readonly onChange = () => {
        this.requestUpdate();
        // A removed element fires no focusout or pointerleave: once the DOM settles, drop a focus hold whose element
        // is gone, and every hold once the stack is empty, or the next toast would be raised frozen.
        this.updateComplete.then(() => this.releaseStaleHolds());
    };

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'toaster';
        this.service.addEventListener('change', this.onChange);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.service.removeEventListener('change', this.onChange);
        this.pointerInside = false;
        this.focusInside = false;
        this.syncPause();
    }

    private hold(which: 'pointerInside' | 'focusInside', on: boolean): void {
        this[which] = on;
        this.syncPause();
    }

    private releaseStaleHolds(): void {
        const empty = this.service.toasts.length === 0;
        const focusGone = this.focusInside && !this.contains(document.activeElement);
        if (empty) this.pointerInside = false;
        if (empty || focusGone) this.focusInside = false;
        this.syncPause();
    }

    private syncPause(): void {
        const wanted = this.pointerInside || this.focusInside;
        if (wanted === this.holding) return;
        this.holding = wanted;
        if (wanted) this.service.pause();
        else this.service.resume();
    }

    protected override render() {
        return html`${repeat(
            this.service.toasts,
            (t) => t.id,
            (t) => html`<ge-toast
                variant=${t.variant ?? 'default'}
                .heading=${t.heading ?? ''}
                .description=${t.description ?? ''}
                .actionLabel=${t.action?.label ?? ''}
                .showCountdown=${t.showCountdown ?? false}
                .countdownSeconds=${t.countdownSeconds ?? null}
                .duration=${t.duration ?? null}
                .loading=${t.loading ?? false}
                @action=${() => t.action?.onClick()}
                @closed=${() => this.service.dismiss(t.id)}
            ></ge-toast>`,
        )}`;
    }
}
