import { html, nothing, type TemplateResult } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions } from '../../rich-text-host.js';
import type { Disposables } from '../../rich-text-registry.js';
import { registerPopoverButton, triggerButton, type PopoverButtonView } from '../shared-popover-button.js';
import { RICH_TEXT_TYPOGRAPHY_LOCALES, type RichTextTypographyLocale } from './typography-locale.js';
import css from './typography.css?inline';

export const TYPOGRAPHY_SIZE_SLOT_ID = 'typography.size';
export const TYPOGRAPHY_FAMILY_SLOT_ID = 'typography.family';

/** Web-safe families offered by the font-family field. */
export const DEFAULT_FONT_FAMILIES: readonly string[] = [
    'Arial',
    'Helvetica',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Times New Roman',
    'Georgia',
    'Garamond',
    'Courier New',
    'Lucida Console',
    'Comic Sans MS',
    'Impact',
];

/** Whether custom families extend the defaults or replace them. */
export type FontFamilyStrategy = 'append' | 'replace';

/** 8px to 72px in 2px steps. */
const FONT_SIZES = Array.from({ length: 33 }, (_, index) => `${8 + index * 2}px`);

const SIZE_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>';

const FAMILY_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="M21 14h-5"/><path d="M21 18h-5"/><path d="M17 14v8"/><path d="m3 16 4-8 4 8"/><path d="M4.5 14h5"/></svg>';

export interface RichTextTypographyOptions extends RichTextAddonOptions {
    /** Custom families for the font-family field. */
    readonly families?: readonly string[];
    /** `'append'` (default) adds `families` after the defaults, `'replace'` shows only them. */
    readonly familiesStrategy?: FontFamilyStrategy;
    /** A locale id or a full dictionary, instead of the editor's. */
    readonly locale?: string | RichTextTypographyLocale;
}

/** The families the field offers; an empty custom list keeps the defaults. */
export function fontFamilyOptions(families: readonly string[] = [], strategy: FontFamilyStrategy = 'append'): readonly string[] {
    if (families.length === 0) return DEFAULT_FONT_FAMILIES;
    return strategy === 'replace' ? families : [...DEFAULT_FONT_FAMILIES, ...families];
}

interface Kind {
    readonly id: string;
    readonly order: number;
    readonly icon: string;
    readonly name: 'size' | 'family';
    readonly tooltip: string;
    readonly heading: string;
    readonly placeholder: string;
    readonly options: readonly string[];
    readonly filter: boolean;
    seed(): string;
    apply(value: string): void;
}

export const typographyAddon = defineAddon<RichTextTypographyOptions>('typography', 310, ({ host, options, life }) => {
    if (!options.toolbar) return;
    const locale = resolveAddonLocale(RICH_TEXT_TYPOGRAPHY_LOCALES, host, options.locale);
    const usable = (): boolean => !host.isDisabled && !host.readonly;

    const applySize = (value: string): void => {
        const numeric = value.replaceAll(/\D/g, '');
        if (!numeric || !usable()) return;
        host.applyInlineStyle({ fontSize: numeric });
        host.emit('font-size-select', numeric);
    };

    const applyFamily = (value: string): void => {
        if (!value || !usable()) return;
        host.applyInlineStyle({ fontFamily: value });
        host.emit('font-family-select', value);
    };

    const kinds: readonly Kind[] = [
        {
            id: TYPOGRAPHY_SIZE_SLOT_ID, order: options.order, icon: SIZE_ICON, name: 'size', tooltip: locale.fontSize,
            heading: locale.selectSize, placeholder: locale.selectSizePlaceholder, options: FONT_SIZES, filter: false,
            seed: () => (host.selectionInlineStyle.fontSize ? `${host.selectionInlineStyle.fontSize}px` : ''),
            apply: applySize,
        },
        {
            id: TYPOGRAPHY_FAMILY_SLOT_ID, order: options.order + 1, icon: FAMILY_ICON, name: 'family', tooltip: locale.fontFamily,
            heading: locale.selectFamily, placeholder: locale.selectFamilyPlaceholder,
            options: fontFamilyOptions(options.families, options.familiesStrategy), filter: true,
            seed: () => host.selectionInlineStyle.fontFamily,
            apply: applyFamily,
        },
    ];
    for (const kind of kinds) registerKind(host, life, kind);
});

function detailText(event: Event): string {
    const { detail } = event as CustomEvent<unknown>;
    return typeof detail === 'string' ? detail : '';
}

function registerKind(host: RichTextAddonHost, life: Disposables, kind: Kind): void {
    let seeded = '';

    const panel = (): TemplateResult => html`<div class="rte-typography-panel">
        <p class="rte-typography-heading">${kind.heading}</p>
        <ge-autocomplete
            .options=${kind.options}
            .value=${seeded}
            .noFilter=${!kind.filter}
            placeholder=${kind.placeholder}
            @value-change=${(event: Event) => kind.apply(detailText(event))}
        ></ge-autocomplete>
    </div>`;

    registerPopoverButton(host, life, {
        id: kind.id,
        order: kind.order,
        css,
        onOpen: () => {
            seeded = kind.seed();
        },
        template: (view: PopoverButtonView) => html`<ge-popover close-on-scroll ${ref(view.popover)} @open-change=${view.onOpenChange}>
            <ge-popover-trigger>${triggerButton(kind.tooltip, view.disabled, kind.icon)}</ge-popover-trigger>
            <ge-popover-content class=${kind.name} align="start" strategy="fixed">${view.open ? panel() : nothing}</ge-popover-content>
        </ge-popover>`,
    });
}
