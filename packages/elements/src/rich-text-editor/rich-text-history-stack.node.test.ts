import { describe, expect, it } from 'vitest';
import { applyDelta, buildHistoryPreview, computeDelta, HistoryStack } from './rich-text-history-stack.js';

const stripTags = (markup: string) => markup.replaceAll(/<[^>]*>/g, '');
const newStack = (limit = 100) => new HistoryStack(() => limit, (html) => buildHistoryPreview(html, stripTags));

interface Internals {
    entries: {
        html: string;
        delta: string | null;
        keyframe: boolean;
        selection: null;
        timestamp: number;
        preview: string;
        previewLines: string[];
        lineCount: number;
    }[];
}

describe('history delta algorithm', () => {
    const roundTrip = (prev: string, current: string) => applyDelta(prev, computeDelta(prev, current));

    it('round-trips an inserted line', () => {
        const current = 'line1\nINSERTED\nline2\nline3';
        expect(roundTrip('line1\nline2\nline3', current)).toBe(current);
    });

    it('round-trips a removed line', () => {
        expect(roundTrip('a\nb\nc\nd', 'a\nc\nd')).toBe('a\nc\nd');
    });

    it('round-trips a changed line', () => {
        const current = 'alpha\nBETA-CHANGED\ngamma';
        expect(roundTrip('alpha\nbeta\ngamma', current)).toBe(current);
    });

    it('round-trips trailing additions and removals', () => {
        expect(roundTrip('x\ny', 'x\ny\nz\nw')).toBe('x\ny\nz\nw');
        expect(roundTrip('x\ny\nz\nw', 'x\ny')).toBe('x\ny');
    });

    it('returns base unchanged for an empty delta', () => {
        expect(applyDelta('base\ncontent', '')).toBe('base\ncontent');
    });

    it('round-trips a swap where both directions match', () => {
        expect(roundTrip('a\nb', 'b\na')).toBe('b\na');
    });

    it('ignores a keep op that points outside the base', () => {
        expect(applyDelta('a', '=0\x01=9\x01+z')).toBe('a\nz');
    });
});

describe('buildHistoryPreview', () => {
    it('keeps up to three lines and counts them all', () => {
        const html = '<p>Line one</p><p>Line two</p><p>Line three</p><p>Line four</p>';
        expect(buildHistoryPreview(html, stripTags)).toMatchObject({
            lineCount: 4,
            previewLines: ['Line one', 'Line two', 'Line three'],
        });
    });

    it('marks list items with a bullet', () => {
        const preview = buildHistoryPreview('<ul><li>First item</li><li>Second item</li></ul>', stripTags);
        expect(preview.previewLines).toEqual(['• First item', '• Second item']);
    });

    it('describes an empty document', () => {
        expect(buildHistoryPreview('', stripTags)).toEqual({ preview: '(empty)', previewLines: ['(empty)'], lineCount: 1 });
    });

    it('truncates the single-line preview', () => {
        expect(buildHistoryPreview(`<p>${'x'.repeat(300)}</p>`, stripTags).preview).toHaveLength(120);
    });
});

