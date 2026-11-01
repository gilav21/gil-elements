import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './timeline-connector.css?inline';

/** The line from one dot down towards the next. It is positioned against the item, so it spans the item's height. */
export class GeTimelineConnector extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<div part="base" data-slot="timeline-connector"></div>`;
    }
}
