import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { findParent } from '../../shared/compound.js';
import { ModalFocus } from '../../shared/overlay.js';
import { DIALOG_REGISTER, type DialogHost } from '../../dialog/dialog.js';
import css from './sheet-content.css?inline';

export type SheetSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * The sheet panel. It draws nothing until the sheet is open.
 *
 * Simple mode: set `heading` (and optionally `description`) and the header is generated. Custom mode: slot a
 * `ge-sheet-header` and `ge-sheet-footer` yourself.
 *
 * `heading` is not called `title` because `title` is a native attribute: the browser would show its text as a
 * tooltip over the whole panel.
 *
 * @slot - The body: header, text, forms, footer.
 * @attr {'top' | 'bottom' | 'left' | 'right'} side - The edge it slides from. Defaults to right; left and right follow the text direction.
 * @attr {string} heading - Simple-mode title.
 * @attr {string} description - Simple-mode text under the title; only shown when `heading` is set.
 * @attr {string} close-label - Accessible name of the close button. Defaults to "Close".
 * @csspart panel - The panel.
 */
export class GeSheetContent extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        side: { reflect: true },
        heading: {},
        description: {},
        closeLabel: { attribute: 'close-label' },
        slottedTitle: { state: true },
    };

    declare side: SheetSide;
    declare heading: string;
    declare description: string;
    declare closeLabel: string;
    declare slottedTitle: string;
    private dialog?: DialogHost;
    private readonly modal = new ModalFocus();
    private wasOpen = false;

    constructor() {
        super();
        this.side = 'right';
        this.heading = '';
        this.description = '';
        this.closeLabel = 'Close';
        this.slottedTitle = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dialog = findParent<DialogHost, GeSheetContent>(this, DIALOG_REGISTER);
        this.dialog?.register(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.dialog?.unregister(this);
        this.dialog = undefined;
    }

    protected override updated(): void {
        const open = this.dialog?.open ?? false;
        if (open === this.wasOpen) return;
        this.wasOpen = open;
        const panel = this.shadowRoot?.querySelector<HTMLElement>('.panel');
        if (open && panel) this.modal.enter(panel);
        else if (!open) this.modal.leave();
    }

    protected override render() {
        if (!this.dialog?.open) return nothing;
        const label = this.heading || this.slottedTitle;
        return html`<div class="root" role="dialog" aria-modal="true" aria-label=${label || nothing} data-slot="sheet" @keydown=${this.modal.trap}>
            <div class="overlay" data-slot="sheet-overlay" aria-hidden="true" @click=${this.close}></div>
            <div class="panel" part="panel" data-slot="sheet-content" data-state="open" data-side=${this.side} tabindex="-1">
                ${this.heading ? this.generatedHeader() : nothing}
                <slot @slotchange=${this.onSlotChange}></slot>
                <button type="button" class="close" aria-label=${this.closeLabel} @click=${this.close}>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    <span class="sr-only">${this.closeLabel}</span>
                </button>
            </div>
        </div>`;
    }

    private generatedHeader() {
        return html`<ge-sheet-header>
            <ge-sheet-title>${this.heading}</ge-sheet-title>
            ${this.description ? html`<ge-sheet-description>${this.description}</ge-sheet-description>` : nothing}
        </ge-sheet-header>`;
    }

    private readonly close = () => this.dialog?.hide();

    private readonly onSlotChange = () => {
        this.slottedTitle = this.querySelector('ge-sheet-title')?.textContent?.trim() ?? '';
    };
}
