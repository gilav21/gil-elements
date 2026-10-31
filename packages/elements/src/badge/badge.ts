import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './badge.css?inline';

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

/**
 * A short status label.
 *
 * @slot - Badge content (text, an icon, markup). Shown instead of `label` when present.
 * @attr {'default' | 'secondary' | 'destructive' | 'outline'} variant - Colour treatment. `outline` has no fill.
 * @attr {string} label - Plain-text content for the simple case; the slot wins when both are given.
 * @attr {boolean} skeleton - Show a fixed-size loading placeholder instead of the content.
 * @cssprop --density-badge - Spacing multiplier for this component; falls back to `--density`.
 */
export class GeBadge extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    // Declared through `static properties` (not decorators) so there is no compiler magic
    // to depend on, and assigned in the constructor: a class field would shadow Lit's accessor.
    static override properties = {
        variant: { reflect: true },
        label: {},
        skeleton: { type: Boolean, reflect: true },
    };

    declare variant: BadgeVariant;
    declare label: string;
    declare skeleton: boolean;

    constructor() {
        super();
        this.variant = 'default';
        this.label = '';
        this.skeleton = false;
    }

    protected override render() {
        if (this.skeleton) return html`<span class="skeleton" part="skeleton" aria-hidden="true"></span>`;
        return html`<slot>${this.label || nothing}</slot>`;
    }
}
