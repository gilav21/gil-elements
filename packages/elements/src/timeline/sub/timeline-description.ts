import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './timeline-description.css?inline';

/**
 * A line of detail under the title.
 *
 * @slot - The text.
 */
export class GeTimelineDescription extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<p part="base" data-slot="timeline-description"><slot></slot></p>`;
    }
}
