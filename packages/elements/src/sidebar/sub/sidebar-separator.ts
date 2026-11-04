import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './sidebar-separator.css?inline';

/** A thin rule between sections of the sidebar. */
export class GeSidebarSeparator extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    protected override render() {
        return html`<hr data-slot="sidebar-separator" />`;
    }
}
