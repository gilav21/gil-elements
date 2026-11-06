import { describe, expect, it } from 'vitest';
import { isPageData, mergeInputs, nextFreeRow, normaliseLength, resolveInputType, resolvePath, toDashboardItem } from './page-builder.utils.js';
import type { ComponentMeta, PageItemData } from './page-builder.types.js';

describe('resolveInputType', () => {
    it('reads the type from the live value before anything else', () => {
        expect(resolveInputType('title', 'x', { title: 3 }, null)).toBe('number');
        expect(resolveInputType('title', 5, { title: true }, null)).toBe('boolean');
    });

    it('falls back to the default, then the declared type, then the naming convention, then text', () => {
        expect(resolveInputType('size', 12, undefined, null)).toBe('number');
        expect(resolveInputType('size', undefined, undefined, 'number')).toBe('number');
        expect(resolveInputType('isOpen', undefined, undefined, null)).toBe('boolean');
        expect(resolveInputType('hasIcon', undefined, undefined, null)).toBe('boolean');
        expect(resolveInputType('label', undefined, undefined, null)).toBe('string');
    });
});

describe('mergeInputs', () => {
    it('lets a hand-written definition win by name and appends the ones the element lacks', () => {
        const merged = mergeInputs([{ name: 'variant', type: 'string' }, { name: 'label', type: 'string' }], [{ name: 'variant', type: 'select', options: ['a', 'b'] }, { name: 'extra', type: 'json' }]);
        expect(merged).toEqual([{ name: 'variant', type: 'select', options: ['a', 'b'] }, { name: 'label', type: 'string' }, { name: 'extra', type: 'json' }]);
    });
});

describe('normaliseLength', () => {
    it('adds px to a bare number and keeps every other string as typed', () => {
        expect(normaliseLength('20')).toBe('20px');
        expect(normaliseLength('1.5')).toBe('1.5px');
        expect(normaliseLength('1fr')).toBe('1fr');
        expect(normaliseLength('2rem')).toBe('2rem');
        expect(normaliseLength('')).toBe('');
        expect(normaliseLength('1e3')).toBe('1e3px');
    });
});

describe('nextFreeRow', () => {
    it('is the first row below the lowest item, and 0 for an empty board', () => {
        expect(nextFreeRow([])).toBe(0);
        expect(nextFreeRow([{ y: 0, rows: 2 }, { y: 4, rows: 3 }, { y: 1, rows: 1 }])).toBe(7);
    });
});

describe('resolvePath', () => {
    const context = { user: { name: 'Dana', address: { city: 'Haifa' } }, count: 0 };
    it('follows dots and treats a missing step, an empty path and null as undefined', () => {
        expect(resolvePath(context, 'user.name')).toBe('Dana');
        expect(resolvePath(context, 'user.address.city')).toBe('Haifa');
        expect(resolvePath(context, 'count')).toBe(0);
        expect(resolvePath(context, 'user.phone.number')).toBeUndefined();
        expect(resolvePath(context, '')).toBeUndefined();
        expect(resolvePath({ a: null }, 'a.b')).toBeUndefined();
    });
});

describe('toDashboardItem', () => {
    const palette: ComponentMeta[] = [{ id: 'badge', name: 'Badge', category: 'Display', tag: 'ge-badge' }];
    const saved: PageItemData = { id: 'a', x: 1, y: 3, cols: 2, rows: 2, componentId: 'badge', inputs: { label: 'New' }, bindings: { label: 'user.name' } };

    it('carries geometry, inputs and bindings, and names the item after its palette entry', () => {
        expect(toDashboardItem(saved, palette)).toEqual({ id: 'a', x: 1, y: 3, cols: 2, rows: 2, content: 'Badge', componentId: 'badge', inputs: { label: 'New' }, bindings: { label: 'user.name' } });
    });

    it('defaults missing inputs and bindings to empty objects', () => {
        expect(toDashboardItem({ ...saved, inputs: undefined, bindings: undefined }, palette)).toMatchObject({ inputs: {}, bindings: {} });
    });

    it('drops an item whose component the palette no longer has', () => {
        expect(toDashboardItem({ ...saved, componentId: 'gone' }, palette)).toBeNull();
    });
});

describe('isPageData', () => {
    it('needs a grid and an items array', () => {
        expect(isPageData({ grid: {}, items: [] })).toBe(true);
        expect(isPageData({ grid: {} })).toBe(false);
        expect(isPageData({ items: [] })).toBe(false);
        expect(isPageData(null)).toBe(false);
        expect(isPageData('x')).toBe(false);
    });
});
