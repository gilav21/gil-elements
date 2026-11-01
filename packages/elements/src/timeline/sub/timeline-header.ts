import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './timeline-header.css?inline';

/**
 * The marker column of an item: a dot and a connector.
 *
 * @slot - A `ge-timeline-dot` and a `ge-timeline-connector`.
 */
export class GeTimelineHeader extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div part="base" data-slot="timeline-header"><slot></slot></div>`;
    }
}
