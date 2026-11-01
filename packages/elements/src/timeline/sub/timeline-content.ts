import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './timeline-content.css?inline';

/**
 * The text column of an item.
 *
 * @slot - A `ge-timeline-title`, `ge-timeline-description` and `ge-timeline-time`, or anything else.
 */
export class GeTimelineContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div part="base" data-slot="timeline-content"><slot></slot></div>`;
    }
}
