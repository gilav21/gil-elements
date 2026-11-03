import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * A key hint inside a row, pushed to its end.
 *
 * @slot - The keys.
 */
export class GeCommandShortcut extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(':host{margin-inline-start:auto;font-size:0.75rem;line-height:1rem;letter-spacing:0.1em;color:var(--muted-foreground)}'),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'command-shortcut';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
