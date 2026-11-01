import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './alert-title.css?inline';

/**
 * An alert's heading. A styled block, not a heading element: slot your own `<h2>` or `<h3>` if
 * the alert belongs in the document outline.
 *
 * @slot - Title text.
 */
export class GeAlertTitle extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<slot></slot>`;
    }
}
