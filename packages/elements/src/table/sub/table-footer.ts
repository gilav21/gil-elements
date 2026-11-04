import { css, html } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/** The footer row group, with a muted background and a top border for totals rows. */
export class GeTableFooter extends UiElement {
    static override styles = [
        UiElement.styles,
        css`
            :host {
                display: flex;
                flex-direction: column;
                flex-shrink: 0;
                border-top: 1px solid var(--border);
                background-color: color-mix(in oklab, var(--muted) 50%, transparent);
                font-weight: 500;
            }
        `,
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'rowgroup');
        this.dataset.slot = 'table-footer';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
