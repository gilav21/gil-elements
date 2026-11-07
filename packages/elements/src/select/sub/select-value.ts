import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { SELECT_REGISTER, type SelectHost } from '../select.js';
import css from './select-value.css?inline';

/**
 * The text inside the trigger: the selected value, or the placeholder while nothing is selected.
 *
 * @attr {string} placeholder - Overrides the select's placeholder.
 * @attr {string} display-value - Shown instead of the select's value (for an id that reads badly). The placeholder still shows while nothing is selected.
 */
export class GeSelectValue extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        placeholder: {},
        displayValue: { attribute: 'display-value' },
    };

    declare placeholder: string | undefined;
    declare displayValue: string | undefined;
    private select?: SelectHost;

    constructor() {
        super();
        this.placeholder = undefined;
        this.displayValue = undefined;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'select-value';
        this.select = findParent<SelectHost, GeSelectValue>(this, SELECT_REGISTER);
        this.select?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.select?.unregister(this);
        this.select = undefined;
    }

    protected override render() {
        const text = this.select?.shownText;
        if (text === undefined) {
            return html`<span class="placeholder">${this.placeholder ?? this.select?.resolvedPlaceholder ?? 'Select...'}</span>`;
        }
        return html`${this.displayValue ?? text}`;
    }
}
