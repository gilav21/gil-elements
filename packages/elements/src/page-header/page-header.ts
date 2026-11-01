import { html, nothing, unsafeCSS, type TemplateResult } from 'lit';
import { html as staticHtml, literal } from 'lit/static-html.js';
import { UiElement } from '@gilav21/elements-base';
import css from './page-header.css?inline';

export type PageHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

const TAGS = { 1: literal`h1`, 2: literal`h2`, 3: literal`h3`, 4: literal`h4`, 5: literal`h5`, 6: literal`h6` } as const;

/** Anything that is not a whole number from 1 to 6 becomes the nearest valid level, and junk becomes 1. */
function clampLevel(value: unknown): PageHeadingLevel {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) return 1;
    return Math.min(6, Math.max(1, n)) as PageHeadingLevel;
}

/**
 * The top of a page: an optional breadcrumb, a heading with a description, and actions.
 *
 * The heading is a real `<h1>`–`<h6>` chosen with `heading-level`, so the page outline stays
 * correct whatever the visual size.
 *
 * @slot - Actions (buttons), placed beside the heading, or under it when there is no room.
 * @slot breadcrumb - A breadcrumb trail above the heading. The row disappears when empty.
 * @attr {string} heading - The page title.
 * @attr {string} description - Muted text under the title.
 * @attr {number} heading-level - Which heading element to render, 1 to 6. Defaults to 1.
 */
export class GePageHeader extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        heading: {},
        description: {},
        headingLevel: { attribute: 'heading-level', converter: clampLevel },
    };

    declare heading: string;
    declare description: string;
    declare headingLevel: PageHeadingLevel;

    constructor() {
        super();
        this.heading = '';
        this.description = '';
        this.headingLevel = 1;
    }

    protected override render() {
        return html`<div class="breadcrumb" part="breadcrumb"><slot name="breadcrumb"></slot></div>
            <div class="row" part="row">
                <div class="heading-block" part="heading-block">
                    ${this.heading ? this.renderTitle() : nothing}
                    ${this.description ? html`<p class="description" part="description">${this.description}</p>` : nothing}
                </div>
                <div class="actions" part="actions"><slot></slot></div>
            </div>`;
    }

    private renderTitle(): TemplateResult {
        const tag = TAGS[clampLevel(this.headingLevel)];
        return staticHtml`<${tag} class="title" part="title">${this.heading}</${tag}>`;
    }
}
