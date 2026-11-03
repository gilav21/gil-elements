import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { SELECT_REGISTER, type SelectHost } from '../select.js';
import css from './select-item.css?inline';

/**
 * One choice. Clicking it, or pressing Enter or Space while it has focus, picks its `value`.
 *
 * @slot - The text of the row.
 * @attr {string} value - What the select takes when this row is picked. Unique within one select.
 * @attr {boolean} disabled - The row cannot be picked and the arrow keys skip it.
 */
export class GeSelectItem extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        value: {},
        disabled: { type: Boolean, reflect: true },
    };

    declare value: string;
    declare disabled: boolean;
    private select?: SelectHost;

    constructor() {
        super();
        this.value = '';
        this.disabled = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.setAttribute('role', 'option');
        this.tabIndex = -1;
        this.dataset.slot = 'select-item';
        this.select = findParent<SelectHost, GeSelectItem>(this, SELECT_REGISTER);
        this.select?.register(this);
        this.addEventListener('click', this.onClick);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.removeEventListener('click', this.onClick);
        this.select?.unregister(this);
        this.select = undefined;
    }

    private readonly onClick = () => {
        if (!this.disabled) this.select?.select(this.value);
    };

    protected override updated(): void {
        const selected = this.select?.isSelected(this.value) ?? false;
        this.setAttribute('aria-selected', String(selected));
        this.dataset.state = selected ? 'checked' : 'unchecked';
        this.toggleAttribute('data-driven', this.select?.dataDriven ?? false);
        if (this.disabled) {
            this.dataset.disabled = '';
            this.setAttribute('aria-disabled', 'true');
        } else {
            delete this.dataset.disabled;
            this.removeAttribute('aria-disabled');
        }
    }

    protected override render() {
        const selected = this.select?.isSelected(this.value) ?? false;
        return html`<slot></slot><span class="mark">${selected
            ? html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" /></svg>`
            : nothing}</span>`;
    }
}
