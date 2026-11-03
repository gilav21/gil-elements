import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { COMMAND_REGISTER, type CommandHost, type CommandRow } from '../command.js';
import css from './command-item.css?inline';

/**
 * One row. It matches the query by its `value` and emits that value when activated by a click, by Enter while it
 * has focus, or by Enter while it is the highlighted row.
 *
 * @slot - The label, and any icon.
 * @fires select-item - When the row is activated; `detail` is its `value`. Never while `disabled`.
 * @attr {string} value - What the filter matches and what `select-item` carries. A row with no value disappears as soon as the user types.
 * @attr {string} shortcut - Key hint shown at the end of the row, such as `⌘P`. Display only: it binds no key and is not searched.
 * @attr {boolean} disabled - Dims the row and blocks activation. The arrow keys do not skip it.
 * @attr {boolean} selected - Sets `aria-selected`. An ARIA hint for a persistent choice, separate from the highlight.
 */
export class GeCommandItem extends UiElement implements CommandRow {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        value: {},
        shortcut: {},
        disabled: { type: Boolean, reflect: true },
        selected: { type: Boolean, reflect: true },
    };

    declare value: string;
    declare shortcut: string;
    declare disabled: boolean;
    declare selected: boolean;
    private command?: CommandHost;

    constructor() {
        super();
        this.value = '';
        this.shortcut = '';
        this.disabled = false;
        this.selected = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'option');
        this.tabIndex = 0;
        this.dataset.slot = 'command-item';
        this.command = findParent<CommandHost, GeCommandItem>(this, COMMAND_REGISTER);
        this.command?.registerRow(this);
        this.addEventListener('click', this.activate);
        this.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('click', this.activate);
        this.removeEventListener('keydown', this.onKeydown);
        this.command?.unregister(this);
        this.command = undefined;
    }

    /** The one activation path: click, Enter on focus and Enter on the highlight all end here. */
    readonly activate = (): void => {
        if (this.disabled) return;
        this.command?.markRecent(this.value);
        this.dispatchEvent(new CustomEvent<string>('select-item', { detail: this.value, bubbles: true, composed: true }));
    };

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter') this.activate();
    };

    protected override updated(): void {
        const active = this.command?.isActive(this) ?? false;
        this.toggleAttribute('data-active', active);
        this.toggleAttribute('data-disabled', this.disabled);
        this.toggleAttribute('hidden', !(this.command?.isVisible(this) ?? true));
        this.setAttribute('aria-selected', String(this.selected));
        // The highlight can move off screen with the arrow keys.
        if (active) this.scrollIntoView?.({ block: 'nearest' });
    }

    protected override render() {
        return html`<slot></slot>${this.shortcut ? html`<span class="shortcut">${this.shortcut}</span>` : nothing}`;
    }
}
