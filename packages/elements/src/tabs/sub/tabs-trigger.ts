import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { TABS_REGISTER, type TabsHost } from '../tabs.js';
import css from './tabs-trigger.css?inline';

/**
 * One tab in a `ge-tabs-list`. Pressing it makes its panel the active one.
 *
 * `aria-controls` is left out on purpose: the trigger and the panel live in different shadow trees, where an id
 * reference cannot resolve. The panel is named after this trigger's label instead.
 *
 * @slot - The label.
 * @attr {string} value - Which panel this tab opens. Required.
 * @attr {boolean} disabled - Blocks the tab and dims it.
 * @csspart base - The `<button>`.
 * @cssprop --density-tabs - Padding multiplier; falls back to `--density`.
 */
export class GeTabsTrigger extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        value: { reflect: true },
        disabled: { type: Boolean, reflect: true },
    };

    declare value: string;
    declare disabled: boolean;
    private tabs?: TabsHost;

    constructor() {
        super();
        this.value = '';
        this.disabled = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.tabs = findParent<TabsHost, GeTabsTrigger>(this, TABS_REGISTER);
        this.tabs?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.tabs?.unregister(this);
        this.tabs = undefined;
    }

    protected override render() {
        const active = this.tabs?.value === this.value;
        return html`<button
            part="base"
            type="button"
            role="tab"
            data-slot="tabs-trigger"
            data-state=${active ? 'active' : 'inactive'}
            aria-selected=${String(active)}
            tabindex=${active ? '0' : '-1'}
            ?disabled=${this.disabled}
            @click=${this.select}
        >
            <slot></slot>
        </button>`;
    }

    private readonly select = () => this.tabs?.select(this.value);
}
