/** Counting and cutting text the way a reader sees it (grapheme clusters, not UTF-16 units). */

/**
 * One shared segmenter: constructing `Intl.Segmenter` loads locale data, and the editor counts the
 * whole document on every keystroke while `maxLength` is set. `null` means unavailable.
 */
let sharedSegmenter: Intl.Segmenter | null | undefined;
function graphemeSegmenter(): Intl.Segmenter | null {
    sharedSegmenter ??= typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function' ? new Intl.Segmenter() : null;
    return sharedSegmenter;
}

/**
 * Number of user-perceived characters in a string. `length` counts UTF-16 units, so an emoji scores
 * 2 and a ZWJ family 11. Falls back to `length` if `Intl.Segmenter` is missing.
 */
export function graphemeLength(text: string): number {
    if (!text) return 0;
    const segmenter = graphemeSegmenter();
    if (!segmenter) return text.length;
    // Walk the iterator instead of Array.from: this runs per keystroke and skips a Segment allocation per grapheme.
    const segments = segmenter.segment(text)[Symbol.iterator]();
    let count = 0;
    while (!segments.next().done) count++;
    return count;
}

/** The first `count` user-perceived characters; unlike `substring` it never leaves a lone surrogate. */
export function truncateToGraphemes(text: string, count: number): string {
    if (count <= 0) return '';
    const segmenter = graphemeSegmenter();
    if (!segmenter) return text.substring(0, count);
    let out = '';
    let taken = 0;
    for (const { segment } of segmenter.segment(text)) {
        if (taken >= count) break;
        out += segment;
        taken++;
    }
    return out;
}
