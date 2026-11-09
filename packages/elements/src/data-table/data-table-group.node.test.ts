import { describe, expect, it } from 'vitest';
import { buildGroupedDisplayRows, dataRowsOf, groupAggregates, isGroupingActive, partitionIntoGroups, renumberDataRows } from './data-table-group.js';
import type { ColumnDef, DataTableDisplayRow } from './data-table.types.js';

interface Row {
    team: string;
    pts: number;
}
const ROWS: Row[] = [
    { team: 'b', pts: 1 },
    { team: 'a', pts: 2 },
    { team: 'b', pts: 3 },
    { team: 'constructor', pts: 4 },
];
const COLS: ColumnDef<Row>[] = [
    { accessorKey: 'team', header: 'T' },
    { accessorKey: 'pts', header: 'P', aggregateFn: 'sum' },
];
const groups = () => partitionIntoGroups(ROWS, (r) => r.team);

describe('partitionIntoGroups', () => {
    it('groups in first-seen order and stringifies keys', () => {
        expect(groups().map((g) => [g.groupKey, g.rows.length])).toEqual([['b', 2], ['a', 1], ['constructor', 1]]);
        const g = partitionIntoGroups([{ v: 1 }, { v: '1' }, { v: null }], (r) => r.v);
        expect(g.map((x) => x.groupKey)).toEqual(['1', 'null']);
    });
    it('handles empty input', () => {
        expect(partitionIntoGroups([], () => 'x')).toEqual([]);
    });
});

describe('grouping gate', () => {
    it('is off with tree mode, virtual scroll, or no column', () => {
        expect(isGroupingActive('team', false, false)).toBe(true);
        expect(isGroupingActive('team', true, false)).toBe(false);
        expect(isGroupingActive('team', false, true)).toBe(false);
        expect(isGroupingActive('', false, false)).toBe(false);
        expect(isGroupingActive(null, false, false)).toBe(false);
    });
});

describe('buildGroupedDisplayRows (rendered row index)', () => {
    it('numbers data rows in drawn order, headers not counted', () => {
        const rows = buildGroupedDisplayRows(groups(), {}, COLS, false);
        expect(rows.map((r) => (r.kind === 'group' ? `G:${r.groupKey}` : r.index))).toEqual(['G:b', 0, 1, 'G:a', 2, 'G:constructor', 3]);
        expect(dataRowsOf(rows).map((r) => r.pts)).toEqual([1, 3, 2, 4]);
    });
    it('skips the rows of a collapsed group and keeps numbering consecutive', () => {
        const rows = buildGroupedDisplayRows(groups(), { b: true }, COLS, false);
        expect(rows.map((r) => (r.kind === 'group' ? `G:${r.groupKey}:${r.collapsed}` : r.index))).toEqual(['G:b:true', 'G:a:false', 0, 'G:constructor:false', 1]);
    });
    it('only own entries collapse a group (a data value named like a prototype member is not collapsed)', () => {
        const rows = buildGroupedDisplayRows(groups(), {}, COLS, false);
        expect(rows.find((r) => r.kind === 'group' && r.groupKey === 'constructor')).toMatchObject({ collapsed: false });
    });
    it('computes aggregates per group in column order when asked', () => {
        const rows = buildGroupedDisplayRows(groups(), {}, COLS, true);
        const first = rows[0];
        expect(first?.kind === 'group' && [...first.aggregates]).toEqual([['pts', '4']]);
        expect(groupAggregates(ROWS, COLS, false).size).toBe(0);
    });
});

describe('renumberDataRows', () => {
    it('restarts the count on a page slice and leaves headers alone', () => {
        const all = buildGroupedDisplayRows(groups(), {}, COLS, false);
        const page = renumberDataRows(all.slice(3));
        expect(page.map((r) => (r.kind === 'group' ? 'G' : r.index))).toEqual(['G', 0, 'G', 1]);
        expect(page[0]).toBe(all[3]);
    });
    it('copes with an empty list and does not mutate', () => {
        expect(renumberDataRows([])).toEqual([]);
        const src: DataTableDisplayRow<Row>[] = [{ kind: 'data', row: ROWS[0] as Row, index: 5 }];
        renumberDataRows(src);
        expect(src[0]).toMatchObject({ index: 5 });
    });
});
