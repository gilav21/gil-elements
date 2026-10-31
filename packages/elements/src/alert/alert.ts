import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './alert.css?inline';

export type AlertVariant = 'default' | 'destructive';

/**
 * A callout that draws attention to a message.
 *
 * Simple mode: set `heading` (and `description`). Custom mode: slot `ge-alert-title` and
 * `ge-alert-description`. A leading icon goes in the `icon` slot, so the text sits beside it
 * with no knowledge of what the icon is.
 *
 * The variant decides how a screen reader announces it: `default` is a polite status,
 * `destructive` is an assertive alert that interrupts, so reserve it for real errors.
 *
 * @slot - Alert content: `ge-alert-title`, `ge-alert-description`, or anything else.
 * @slot icon - A leading icon, usually an `<svg>`.
 * @attr {'default' | 'destructive'} variant - Colour treatment and announcement urgency.
 * @attr {string} heading - Simple-mode title (not `title`, which would add a browser tooltip).
 * @attr {string} description - Simple-mode text under the heading; only shown when `heading` is set.
 */
export class GeAlert extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        variant: { reflect: true },
        heading: {},
        description: {},
    };

    declare variant: AlertVariant;
    declare heading: string;
    declare description: string;

    constructor() {
        super();
        this.variant = 'default';
        this.heading = '';
        this.description = '';
    }

    // The announcement role lives on an inner node: a host cannot set its own attributes
    // safely during construction or server rendering.
    protected override render() {
        const destructive = this.variant === 'destructive';
        return html`<slot name="icon"></slot>
            <div class="body" role=${destructive ? 'alert' : 'status'} aria-live=${destructive ? 'assertive' : 'polite'}>
                ${this.heading
                    ? html`<div class="title" part="title">${this.heading}</div>
                          ${this.description ? html`<div class="description" part="description">${this.description}</div>` : nothing}`
                    : nothing}
                <slot></slot>
            </div>`;
    }
}
