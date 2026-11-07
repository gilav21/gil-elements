import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * Hint text at the far end of a row, for a row whose content you project yourself (a row built with the `shortcut`
 * attribute needs no element). Decorative: it binds no key.
 *
 * @slot - The text, such as `⌘K`.
 */
export class GeContextMenuShortcut extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(':host{margin-inline-start:auto;font-size:0.75rem;line-height:1rem;letter-spacing:0.1em;color:var(--muted-foreground)}'),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'context-menu-shortcut';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
