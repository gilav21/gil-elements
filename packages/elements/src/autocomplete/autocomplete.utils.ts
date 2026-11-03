export interface TextPart {
    text: string;
    /** True for the pieces that matched the search. */
    hit: boolean;
}

/**
 * Splits `text` around every case-insensitive occurrence of `search`. The search is matched as plain text, so
 * `(` or `.` typed into the box means exactly those characters, and the label is never read as markup.
 */
export function splitMatches(text: string, search: string): TextPart[] {
    if (!search) return [{ text, hit: false }];
    const escaped = search.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    return text
        .split(new RegExp(`(${escaped})`, 'i'))
        .map((piece, index) => ({ text: piece, hit: index % 2 === 1 }))
        .filter((part) => part.text !== '');
}
