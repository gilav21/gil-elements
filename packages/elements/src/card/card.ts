import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { loadingOverlay } from '../shared/loading-overlay.js';
import overlayCss from '../shared/loading-overlay.css?inline';
import css from './card.css?inline';

/**
 * A surface that groups related content.
 *
 * Two ways to fill it. Simple mode: set `heading` (and optionally `description` and `content`)
 * and the header is generated. Custom mode: leave `heading` empty and slot `ge-card-header`,
 * `ge-card-content` and `ge-card-footer` yourself. Anything slotted is shown in both modes.
 *
 * `heading` is not called `title` because `title` is a native attribute: the browser would show
 * its text as a tooltip over the whole card.
 *
 * @slot - Card content: `ge-card-header`, `ge-card-content`, `ge-card-footer`, or anything else.
 * @attr {string} heading - Simple-mode title. Setting it generates the header.
 * @attr {string} description - Simple-mode muted subtitle; only shown when `heading` is set.
 * @attr {string} content - Simple-mode body text; only shown when `heading` is set.
 * @attr {boolean} loading - Dim the card and show a spinner while keeping the content visible.
 * @attr {boolean} skeleton - Replace the whole card with a placeholder block.
 * @cssprop --density-card - Spacing multiplier for this component; falls back to `--density`.
 */
export class GeCard extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(overlayCss), unsafeCSS(css)];
    static override properties = {
        heading: {},
        description: {},
        content: {},
        loading: { type: Boolean, reflect: true },
        skeleton: { type: Boolean, reflect: true },
    };

    declare heading: string;
    declare description: string;
    declare content: string;
    declare loading: boolean;
    declare skeleton: boolean;

    constructor() {
        super();
        this.heading = '';
        this.description = '';
        this.content = '';
        this.loading = false;
        this.skeleton = false;
    }

    protected override render() {
        if (this.skeleton) return html`<span class="skeleton" part="skeleton" aria-hidden="true"></span>`;
        return html`${this.heading ? this.generated() : nothing}<slot></slot>${this.loading ? loadingOverlay('default') : nothing}`;
    }

    private generated() {
        return html`<div class="header" part="header">
                <div class="title" part="title">${this.heading}</div>
                ${this.description ? html`<div class="description" part="description">${this.description}</div>` : nothing}
            </div>
            ${this.content ? html`<div class="content" part="content">${this.content}</div>` : nothing}`;
    }
}
