import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './empty-media.css?inline';

export type EmptyMediaVariant = 'default' | 'icon';

/**
 * The picture above an empty state's title: an illustration, or an icon in a rounded tile.
 *
 * @slot - An `<svg>`, an `<img>` or anything visual. Inline `width`/`height` on an icon wins over the tile's default size.
 * @attr {'default' | 'icon'} variant - `icon` draws a 2.5rem muted tile and sizes a slotted `<svg>` to 1.5rem.
 */
export class GeEmptyMedia extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { variant: { reflect: true } };

    declare variant: EmptyMediaVariant;

    constructor() {
        super();
        this.variant = 'default';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
