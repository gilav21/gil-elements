import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * The arrow that points from the panel to its trigger. Like shadcn-angular's it draws the arrow only: it is not
 * positioned and does not follow the open item, so place and show it yourself.
 */
export class GeNavigationMenuIndicator extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(`:host{display:contents}
.wrap{top:100%;z-index:1;display:flex;height:0.375rem;align-items:flex-end;justify-content:center;overflow:hidden}
.arrow{position:relative;top:60%;width:0.5rem;height:0.5rem;transform:rotate(45deg);border-top-left-radius:0.125rem;background-color:var(--border);box-shadow:0 4px 6px -1px rgb(0 0 0 / 0.1),0 2px 4px -2px rgb(0 0 0 / 0.1)}`),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'navigation-menu-indicator';
    }

    protected override render() {
        return html`<div class="wrap"><div class="arrow"></div></div>`;
    }
}
