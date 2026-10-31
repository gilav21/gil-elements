import { unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './skeleton.css?inline';

export type SkeletonVariant = 'pulse' | 'shimmer';

/**
 * A loading placeholder. It has no intrinsic size: set `width` and `height` on it.
 *
 * @attr {'pulse' | 'shimmer'} variant - `pulse` fades a faint primary fill; `shimmer` sweeps a highlight across it.
 * @cssprop --skeleton-shimmer-base - Shimmer background colour (themed for dark in tokens.css).
 * @cssprop --skeleton-shimmer-highlight - Shimmer highlight colour.
 */
export class GeSkeleton extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { variant: { reflect: true } };

    declare variant: SkeletonVariant;

    constructor() {
        super();
        this.variant = 'pulse';
    }
}
