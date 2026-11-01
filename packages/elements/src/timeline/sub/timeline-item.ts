import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import type { TimelineVariant } from './timeline-dot.js';
import css from './timeline-item.css?inline';

const CUSTOM_PARTS = 'ge-timeline-header, ge-timeline-content';

/**
 * One event. Simple mode: set `heading`, `description`, `time` and `variant`. Custom mode: slot a
 * `ge-timeline-header` (dot and connector) and a `ge-timeline-content` yourself.
 *
 * `heading` is not called `title` because `title` is a native attribute: the browser would show
 * its text as a tooltip over the whole item.
 *
 * @slot - Custom mode: `ge-timeline-header` and `ge-timeline-content`.
 * @attr {string} heading - Simple-mode title.
 * @attr {string} description - Simple-mode detail line.
 * @attr {string} time - Simple-mode time text.
 * @attr {'default' | 'filled' | 'outline' | 'success' | 'error' | 'warning'} variant - Simple-mode dot colour.
 * @attr {boolean} hide-connector - Simple mode: leave out the line under the dot. (A boolean attribute cannot default to true, so this is the inverse of the Angular `showConnector`.)
 */
export class GeTimelineItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        heading: {},
        description: {},
        time: {},
        variant: { reflect: true },
        hideConnector: { type: Boolean, attribute: 'hide-connector', reflect: true },
        custom: { state: true },
    };

    declare heading: string;
    declare description: string;
    declare time: string;
    declare variant: TimelineVariant;
    declare hideConnector: boolean;
    declare custom: boolean;

    private readonly observer = new MutationObserver(() => this.detect());

    constructor() {
        super();
        this.heading = '';
        this.description = '';
        this.time = '';
        this.variant = 'default';
        this.hideConnector = false;
        this.custom = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.detect();
        this.observer.observe(this, { childList: true });
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.observer.disconnect();
    }

    private detect(): void {
        this.custom = this.querySelector(`:scope > :is(${CUSTOM_PARTS})`) !== null;
    }

    protected override render() {
        return html`<div class="item" part="base" data-slot="timeline-item">${this.custom ? html`<slot></slot>` : this.generated()}</div>`;
    }

    private generated() {
        return html`<ge-timeline-header>
                <ge-timeline-dot variant=${this.variant}></ge-timeline-dot>
                ${this.hideConnector ? nothing : html`<ge-timeline-connector></ge-timeline-connector>`}
            </ge-timeline-header>
            <ge-timeline-content>
                ${this.heading ? html`<ge-timeline-title>${this.heading}</ge-timeline-title>` : nothing}
                ${this.description ? html`<ge-timeline-description>${this.description}</ge-timeline-description>` : nothing}
                ${this.time ? html`<ge-timeline-time>${this.time}</ge-timeline-time>` : nothing}
            </ge-timeline-content>`;
    }
}
