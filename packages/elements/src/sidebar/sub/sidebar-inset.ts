import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-inset.css?inline';

/**
 * The page content beside the sidebar. It takes the remaining width and is a `main` landmark.
 *
 * @slot - The page.
 */
export class GeSidebarInset extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<main data-slot="sidebar-inset"><slot></slot></main>`;
    }
}
