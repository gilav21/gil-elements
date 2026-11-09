import { describe, expect, it } from 'vitest';
import { resolveCellKind } from './data-table-cell-kind.js';

describe('resolveCellKind', () => {
    it('prefers a tag over a renderer over text', () => {
        const cellRenderer = () => 'x';
        expect(resolveCellKind({ component: 'ge-badge', cellRenderer })).toBe('tag');
        expect(resolveCellKind({ cellRenderer })).toBe('renderer');
        expect(resolveCellKind({})).toBe('text');
    });
    it('ignores an empty tag name', () => {
        expect(resolveCellKind({ component: '' })).toBe('text');
        expect(resolveCellKind({ component: '', cellRenderer: () => 'x' })).toBe('renderer');
    });
});
