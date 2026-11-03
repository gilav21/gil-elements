import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { COMMAND_REGISTER, type CommandHost } from '../command.js';

/**
 * Rows that belong together under an optional heading. It hides itself when the filter leaves none of its rows.
 *
 * @slot - `ge-command-item` elements.
 * @attr {string} heading - Section label above the rows. It is not searched; only row values are.
 */
export class GeCommandGroup extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(`:host{display:block;overflow:hidden;padding:0.25rem;color:var(--command-group-color,var(--foreground));font-weight:var(--command-group-weight,inherit);padding-inline:var(--command-group-px,0.25rem)}
:host([hidden]){display:none}
.heading{padding:0.375rem 0.5rem;font-size:0.75rem;line-height:1rem;font-weight:500;color:var(--muted-foreground)}`),
    ];
    static override properties = { heading: {} };

    declare heading: string;
    private command?: CommandHost;

    constructor() {
        super();
        this.heading = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'group');
        this.dataset.slot = 'command-group';
        this.command = findParent<CommandHost, GeCommandGroup>(this, COMMAND_REGISTER);
        this.command?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.command?.unregister(this);
        this.command = undefined;
    }

    protected override updated(): void {
        const visible = this.command?.visibleRows() ?? [];
        // A group with no rows of its own stays visible; the filter only hides one it emptied.
        this.toggleAttribute('hidden', !visible.some((row) => this.contains(row)));
    }

    protected override render() {
        return html`${this.heading ? html`<div class="heading">${this.heading}</div>` : nothing}<slot></slot>`;
    }
}
