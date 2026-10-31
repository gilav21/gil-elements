import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { loadingOverlay } from '../shared/loading-overlay.js';
import overlayCss from '../shared/loading-overlay.css?inline';
import css from './avatar.css?inline';

export type AvatarStatus = 'loading' | 'loaded' | 'error';

/**
 * A round user picture that falls back to initials (or anything) when the image is missing.
 *
 * Simple mode: `src`, `alt` and `fallback`. Custom mode: slot your own `<img>` as the default
 * content and your own fallback markup in the `fallback` slot. The element watches the image
 * itself, so there is no separate image or fallback sub-element to register.
 *
 * @slot - An `<img>`. It is hidden until it has loaded.
 * @slot fallback - Shown while the image has not loaded or failed to load.
 * @attr {string} src - Simple-mode image URL.
 * @attr {string} alt - Simple-mode alternative text.
 * @attr {string} fallback - Simple-mode fallback text, such as initials.
 * @attr {boolean} loading - Dim the avatar and show a spinner.
 * @attr {boolean} skeleton - Show a circular placeholder.
 * @attr {'loading' | 'loaded' | 'error'} status - Read-only: the state of the image.
 * @cssprop --density-avatar - Size multiplier for this component; falls back to `--density`.
 */
export class GeAvatar extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(overlayCss), unsafeCSS(css)];
    static override properties = {
        src: {},
        alt: {},
        fallback: {},
        loading: { type: Boolean, reflect: true },
        skeleton: { type: Boolean, reflect: true },
        status: { reflect: true },
    };

    declare src: string;
    declare alt: string;
    declare fallback: string;
    declare loading: boolean;
    declare skeleton: boolean;
    declare status: AvatarStatus;

    constructor() {
        super();
        this.src = '';
        this.alt = '';
        this.fallback = '';
        this.loading = false;
        this.skeleton = false;
        this.status = 'loading';
        // `load` and `error` do not bubble, but they can be caught in the capture phase, which
        // is how a slotted light-DOM image is observed without wrapping it. (The image the
        // element renders itself is inside the shadow root, where this host listener cannot see
        // it, because these events are not composed; it has its own listeners in `render`.)
        this.addEventListener('load', this.onImageEvent, true);
        this.addEventListener('error', this.onImageEvent, true);
    }

    override willUpdate(changed: Map<string, unknown>) {
        if (changed.has('src')) this.status = 'loading';
    }

    protected override render() {
        if (this.skeleton) return html`<span class="skeleton" part="skeleton" aria-hidden="true"></span>`;
        return html`${this.src
                ? html`<img class="image" part="image" src=${this.src} alt=${this.alt} @load=${this.onImageEvent} @error=${this.onImageEvent} />`
                : html`<slot @slotchange=${this.checkSlotted}></slot>`}
            ${this.status === 'loaded' ? nothing : html`<div class="fallback" part="fallback"><slot name="fallback">${this.fallback}</slot></div>`}
            ${this.loading ? loadingOverlay('small') : nothing}`;
    }

    private readonly onImageEvent = (event: Event) => {
        if (!(event.target instanceof HTMLImageElement)) return;
        this.status = event.type === 'load' ? 'loaded' : 'error';
    };

    /** An image that finished loading before the element upgraded has already fired its events. */
    private readonly checkSlotted = (event: Event) => {
        const img = (event.target as HTMLSlotElement).assignedElements().find((el) => el instanceof HTMLImageElement);
        if (img?.complete) this.status = img.naturalWidth > 0 ? 'loaded' : 'error';
    };
}
