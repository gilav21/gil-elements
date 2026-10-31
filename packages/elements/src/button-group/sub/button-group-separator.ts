import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './button-group-separator.css?inline';

/**
 * A thin line between items of a button group. Vertical by default, because the usual group
 * is horizontal and the line stands between its items.
 *
 * @attr {'horizontal' | 'vertical'} orientation - Direction of the line. Defaults to vertical.
 */
export class GeButtonGroupSeparator extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = { orientation: { reflect: true } };

    declare orientation: 'horizontal' | 'vertical';

    constructor() {
        super();
        this.orientation = 'vertical';
    }

    protected override render() {
        return html`<div class="separator" role="separator" aria-orientation=${this.orientation}></div>`;
    }
}