describe('HistoryStack', () => {
    it('reconstructs every entry across keyframes and deltas, walking back and forward exactly', () => {
        const stack = newStack();
        const docs = Array.from({ length: 13 }, (_, i) => `<p>v${i}</p>`);
        for (const doc of docs) stack.push(doc, null);
        const entries = (stack as unknown as Internals).entries;
        expect(entries.some((e) => e.keyframe)).toBe(true);
        expect(entries.some((e) => !e.keyframe)).toBe(true);

        const walked = [...docs].reverse().map((_, i) => stack.moveTo(docs.length - 1 - i)?.html);
        expect(walked).toEqual([...docs].reverse());
        expect(docs.map((_, i) => stack.moveTo(i)?.html)).toEqual(docs);
    });

    it('does not record content equal to the current entry', () => {
        const stack = newStack();
        expect(stack.push('<p>a</p>', null)).toBe(true);
        expect(stack.push('<p>a</p>', null)).toBe(false);
        expect(stack.size).toBe(1);
    });

    it('drops the redo branch when new content is pushed after an undo', () => {
        const stack = newStack();
        for (const doc of ['<p>A</p>', '<p>AB</p>']) stack.push(doc, null);
        stack.moveTo(0);
        expect(stack.canRedo).toBe(true);

        stack.push('<p>AC</p>', null);

        expect(stack.canRedo).toBe(false);
        expect(stack.snapshots().map((s) => s.preview)).toEqual(['A', 'AC']);
        expect(stack.html(1)).toBe('<p>AC</p>');
    });

    it('stores a delta against the current entry, not the abandoned branch tail', () => {
        const stack = newStack();
        for (const doc of ['<p>1</p>\n<p>x</p>', '<p>1</p>\n<p>x</p>\n<p>2</p>\n<p>3</p>']) stack.push(doc, null);
        stack.moveTo(0);

        stack.push('<p>1</p>\n<p>y</p>', null);

        expect(stack.html(1)).toBe('<p>1</p>\n<p>y</p>');
    });

    it('trims to the limit, keeping the newest entries reconstructable', () => {
        const stack = newStack(10);
        for (let i = 0; i < 15; i++) stack.push(`<p>entry ${i}</p>`, null);

        expect(stack.size).toBe(10);
        expect(stack.index).toBe(9);
        const kept = Array.from({ length: 10 }, (_, i) => stack.html(i));
        expect(kept).toEqual(Array.from({ length: 10 }, (_, i) => `<p>entry ${i + 5}</p>`));
    });

    it('floors the limit at ten entries', () => {
        const stack = newStack(1);
        for (let i = 0; i < 12; i++) stack.push(`<p>${i}</p>`, null);
        expect(stack.size).toBe(10);
    });

    it('reports bounds through html and moveTo', () => {
        const stack = newStack();
        stack.push('<p>a</p>', null);
        expect(stack.html(-1)).toBeNull();
        expect(stack.html(1)).toBeNull();
        expect(stack.moveTo(5)).toBeNull();
        expect(stack.index).toBe(0);
    });

    it('tracks undo and redo availability', () => {
        const stack = newStack();
        expect([stack.canUndo, stack.canRedo]).toEqual([false, false]);
        stack.push('<p>a</p>', null);
        stack.push('<p>b</p>', null);
        expect([stack.canUndo, stack.canRedo]).toEqual([true, false]);
        stack.moveTo(0);
        expect([stack.canUndo, stack.canRedo]).toEqual([false, true]);
    });

    it('falls back to an entry\'s own html when it carries no delta (white-box)', () => {
        const stack = newStack();
        stack.push('<p>seed</p>', null);
        const [base] = (stack as unknown as Internals).entries;
        (stack as unknown as Internals).entries = [
            { ...base!, html: '<p>a</p>', delta: null, keyframe: true },
            { ...base!, html: '<p>b</p>', delta: null, keyframe: true },
            { ...base!, html: '<p>c</p>', delta: null, keyframe: false },
        ];

        expect(stack.html(2)).toBe('<p>c</p>');
    });

    it('survives an entry whose keyframe flag changes between reads (white-box)', () => {
        const stack = newStack();
        stack.push('<p>seed</p>', null);
        const [base] = (stack as unknown as Internals).entries;
        const flaky = { ...base!, html: '<p>flaky</p>', delta: null, keyframe: false };
        let reads = 0;
        Object.defineProperty(flaky, 'keyframe', {
            get: () => {
                reads += 1;
                return reads > 2;
            },
            configurable: true,
        });
        (stack as unknown as Internals).entries = [{ ...base!, html: '<p>a</p>', delta: null, keyframe: true }, flaky];

        expect(stack.html(1)).toBe('<p>flaky</p>');
    });
});
