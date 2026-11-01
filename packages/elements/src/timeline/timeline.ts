import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './timeline.css?inline';

export type TimelineOrientation = 'vertical' | 'horizontal';

/**
 * A list of events in order. Fill it with `ge-timeline-item`s.
 *
 * @slot - `ge-timeline-item`s.
 * @attr {'vertical' | 'horizontal'} orientation - Direction the items are laid out. Defaults to vertical.
 */
export class GeTimeline extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        orientation: { reflect: true },
    };

    declare orientation: TimelineOrientation;

    constructor() {
        super();
        this.orientation = 'vertical';
    }

    protected override render() {
        return html`<div class="timeline" part="base" data-slot="timeline" data-orientation=${this.orientation}><slot></slot></div>`;
    }
}
