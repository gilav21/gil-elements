import { css, html } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * A row. It is `min-width: max-content`, so a row wider than the table scrolls the table instead of squashing its cells.
 *
 * @attr {boolean} selected - Paints the selected background and sets `data-state="selected"`. Visual only: it does not manage a selection or set `aria-selected`.
 */
export class GeTableRow extends UiElement {
    static override styles = [
        UiElement.styles,
        css`
            :host {
                display: flex;
                flex-shrink: 0;
                width: 100%;
                min-width: max-content;
                transition: background-color 150ms;
            }
            :host(:hover) {
                background-color: color-mix(in oklab, var(--muted) 50%, transparent);
            }
            :host([selected]) {
                background-color: var(--muted);
            }
        `,
    ];
    static override properties = { selected: { type: Boolean, reflect: true } };
    declare selected: boolean;

    constructor() {
        super();
        this.selected = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'row');
        this.dataset.slot = 'table-row';
    }

    protected override updated(): void {
        if (this.selected) this.dataset.state = 'selected';
        else delete this.dataset.state;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
