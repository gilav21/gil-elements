import { html, nothing } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { formatHex, parseColor } from '../../../shared/color.js';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions, RichTextInlineStyle } from '../../rich-text-host.js';
import { registerPopoverButton, triggerButton, type PopoverButtonView } from '../../rich-text-popover-button.js';
import type { Disposables } from '../../rich-text-registry.js';
import {
    DEFAULT_COLOR_PALETTE,
    DEFAULT_HIGHLIGHT_PALETTE,
    RICH_TEXT_COLORS_LOCALES,
    type RichTextColorsLocale,
} from './colors-locale.js';
import css from './colors.css?inline';

export const COLORS_FOREGROUND_SLOT_ID = 'colors.foreground';
export const COLORS_BACKGROUND_SLOT_ID = 'colors.background';

type ColorKind = 'foreground' | 'background';

const FOREGROUND_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="4 2 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="m6 16 6-12 6 12"/><path d="M8 12h8"/></svg>';

const BACKGROUND_ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">'
    + '<path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/>'
    + '<path d="M2 13h15"/><path d="M22 20a2 2 0 1 1-4 0c0-1.6 1.7-2.4 2-4 .3 1.6 2 2.4 2 4Z"/></svg>';

export interface RichTextColorsOptions extends RichTextAddonOptions {
    /** Swatches of the text-colour picker. */
    readonly palette?: readonly string[];
    /** Swatches of the highlight picker. */
    readonly highlightPalette?: readonly string[];
    /** Offer an opacity slider on the highlight picker. Default false. */
    readonly alpha?: boolean;
    /** Show the pickers' recently-used row. Default false: each picker is built fresh when its panel opens and keeps nothing between visits. */
    readonly recent?: boolean;
    /** A locale id or a full dictionary, instead of the editor's. */
    readonly locale?: string | RichTextColorsLocale;
}

/** The detail of the `color-change` event. */
export interface RichTextColorChange {
    readonly type: 'fontColor' | 'backgroundColor';
    readonly color: string;
}

const toHex = (value: string): string => {
    const rgba = parseColor(value);
    return rgba ? formatHex(rgba) : value;
};

const isTransparent = (value: string): boolean => {
    const rgba = parseColor(value);
    return !rgba || rgba.a === 0;
};

export const colorsAddon = defineAddon<RichTextColorsOptions>('colors', 300, ({ host, options, life }) => {
    if (!options.toolbar) return;
    const locale = resolveAddonLocale(RICH_TEXT_COLORS_LOCALES, host, options.locale);
    const kinds: readonly ColorKindSpec[] = [
        {
            kind: 'foreground', id: COLORS_FOREGROUND_SLOT_ID, order: options.order, icon: FOREGROUND_ICON,
            tooltip: locale.textColor, heading: locale.textColor,
            presets: options.palette ?? DEFAULT_COLOR_PALETTE, alpha: false, recent: options.recent === true,
        },
        {
            kind: 'background', id: COLORS_BACKGROUND_SLOT_ID, order: options.order + 1, icon: BACKGROUND_ICON,
            tooltip: locale.backgroundColor, heading: locale.highlightColor,
            presets: options.highlightPalette ?? DEFAULT_HIGHLIGHT_PALETTE, alpha: options.alpha === true, recent: options.recent === true,
        },
    ];
    for (const spec of kinds) registerColorButton(host, life, spec);
});

interface ColorKindSpec {
    readonly kind: ColorKind;
    readonly id: string;
    readonly order: number;
    readonly icon: string;
    readonly tooltip: string;
    readonly heading: string;
    readonly presets: readonly string[];
    readonly alpha: boolean;
    readonly recent: boolean;
}

function registerColorButton(host: RichTextAddonHost, life: Disposables, spec: ColorKindSpec): void {
    const { kind } = spec;
    let seeded = '';
    let picked: string | undefined;

    const current = (): string => {
        const style = host.selectionInlineStyle;
        if (kind === 'foreground') return toHex(style.color);
        return isTransparent(style.backgroundColor) ? '' : toHex(style.backgroundColor);
    };

    const style = (color: string): RichTextInlineStyle => (kind === 'foreground' ? { color } : { backgroundColor: color });

    const pick = (color: string): void => {
        const reflected = current();
        if (host.isDisabled || host.readonly || (reflected !== '' && toHex(color) === reflected)) return;
        host.applyInlineStyle(style(color));
        picked = color;
        host.emit<RichTextColorChange>('color-change', { type: kind === 'foreground' ? 'fontColor' : 'backgroundColor', color });
    };

    // A colour chosen at a collapsed caret is only the browser's pending typing style, which the click that
    // dismisses the panel destroys; it is applied again once the caret is back. Over a selection it is in the DOM already.
    const reapply = (): void => {
        const color = picked;
        picked = undefined;
        life.timeout(() => {
            host.restoreSelection();
            if (color !== undefined && host.selection().range?.collapsed === true) host.applyInlineStyle(style(color));
        }, 0);
    };

    // The picker's own event would reach the editor under the same name as the one announced here.
    const onPick = (event: Event): void => {
        event.stopPropagation();
        pick((event as CustomEvent<string>).detail);
    };

    const panel = () => html`<div class="rte-colors-panel">
        <p class="rte-colors-heading">${spec.heading}</p>
        <ge-color-picker
            inline
            .presets=${[...spec.presets]}
            .showRecent=${spec.recent}
            .alpha=${spec.alpha}
            .value=${seeded}
            @color-change=${onPick}
        ></ge-color-picker>
    </div>`;

    const face = (color: string) => html`<span class="rte-colors-face">
        <span class="rte-colors-glyph">${unsafeHTML(spec.icon)}</span>
        <span class="rte-colors-indicator" data-slot="rte-color-indicator" data-empty=${color ? nothing : kind} style=${styleMap(color ? { backgroundColor: color } : {})}></span>
    </span>`;

    const button = registerPopoverButton(host, life, {
        id: spec.id,
        order: spec.order,
        css,
        onOpen: () => {
            picked = undefined;
            seeded = current();
        },
        onClose: reapply,
        template: (view: PopoverButtonView) => html`<ge-popover close-on-scroll ${ref(view.popover)} @open-change=${view.onOpenChange}>
            <ge-popover-trigger>${triggerButton(spec.tooltip, view.disabled, face(current()))}</ge-popover-trigger>
            <ge-popover-content align="start" strategy="fixed">${view.open ? panel() : nothing}</ge-popover-content>
        </ge-popover>`,
    });
    life.add(host.subscribe('selection', button.update));
}
