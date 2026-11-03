import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { COMMAND_REGISTER, type CommandHost } from '../command.js';

/**
 * The message shown while the filter leaves no rows.
 *
 * @slot - The message.
 */
export class GeCommandEmpty extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(':host{display:block;padding-block:1.5rem;text-align:center;font-size:0.875rem;line-height:1.25rem;color:var(--muted-foreground)}:host([hidden]){display:none}'),
    ];

    private command?: CommandHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'command-empty';
        this.command = findParent<CommandHost, GeCommandEmpty>(this, COMMAND_REGISTER);
        this.command?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.command?.unregister(this);
        this.command = undefined;
    }

    protected override updated(): void {
        this.toggleAttribute('hidden', (this.command?.visibleRows().length ?? 0) > 0);
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
