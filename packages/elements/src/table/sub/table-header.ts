import { css, html } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/** The header row group. It sticks to the top of the table with an opaque background, so it stays while the body scrolls. */
export class GeTableHeader extends UiElement {
    static override styles = [
        UiElement.styles,
        css`
            :host {
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                position: sticky;
                top: 0;
                z-index: 20;
                background-color: var(--background);
            }
        `,
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'rowgroup');
        this.dataset.slot = 'table-header';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
