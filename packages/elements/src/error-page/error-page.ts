import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { resolveErrorPageLocale, type ErrorPageCopy, type ErrorPageLocale } from './error-page.locales.js';
import css from './error-page.css?inline';

/**
 * A full-page 404 / 403 / 500 state: a status code (or your own artwork), a message and recovery actions.
 *
 * It reports, you decide where to go: it fires `go-back` and `go-home` and knows nothing about routing. Default
 * copy comes from the locale, keyed by `code`; any other code gets the locale's generic copy. Project a
 * `ge-error-page-illustration` to replace the typographic code, or a `ge-error-page-actions` to replace both
 * default buttons (the defaults are then gone and the two events stop firing).
 *
 * @slot illustration - Filled by a direct `ge-error-page-illustration` child.
 * @slot actions - Filled by a direct `ge-error-page-actions` child.
 * @fires go-back - The default back button was pressed.
 * @fires go-home - The default home button was pressed.
 * @attr {string} code - Status code shown as the default illustration and used to pick the copy. Defaults to `404`.
 * @attr {string} heading - Overrides the code's default heading (not `title`, which would add a browser tooltip).
 * @attr {string} description - Overrides the code's default supporting line.
 * @attr {string} locale - Locale id or object for the copy and direction; defaults to the page's `lang`, then `en`.
 * @csspart base - The page container.
 */
export class GeErrorPage extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        code: { reflect: true },
        heading: {},
        description: {},
        locale: {},
    };

    declare code: string;
    declare heading: string;
    declare description: string;
    declare locale: string | ErrorPageLocale;

    constructor() {
        super();
        this.code = '404';
        this.heading = '';
        this.description = '';
        this.locale = '';
    }

    private copy(t: ErrorPageLocale): ErrorPageCopy {
        // Object.hasOwn: a code like 'toString' must not resolve to an inherited member.
        return Object.hasOwn(t.codes, this.code) ? (t.codes[this.code] as ErrorPageCopy) : t.fallback;
    }

    protected override render() {
        const t = resolveErrorPageLocale(this.locale);
        const copy = this.copy(t);
        return html`<div part="base" class="page" data-slot="error-page" dir=${t.rtl ? 'rtl' : nothing}>
            <slot name="illustration"><div class="code" data-slot="error-page-code" aria-hidden="true">${this.code}</div></slot>
            <h1 data-slot="error-page-title">${this.heading || copy.title}</h1>
            <p data-slot="error-page-description">${this.description || copy.description}</p>
            <slot name="actions">
                <div class="actions" data-slot="error-page-actions">
                    <ge-button variant="outline" data-slot="error-page-back" @click=${this.goBack}>${t.goBack}</ge-button>
                    <ge-button data-slot="error-page-home" @click=${this.goHome}>${t.goHome}</ge-button>
                </div>
            </slot>
        </div>`;
    }

    private readonly goBack = () => this.dispatchEvent(new Event('go-back', { bubbles: true, composed: true }));
    private readonly goHome = () => this.dispatchEvent(new Event('go-home', { bubbles: true, composed: true }));
}
