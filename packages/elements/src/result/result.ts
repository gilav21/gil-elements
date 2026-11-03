import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import css from './result.css?inline';

/** Outcome being reported. It picks the glyph and its colour, never how loudly the panel is announced. */
export type ResultStatus = 'success' | 'error' | 'warning' | 'info';

const GLYPHS: Readonly<Record<ResultStatus, string>> = {
    success: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm-3.5-9 2.5 2.5 4.5-4.5',
    error: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18ZM9 9l6 6m0-6-6 6',
    warning: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4m0 4h.01',
    info: 'M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18Zm0-13h.01M11 12h1v4h1',
};

/**
 * A centred in-page outcome panel shown after an operation completes: a form submit, a checkout, a bulk action.
 *
 * It announces but never interrupts and never takes focus: the panel is a native `<output>` (the `status`
 * role) with `aria-live="polite"` for every status, errors included, because a result is not worth cutting a
 * screen reader off mid-sentence.
 *
 * Projected content lands in the actions row. Bulkier content (an error dump, a summary table) goes in a
 * `ge-result-detail`, which is drawn above the actions.
 *
 * @slot - Actions, usually buttons.
 * @slot detail - Where `ge-result-detail` lands; it assigns itself, you do not set it.
 * @attr {'success' | 'error' | 'warning' | 'info'} status - Outcome: the glyph and its colour.
 * @attr {string} heading - Headline. Not called `title`, which the browser would show as a tooltip. Hidden when empty.
 * @attr {string} description - Supporting line under the headline. Hidden when empty.
 * @csspart panel - The `<output>` box.
 */
export class GeResult extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        status: { reflect: true },
        heading: {},
        description: {},
        hasActions: { state: true },
    };

    declare status: ResultStatus;
    declare heading: string;
    declare description: string;
    declare hasActions: boolean;

    constructor() {
        super();
        this.status = 'info';
        this.heading = '';
        this.description = '';
        this.hasActions = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'result-host';
    }

    private readonly onActionsChange = (event: Event) => {
        this.hasActions = (event.target as HTMLSlotElement).assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE || n.textContent?.trim());
    };

    protected override render() {
        const status = GLYPHS[this.status] ? this.status : 'info';
        return html`<output class="panel" part="panel" data-slot="result" aria-live="polite">
            <div class="icon" data-slot="result-icon" data-status=${status} aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d=${GLYPHS[status]} /></svg>
            </div>
            ${this.heading ? html`<div class="title" data-slot="result-title">${this.heading}</div>` : nothing}
            ${this.description ? html`<p class="description" data-slot="result-description">${this.description}</p>` : nothing}
            <slot name="detail"></slot>
            <div class="actions" data-slot="result-actions" ?hidden=${!this.hasActions}><slot @slotchange=${this.onActionsChange}></slot></div>
        </output>`;
    }
}
