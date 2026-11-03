import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { ModalFocus } from '../../shared/overlay.js';
import { DIALOG_REGISTER, type DialogHost } from '../../dialog/dialog.js';
import type { DrawerDirection } from '../drawer.js';
import css from './drawer-content.css?inline';

type DrawerHost = DialogHost & { readonly direction: DrawerDirection };

/**
 * The drawer panel. It draws nothing until the drawer is open.
 *
 * Simple mode: set `heading` (and optionally `description`) and the header is generated. Custom mode: slot a
 * `ge-drawer-header` and `ge-drawer-footer` yourself. The panel has no close button: use the overlay, Escape or a
 * `ge-drawer-close`.
 *
 * `heading` is not called `title` because `title` is a native attribute: the browser would show its text as a
 * tooltip over the whole panel.
 *
 * @slot - The body: header, text, forms, footer.
 * @attr {string} heading - Simple-mode title.
 * @attr {string} description - Simple-mode text under the title; only shown when `heading` is set.
 * @csspart panel - The panel.
 */
export class GeDrawerContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        heading: {},
        description: {},
        slottedTitle: { state: true },
    };

    declare heading: string;
    declare description: string;
    declare slottedTitle: string;
    private drawer?: DrawerHost;
    private readonly modal = new ModalFocus();
    private wasOpen = false;

    constructor() {
        super();
        this.heading = '';
        this.description = '';
        this.slottedTitle = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.drawer = findParent<DrawerHost, GeDrawerContent>(this, DIALOG_REGISTER);
        this.drawer?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.drawer?.unregister(this);
        this.drawer = undefined;
    }

    protected override updated(): void {
        const open = this.drawer?.open ?? false;
        if (open === this.wasOpen) return;
        this.wasOpen = open;
        const panel = this.shadowRoot?.querySelector<HTMLElement>('.panel');
        if (open && panel) this.modal.enter(panel);
        else if (!open) this.modal.leave();
    }

    protected override render() {
        if (!this.drawer?.open) return nothing;
        const direction = this.drawer.direction;
        const label = this.heading || this.slottedTitle;
        return html`<div class="root" role="dialog" aria-modal="true" aria-label=${label || nothing} data-slot="drawer" @keydown=${this.modal.trap}>
            <div class="overlay" data-slot="drawer-overlay" aria-hidden="true" @click=${this.close}></div>
            <div class="panel" part="panel" data-slot="drawer-content" data-state="open" data-direction=${direction} tabindex="-1">
                ${direction === 'top' || direction === 'bottom' ? html`<div class="handle"></div>` : nothing}
                ${this.heading ? this.generatedHeader() : nothing}
                <slot @slotchange=${this.onSlotChange}></slot>
            </div>
        </div>`;
    }

    private generatedHeader() {
        return html`<ge-drawer-header>
            <ge-drawer-title>${this.heading}</ge-drawer-title>
            ${this.description ? html`<ge-drawer-description>${this.description}</ge-drawer-description>` : nothing}
        </ge-drawer-header>`;
    }

    private readonly close = () => this.drawer?.hide();

    private readonly onSlotChange = () => {
        this.slottedTitle = this.querySelector('ge-drawer-title')?.textContent?.trim() ?? '';
    };
}
