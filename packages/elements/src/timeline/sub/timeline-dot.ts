import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './timeline-dot.css?inline';

export type TimelineVariant = 'default' | 'filled' | 'outline' | 'success' | 'error' | 'warning';

/**
 * The marker of an event. Slot an icon to put it inside.
 *
 * @slot - Optional content centred in the dot.
 * @attr {'default' | 'filled' | 'outline' | 'success' | 'error' | 'warning'} variant - Colour. Defaults to default.
 */
export class GeTimelineDot extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        variant: { reflect: true },
    };

    declare variant: TimelineVariant;

    constructor() {
        super();
        this.variant = 'default';
    }

    protected override render() {
        return html`<div part="base" data-slot="timeline-dot" data-variant=${this.variant}><slot></slot></div>`;
    }
}
