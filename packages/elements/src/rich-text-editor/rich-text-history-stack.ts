import type { RichTextHistoryEntrySnapshot } from './rich-text-host.js';

/** A selection stored as child-index paths from the editable, so it survives a content rewrite. */
export interface SerializedSelection {
    readonly startPath: readonly number[];
    readonly startOffset: number;
    readonly endPath: readonly number[];
    readonly endOffset: number;
}

export interface HistoryPreview {
    preview: string;
    previewLines: string[];
    lineCount: number;
}

interface HistoryEntry extends HistoryPreview {
    /** Full content for a keyframe, empty for a delta entry. */
    html: string;
    delta: string | null;
    keyframe: boolean;
    selection: SerializedSelection | null;
    timestamp: number;
}

export interface HistoryTarget {
    readonly html: string;
    readonly selection: SerializedSelection | null;
}

export const DEFAULT_HISTORY_LIMIT = 100;
export const DEFAULT_HISTORY_DEBOUNCE_MS = 450;
const MIN_HISTORY_LIMIT = 10;
const KEYFRAME_INTERVAL = 10;
const LOOKAHEAD = 5;
const OP_SEPARATOR = '\x01';

const blockAware = (html: string): string =>
    html.replaceAll(/<br\s*\/?>/gi, '\n').replaceAll(/<\/(p|div|li|h[1-6]|blockquote|pre|tr)>/gi, '\n');

/** Single-line and per-line plain-text previews of a document; list items get a bullet. */
export function buildHistoryPreview(html: string, stripTags: (markup: string) => string): HistoryPreview {
    const plain = stripTags(blockAware(html).replaceAll(/<li[^>]*>/gi, '• '));
    const lines = plain
        .split('\n')
        .map((line) => line.replaceAll(/<\/?[^>]{1,4096}>/g, '').replaceAll(/\s{1,4096}/g, ' ').trim())
        .filter(Boolean);
    const shown = lines.length > 0 ? lines : ['(empty)'];
    return { preview: shown.join(' ').slice(0, 120), previewLines: shown.slice(0, 3), lineCount: shown.length };
}

function lookahead(prev: string[], cur: string[], pi: number, ci: number): { foundPrev: number; foundCur: number } {
    let foundPrev = -1;
    let foundCur = -1;
    for (let look = 1; look <= LOOKAHEAD && foundPrev === -1 && foundCur === -1; look++) {
        if (ci + look < cur.length && prev[pi] === cur[ci + look]) foundCur = ci + look;
        if (pi + look < prev.length && prev[pi + look] === cur[ci]) foundPrev = pi + look;
    }
    return { foundPrev, foundCur };
}

/** Line-level edit script turning `prev` into `current`: `=n` keeps base line n, `+text` inserts a line. */
export function computeDelta(prev: string, current: string): string {
    const a = prev.split('\n');
    const b = current.split('\n');
    const ops: string[] = [];
    let pi = 0;
    let ci = 0;
    while (pi < a.length && ci < b.length) {
        if (a[pi] === b[ci]) {
            ops.push(`=${pi++}`);
            ci++;
            continue;
        }
        const { foundPrev, foundCur } = lookahead(a, b, pi, ci);
        if (foundCur !== -1 && (foundPrev === -1 || foundCur - ci <= foundPrev - pi)) {
            for (; ci < foundCur; ci++) ops.push(`+${b[ci]}`);
            ops.push(`=${pi++}`);
            ci++;
        } else if (foundPrev === -1) {
            ops.push(`+${b[ci++]}`);
            pi++;
        } else {
            ops.push(`=${foundPrev}`);
            pi = foundPrev + 1;
            ci++;
        }
    }
    for (; ci < b.length; ci++) ops.push(`+${b[ci]}`);
    return ops.join(OP_SEPARATOR);
}

export function applyDelta(base: string, delta: string): string {
    if (!delta) return base;
    const baseLines = base.split('\n');
    const result: string[] = [];
    for (const op of delta.split(OP_SEPARATOR)) {
        const value = op.slice(1);
        if (op.startsWith('+')) {
            result.push(value);
        } else if (op.startsWith('=')) {
            const line = baseLines[Number.parseInt(value, 10)];
            if (line !== undefined) result.push(line);
        }
    }
    return result.join('\n');
}

/**
 * The undo stack: every tenth entry (and the head) stores the full document, the rest a line delta
 * against their predecessor. Pure, so it needs no DOM.
 */
export class HistoryStack {
    private entries: HistoryEntry[] = [];
    private position = -1;
    private cache = { index: -1, html: '' };

    constructor(
        private readonly limit: () => number,
        private readonly previewOf: (html: string) => HistoryPreview,
        private readonly now: () => number = Date.now,
    ) {}

    get size(): number {
        return this.entries.length;
    }

    get index(): number {
        return this.position;
    }

    get canUndo(): boolean {
        return this.position > 0;
    }

    get canRedo(): boolean {
        return this.position < this.entries.length - 1;
    }

    /** The content at the current position, or null on an empty stack. */
    get current(): string | null {
        return this.html(this.position);
    }

    html(index: number): string | null {
        if (index < 0 || index >= this.entries.length) return null;
        if (this.cache.index !== index) this.cache = { index, html: this.rebuild(index) };
        return this.cache.html;
    }

    /** Records `html` after the current position, dropping any redo branch. False when it equals the current content. */
    push(html: string, selection: SerializedSelection | null): boolean {
        const base = this.current;
        if (base === html) return false;
        this.entries.length = this.position + 1;
        const keyframe = base === null || this.entries.length % KEYFRAME_INTERVAL === 0;
        this.entries.push({
            html: keyframe ? html : '',
            delta: keyframe || base === null ? null : computeDelta(base, html),
            keyframe,
            selection,
            timestamp: this.now(),
            ...this.previewOf(html),
        });
        this.position = this.entries.length - 1;
        this.cache = { index: this.position, html };
        this.trim();
        return true;
    }

    /** Moves to `index` and returns what to show there; null when out of range. */
    moveTo(index: number): HistoryTarget | null {
        const html = this.html(index);
        const entry = this.entries[index];
        if (html === null || !entry) return null;
        this.position = index;
        return { html, selection: entry.selection };
    }

    snapshots(): RichTextHistoryEntrySnapshot[] {
        return this.entries.map(({ timestamp, preview, previewLines, lineCount }, index) => ({
            index,
            timestamp,
            preview,
            previewLines,
            lineCount,
        }));
    }

    private rebuild(index: number): string {
        let start = index;
        while (start > 0 && !this.entries[start]?.keyframe) start--;
        let html = this.entries[start]?.html ?? '';
        for (let i = start + 1; i <= index; i++) {
            const entry = this.entries[i];
            if (entry) html = entry.delta === null ? entry.html : applyDelta(html, entry.delta);
        }
        return html;
    }

    /** Drops the oldest entries past the limit; the head is always a keyframe so every entry still rebuilds. */
    private trim(): void {
        const max = Math.max(MIN_HISTORY_LIMIT, this.limit());
        while (this.entries.length > max) {
            const nextHead = this.entries[1];
            if (nextHead && !nextHead.keyframe) {
                nextHead.html = this.rebuild(1);
                nextHead.keyframe = true;
                nextHead.delta = null;
            }
            this.entries.shift();
            this.position--;
            this.cache.index--;
        }
    }
}
