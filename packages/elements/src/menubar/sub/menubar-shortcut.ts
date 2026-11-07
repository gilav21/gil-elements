import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/**
 * Hint text pushed to the end of an item, such as `⌘T`. Decorative: it binds no key.
 *
 * @slot - The hint.
 */
export class GeMenubarShortcut extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(':host{display:block;margin-inline-start:auto;font-size:0.75rem;line-height:1rem;letter-spacing:0.1em;color:var(--muted-foreground)}'),
    ];

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'menubar-shortcut';
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
