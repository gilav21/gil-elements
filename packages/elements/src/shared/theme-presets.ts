/**
 * Per-instance colour presets, the same names `change-theme` accepts. A component with a `theme`
 * property reflects it as `data-ui-theme`, and its stylesheet maps each name to the preset's tokens.
 */
export const THEME_NAMES = [
    'zinc', 'slate', 'stone', 'gray', 'neutral',
    'red', 'rose', 'orange', 'green', 'blue', 'yellow', 'violet', 'amber',
] as const;

export type ThemeName = (typeof THEME_NAMES)[number];

/** The attribute a themed host carries; overlays look it up to inherit the preset. */
export const THEME_ATTRIBUTE = 'data-ui-theme';

/** The tokens a preset overrides; everything else stays the app's global tokens. */
export const THEME_TOKENS = ['--primary', '--primary-foreground', '--ring'] as const;

/**
 * Carries a themed component's preset onto an overlay rendered outside it (e.g. appended to
 * `document.body`). Call on every show, including re-shows of a reused overlay.
 *
 * Custom properties inherit through the DOM, so a real descendant is left alone and keeps inheriting
 * live. Anything else gets the resolved tokens copied at show time (a dark-mode toggle while open is
 * not reflected until it re-opens). An overlay whose origin is no longer themed has earlier copies
 * cleared so it follows the global tokens.
 */
export function inheritThemeTokens(origin: Element, overlay: HTMLElement): void {
    const themed = origin.closest<HTMLElement>(`[${THEME_ATTRIBUTE}]`);
    if (themed?.contains(overlay)) return;
    if (!themed) {
        for (const token of THEME_TOKENS) overlay.style.removeProperty(token);
        delete overlay.dataset['uiTheme'];
        return;
    }

    const computed = getComputedStyle(themed);
    for (const token of THEME_TOKENS) overlay.style.setProperty(token, computed.getPropertyValue(token));
    // The attribute travels too, so an overlay opened FROM this overlay still finds a themed origin.
    overlay.dataset['uiTheme'] = themed.dataset['uiTheme'];
}
