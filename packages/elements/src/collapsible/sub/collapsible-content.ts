import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { COLLAPSIBLE_REGISTER, type CollapsibleHost } from '../collapsible.js';
import css from './collapsible-content.css?inline';

/**
 * The panel of a `ge-collapsible`. It is not rendered while closed, so its content is not in the page either.
 *
 * @slot - The panel's content.
 * @csspart base - The panel wrapper.
 */
export class GeCollapsibleContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];

    private collapsible?: CollapsibleHost;

    override connectedCallback(): void {
        super.connectedCallback();
        this.collapsible = findParent<CollapsibleHost, GeCollapsibleContent>(this, COLLAPSIBLE_REGISTER);
        this.collapsible?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.collapsible?.unregister(this);
        this.collapsible = undefined;
    }

    protected override render() {
        if (!this.collapsible?.open) return nothing;
        return html`<div part="base" class="panel" data-slot="collapsible-content" data-state="open"><slot></slot></div>`;
    }
}
