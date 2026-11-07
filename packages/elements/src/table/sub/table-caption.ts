import { css, html } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/** A caption. It is a flex sibling of the row groups rather than a native `<caption>`, so it renders where you put it. */
export class GeTableCaption extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        css`
            :host {
                display: flex;
                margin-top: 1rem;
                color: var(--muted-foreground);
                font-size: 0.875rem;
                line-height: 1.25rem;
            }
        `,
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'table-caption';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
