import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './timeline-time.css?inline';

/**
 * When the event happened.
 *
 * @slot - The text.
 */
export class GeTimelineTime extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<time part="base" data-slot="timeline-time"><slot></slot></time>`;
    }
}
