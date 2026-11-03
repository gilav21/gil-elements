import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { COMMAND_REGISTER, type CommandHost } from '../command.js';

/**
 * The scrolling results area. It claims `role="listbox"` only while it holds visible rows: an empty listbox is
 * an accessibility error, and with no rows there is no list to browse.
 *
 * @slot - Groups, rows, `ge-command-empty` and separators.
 * @attr {string} aria-label - Accessible name of the listbox; give one when no visible label sits near it.
 */
export class GeCommandList extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(`:host{display:block;max-height:200px;overflow-y:auto;overflow-x:hidden}
@media (min-width:640px){:host{max-height:300px}}`),
    ];

    private command?: CommandHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'command-list';
        this.command = findParent<CommandHost, GeCommandList>(this, COMMAND_REGISTER);
        this.command?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.command?.unregister(this);
        this.command = undefined;
    }

    protected override updated(): void {
        if ((this.command?.visibleRows().length ?? 0) > 0) this.setAttribute('role', 'listbox');
        else this.removeAttribute('role');
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
