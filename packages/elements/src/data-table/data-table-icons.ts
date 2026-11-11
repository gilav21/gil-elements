/**
 * The few glyphs the data-table draws itself (sort arrows, pager chevrons, expanders, the empty-state mark), inline,
 * so the grid does not pull in the whole icon set of `ge-icon` (about 38 kB gzipped). They are the same paths and the
 * same stroke settings as `ge-icon`'s own; a node test compares them with its table. A cell icon chosen by name
 * (`iconSet`) can be any glyph, so that path loads `ge-icon` on first use instead.
 */
import { html, nothing, svg, type TemplateResult } from 'lit';
import { lazyElement } from './data-table-lazy.js';

const GLYPHS = {
    'arrow-up': svg`<path d="M12 20V4" /><path d="m6 10 6-6 6 6" />`,
    'arrow-down': svg`<path d="M12 4v16" /><path d="m6 14 6 6 6-6" />`,
    'chevrons-up-down': svg`<path d="m7 9 5-5 5 5" /><path d="m7 15 5 5 5-5" />`,
    'chevron-up': svg`<path d="m5 15 7-7 7 7" />`,
    'chevron-down': svg`<path d="m5 9 7 7 7-7" />`,
    'chevron-left': svg`<path d="m15 5-7 7 7 7" />`,
    'chevron-right': svg`<path d="m9 5 7 7-7 7" />`,
    'chevrons-left': svg`<path d="m11 6-6 6 6 6" /><path d="m19 6-6 6 6 6" />`,
    'chevrons-right': svg`<path d="m13 6 6 6-6 6" /><path d="m5 6 6 6-6 6" />`,
    'chevrons-down': svg`<path d="m6 5 6 6 6-6" /><path d="m6 13 6 6 6-6" />`,
    'circle-off': svg`<circle cx="12" cy="12" r="9" /><path d="m4 4 16 16" />`,
} as const;

export type ChromeIconName = keyof typeof GLYPHS;

/** The glyph names, for the test that keeps them equal to `ge-icon`'s. */
export const CHROME_ICON_NAMES = Object.keys(GLYPHS) as ChromeIconName[];

const SIZE = { xs: 12, sm: 16, xl: 48 } as const;

/** A glyph as an inline `<svg>` in a `span` that centres it like `ge-icon` does. */
export function chromeIcon(name: ChromeIconName, size: keyof typeof SIZE = 'sm', className?: string): TemplateResult {
    const px = SIZE[size];
    return html`<span data-slot="dt-icon" class=${className ?? nothing}><svg xmlns="http://www.w3.org/2000/svg" width=${px} height=${px} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${GLYPHS[name]}</svg></span>`;
}

const iconElement = lazyElement('ge-icon', () => import('../icon/define.js'));

/**
 * Loads `ge-icon` once, for a cell icon picked by name; the element upgrades in place when it is defined. A failed load is reported once (never an
 * unhandled rejection) and latched until `resetIconElement()` (the table's next attach), so it is retried without re-importing at every render.
 */
export function ensureIconElement(): void {
    void iconElement.load();
}

/** Forgets a latched load failure: the next `ensureIconElement()` imports again (called when a table attaches). */
export const resetIconElement = (): void => iconElement.reset();

/** A glyph's markup as `ge-icon` stores it, for the test that keeps the two equal. */
export const chromeGlyphMarkup = (name: ChromeIconName): string => GLYPHS[name].strings.join('');
