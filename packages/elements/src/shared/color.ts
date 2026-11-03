/**
 * Colour parsing and WCAG contrast, copied from shadcn-angular's lib/color.ts (only what a chip needs), so a
 * caller-supplied background gets the same readable foreground in both libraries.
 */

export interface RGB {
    r: number;
    g: number;
    b: number;
}
export interface RGBA extends RGB {
    /** 0..1 */
    a: number;
}
export interface HSL {
    h: number;
    s: number;
    l: number;
}
export interface OKLCH {
    /** 0..1 perceptual lightness */
    l: number;
    /** 0..~0.4 chroma */
    c: number;
    /** 0..360 hue degrees */
    h: number;
}

const NAMED_COLORS: Record<string, RGBA> = {
    transparent: { r: 0, g: 0, b: 0, a: 0 },
    black: { r: 0, g: 0, b: 0, a: 1 },
    white: { r: 255, g: 255, b: 255, a: 1 },
    red: { r: 255, g: 0, b: 0, a: 1 },
    green: { r: 0, g: 128, b: 0, a: 1 },
    blue: { r: 0, g: 0, b: 255, a: 1 },
    gray: { r: 128, g: 128, b: 128, a: 1 },
    grey: { r: 128, g: 128, b: 128, a: 1 },
};

function clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
}

function clamp01(v: number): number {
    return clamp(v, 0, 1);
}

function clamp255(v: number): number {
    return Math.round(clamp(v, 0, 255));
}


function parseHex(input: string): RGBA | null {
    const m = /^#?([\da-f]{3,8})$/i.exec(input.trim());
    if (!m) return null;
    const hex = m[1] ?? '';
    if (hex.length === 3 || hex.length === 4) {
        const r = Number.parseInt(hex.charAt(0) + hex.charAt(0), 16);
        const g = Number.parseInt(hex.charAt(1) + hex.charAt(1), 16);
        const b = Number.parseInt(hex.charAt(2) + hex.charAt(2), 16);
        const a = hex.length === 4 ? Number.parseInt(hex.charAt(3) + hex.charAt(3), 16) / 255 : 1;
        return { r, g, b, a };
    }
    if (hex.length === 6 || hex.length === 8) {
        const r = Number.parseInt(hex.slice(0, 2), 16);
        const g = Number.parseInt(hex.slice(2, 4), 16);
        const b = Number.parseInt(hex.slice(4, 6), 16);
        const a = hex.length === 8 ? Number.parseInt(hex.slice(6, 8), 16) / 255 : 1;
        return { r, g, b, a };
    }
    return null;
}

/**
 * `scale` is the value 100% stands for. CSS Color 4 `none` is a missing
 * component, which converts as 0.
 */
function parseChannel(s: string, scale: number): number {
    const t = s.trim();
    if (t === 'none') return 0;
    if (t.endsWith('%')) {
        return (Number.parseFloat(t) / 100) * scale;
    }
    return Number.parseFloat(t);
}

function parseRgbFunc(input: string): RGBA | null {
    const m = /^rgba?\(([^)]+)\)$/i.exec(input.trim());
    if (!m) return null;
    const parts = (m[1] ?? '').split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const r = parseChannel((parts[0] ?? ''), 255);
    const g = parseChannel((parts[1] ?? ''), 255);
    const b = parseChannel((parts[2] ?? ''), 255);
    const a = parts.length >= 4 ? parseChannel((parts[3] ?? ''), 1) : 1;
    if ([r, g, b, a].some(Number.isNaN)) return null;
    return { r: clamp255(r), g: clamp255(g), b: clamp255(b), a: clamp01(a) };
}

const DEGREES_PER_ANGLE_UNIT: Record<string, number> = {
    deg: 1,
    grad: 0.9,
    rad: 180 / Math.PI,
    turn: 360,
};

/**
 * Chroma that 100% stands for in CSS Color 4's `oklch()`; the other
 * percentage references are 100 for `hsl()` s/l and 1 for lightness/alpha.
 */
const OKLCH_CHROMA_AT_100_PERCENT = 0.4;

/**
 * A CSS `<hue>` in degrees: a bare number (degrees), a number with a
 * `deg` / `grad` / `rad` / `turn` unit, or `none`. NaN when it is none of those.
 */
function parseHue(token: string): number {
    if (token === 'none') return 0;
    // 'grad' is tried before its suffix 'rad'.
    const unit = Object.keys(DEGREES_PER_ANGLE_UNIT).find(u => token.endsWith(u));
    const digits = unit ? token.slice(0, -unit.length) : token;
    if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?$/.test(digits)) return Number.NaN;
    return Number(digits) * (DEGREES_PER_ANGLE_UNIT[unit ?? 'deg'] ?? 1);
}

function parseHslFunc(input: string): RGBA | null {
    const m = /^hsla?\(([^)]+)\)$/i.exec(input.trim());
    if (!m) return null;
    const parts = (m[1] ?? '').split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const h = parseHue((parts[0] ?? ''));
    const s = parseChannel((parts[1] ?? ''), 100);
    const l = parseChannel((parts[2] ?? ''), 100);
    const a = parts.length >= 4 ? parseChannel((parts[3] ?? ''), 1) : 1;
    if ([h, s, l, a].some(Number.isNaN)) return null;
    const rgb = hslToRgb({ h, s, l });
    return { ...rgb, a: clamp01(a) };
}

