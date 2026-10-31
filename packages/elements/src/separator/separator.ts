import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './separator.css?inline';

export type SeparatorOrientation = 'horizontal' | 'vertical';

/**
 * A thin dividing line.
 *
 * @attr {'horizontal' | 'vertical'} orientation - Direction of the line. Vertical fills its parent's height.
 * @csspart line - The painted line.
 */
export class GeSeparator extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { orientation: { reflect: true } };

    declare orientation: SeparatorOrientation;

    constructor() {
        super();
        this.orientation = 'horizontal';
    }

    // The role lives on an inner node: setting attributes on the host from the constructor is
    // not allowed, and the inner node renders the same on the server.
    protected override render() {
        const vertical = this.orientation === 'vertical';
        return html`<div class="line" part="line" role="separator" aria-orientation=${vertical ? 'vertical' : 'horizontal'}></div>`;
    }
}
