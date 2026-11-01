import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { TABS_REGISTER, type TabsHost } from '../tabs.js';
import css from './tabs-content.css?inline';

/**
 * The panel of one tab. It is not rendered unless its tab is active.
 *
 * @slot - The panel's content.
 * @attr {string} value - The tab this panel belongs to. Required.
 * @csspart base - The panel wrapper.
 */
export class GeTabsContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override shadowRootOptions: ShadowRootInit = { ...UiElement.shadowRootOptions, delegatesFocus: true };
    static override properties = {
        value: { reflect: true },
    };

    declare value: string;
    private tabs?: TabsHost;

    constructor() {
        super();
        this.value = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.tabs = findParent<TabsHost, GeTabsContent>(this, TABS_REGISTER);
        this.tabs?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.tabs?.unregister(this);
        this.tabs = undefined;
    }

    protected override render() {
        if (this.tabs?.value !== this.value) return nothing;
        const label = this.tabs.labelOf(this.value);
        return html`<div part="base" class="panel" role="tabpanel" tabindex="0" data-slot="tabs-content" aria-label=${label || nothing}><slot></slot></div>`;
    }
}