function parseOklchFunc(input: string): RGBA | null {
    const m = /^oklch\(([^)]+)\)$/i.exec(input.trim());
    if (!m) return null;
    const parts = (m[1] ?? '').split(/[\s,/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const l = parseChannel((parts[0] ?? ''), 1);
    const c = Math.max(0, parseChannel((parts[1] ?? ''), OKLCH_CHROMA_AT_100_PERCENT));
    const h = parseHue((parts[2] ?? ''));
    const a = parts.length >= 4 ? parseChannel((parts[3] ?? ''), 1) : 1;
    if ([l, c, h, a].some(Number.isNaN)) return null;
    const rgb = oklchToRgb({ l, c, h });
    return { ...rgb, a: clamp01(a) };
}

/**
 * Parse any CSS color string into RGBA. Supports:
 *  - #rgb / #rgba / #rrggbb / #rrggbbaa
 *  - rgb() / rgba()
 *  - hsl() / hsla()
 *  - oklch()
 *  - common named colors (transparent, black, white, red, green, blue, gray)
 *
 * Returns null on parse failure.
 */
export function parseColor(input: string): RGBA | null {
    if (!input) return null;
    const lowered = input.trim().toLowerCase();
    const named = NAMED_COLORS[lowered];
    if (named) return { ...named };
    if (lowered.startsWith('#')) return parseHex(lowered);
    if (lowered.startsWith('rgb')) return parseRgbFunc(lowered);
    if (lowered.startsWith('hsl')) return parseHslFunc(lowered);
    if (lowered.startsWith('oklch')) return parseOklchFunc(lowered);
    if (/^[\da-f]+$/i.test(lowered)) return parseHex(lowered);
    return null;
}


function hue2rgb(p: number, q: number, t: number): number {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
}

export function hslToRgb(c: HSL): RGB {
    const h = ((c.h % 360) + 360) % 360 / 360;
    const s = clamp01(c.s / 100);
    const l = clamp01(c.l / 100);
    if (s === 0) {
        const v = Math.round(l * 255);
        return { r: v, g: v, b: v };
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return {
        r: Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
        g: Math.round(hue2rgb(p, q, h) * 255),
        b: Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    };
}

function srgbToLinear(c: number): number {
    const x = c / 255;
    return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(c: number): number {
    const v = c <= 0.0031308 ? 12.92 * c : 1.055 * (c ** (1 / 2.4)) - 0.055;
    return clamp255(v * 255);
}

export function oklchToRgb(c: OKLCH): RGB {
    const hRad = (c.h * Math.PI) / 180;
    const A = c.c * Math.cos(hRad);
    const B = c.c * Math.sin(hRad);

    const lp = c.l + 0.3963377774 * A + 0.2158037573 * B;
    const mp = c.l - 0.1055613458 * A - 0.0638541728 * B;
    const sp = c.l - 0.0894841775 * A - 1.291485548 * B;

    const l = lp ** 3;
    const m = mp ** 3;
    const s = sp ** 3;

    const r = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const b = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

/**
 * WCAG 2.1 relative luminance (0..1). Used for contrast-ratio calculation.
 */
export function relativeLuminance(c: RGB): number {
    const r = srgbToLinear(c.r);
    const g = srgbToLinear(c.g);
    const b = srgbToLinear(c.b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.1 contrast ratio (1..21). Returns the larger:smaller luminance ratio.
 */
export function contrastRatio(a: RGB, b: RGB): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const lighter = Math.max(la, lb);
    const darker = Math.min(la, lb);
    return (lighter + 0.05) / (darker + 0.05);
}

const BLACK: RGB = { r: 0, g: 0, b: 0 };
const WHITE: RGB = { r: 255, g: 255, b: 255 };

/**
 * Pick whichever of black / white reads better on `background`.
 *
 * Components that paint text on a caller-supplied colour (kanban label badges,
 * org-chart avatars, …) used to hardcode `text-white`, which drops below WCAG AA
 * on any light background — e.g. white on emerald `#10b981` is 2.5:1, an axe
 * `color-contrast` failure. Deriving the foreground from the background's
 * luminance keeps the caller's colour and makes the text legible on all of them.
 *
 * A translucent `background` is judged as it is seen: composited over
 * `backdrop` (assumed opaque; its own alpha is ignored). The backdrop defaults
 * to white and falls back to it when unparseable.
 *
 * Falls back to white text when `background` cannot be parsed.
 */
export function readableForeground(background: string, backdrop = '#ffffff'): '#000000' | '#ffffff' {
    const bg = parseColor(background);
    if (!bg) return '#ffffff';
    const seen = compositeOver(bg, parseColor(backdrop) ?? WHITE);
    return contrastRatio(seen, BLACK) >= contrastRatio(seen, WHITE) ? '#000000' : '#ffffff';
}

/** Unrounded so a near-tie contrast decision is not flipped by 8-bit rounding. */
function compositeOver(fg: RGBA, backdrop: RGB): RGB {
    const over = (f: number, b: number): number => f * fg.a + b * (1 - fg.a);
    return { r: over(fg.r, backdrop.r), g: over(fg.g, backdrop.g), b: over(fg.b, backdrop.b) };
}
