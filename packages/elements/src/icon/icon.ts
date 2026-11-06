import { html, unsafeCSS } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { UiElement } from '@gilav21/elements-base';
import { DEFAULT_ICONS, SOLID_ICONS, SOLID_SUPPORTED_ICONS } from './icons.js';
import css from './icon.css?inline';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | (string & Record<never, never>);
export type IconWeight = 'light' | 'regular' | 'thick' | 'solid';

const SIZE_MAP: Readonly<Record<string, string>> = { xs: '12', sm: '16', md: '24', lg: '32', xl: '48' };
const WEIGHT_STROKE: Readonly<Record<IconWeight, string>> = { light: '1.5', regular: '2', thick: '2.5', solid: '0' };

const custom = new Map<string, string>();
const live = new Set<GeIcon>();

/**
 * Adds glyphs to every `ge-icon`, or replaces built-in ones of the same name. Each value is the inside of a
 * 24x24 `<svg>` (paths, circles...) and is trusted markup: never build one from user input. The equivalent of
 * `provideIcons` in shadcn-angular.
 */
export function registerIcons(icons: Record<string, string>): void {
    for (const [name, markup] of Object.entries(icons)) custom.set(name, markup);
    for (const icon of live) icon.requestUpdate();
}

/**
 * An inline SVG icon from a built-in set of about a thousand glyphs, drawn as strokes in the surrounding text
 * colour. An unknown `name` draws an empty `<svg>` instead of throwing.
 *
 * @attr {string} name - Glyph key, looked up in the custom icons (see `registerIcons`) before the built-in set.
 * @attr {'xs' | 'sm' | 'md' | 'lg' | 'xl' | string} size - Preset (12 / 16 / 24 / 32 / 48px) or any SVG length. Defaults to `md`.
 * @attr {'light' | 'regular' | 'thick' | 'solid'} weight - Stroke weight; `solid` fills the glyph, for glyphs that have a solid form, and is `regular` for the rest.
 * @attr {number} stroke-width - Explicit stroke width, overriding `weight`.
 * @attr {string} color - Colour of the whole glyph; inherits the text colour when unset.
 * @attr {string} fill-color - Explicit fill, to colour in an outline glyph.
 * @csspart base - The `<svg>`.
 */
export class GeIcon extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        name: { reflect: true },
        size: {},
        weight: {},
        strokeWidth: { attribute: 'stroke-width', type: Number },
        color: {},
        fillColor: { attribute: 'fill-color' },
    };

    declare name: string;
    declare size: IconSize;
    declare weight: IconWeight;
    declare strokeWidth: number | undefined;
    declare color: string;
    declare fillColor: string;

    constructor() {
        super();
        this.name = '';
        this.size = 'md';
        this.weight = 'regular';
        this.color = '';
        this.fillColor = '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        live.add(this);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        live.delete(this);
    }

    /** `solid` only where the glyph has a filled form. */
    private get resolvedWeight(): IconWeight {
        return this.weight === 'solid' && !SOLID_SUPPORTED_ICONS.has(this.name) ? 'regular' : this.weight;
    }

    private get markup(): string {
        const own = custom.get(this.name);
        const solid = this.resolvedWeight === 'solid' && own === undefined ? SOLID_ICONS[this.name] : undefined;
        return solid ?? own ?? (DEFAULT_ICONS as Record<string, string>)[this.name] ?? '';
    }

    protected override render() {
        const solid = this.resolvedWeight === 'solid';
        const size = SIZE_MAP[this.size] ?? this.size;
        const fill = this.fillColor || (solid ? 'currentColor' : 'none');
        const stroke = this.strokeWidth === undefined ? WEIGHT_STROKE[this.resolvedWeight] : String(this.strokeWidth);
        return html`<svg
            part="base"
            xmlns="http://www.w3.org/2000/svg"
            width=${size}
            height=${size}
            viewBox="0 0 24 24"
            fill=${fill}
            stroke=${solid ? 'none' : 'currentColor'}
            stroke-width=${stroke}
            stroke-linecap="round"
            stroke-linejoin="round"
            data-slot="icon"
            style=${this.color ? `color:${this.color}` : ''}
        >${unsafeSVG(this.markup)}</svg>`;
    }
}
