import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { InteractionContext } from './data-table-cell-session.js';
import { EditSession } from './data-table-edit-session.js';
import { RangeSession } from './data-table-range-session.js';

const DIRECTORY = new URL('.', import.meta.url);
const SOURCES = readdirSync(DIRECTORY).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
const read = (name: string): string => readFileSync(new URL(name, DIRECTORY), 'utf8');
const context = {} as InteractionContext<unknown>;

describe('the joint step 0 sessions', () => {
    it('answers "nothing is being edited" and no editor can open', () => {
        const { service } = new EditSession(context);
        expect(service.editingCell?.()).toBeNull();
        expect(service.cellEditError?.()).toBeNull();
        expect(service.startEditing?.({}, 'name')).toBe(false);
        expect(service.isEditing?.(0, 'name')).toBe(false);
        expect(service.editValue?.()).toBeUndefined();
        expect(() => [service.commitEdit?.(), service.cancelEdit?.(), service.setEditValue?.(1)]).not.toThrow();
    });

    it('answers "no range" and no gesture, and fills nothing', () => {
        const session = new RangeSession(context);
        expect(session.service.cellRange()).toBeNull();
        expect(session.service.isCellSelected(0, 'name')).toBe(false);
        const range = session.rangeService;
        expect(range.range()).toBeNull();
        expect(range.normalized()).toBeNull();
        expect(range.isInRange(0, 'name')).toBe(false);
        expect(range.isFillPreview(0, 'name')).toBe(false);
        expect(range.stats()).toBeNull();
        expect(range.chartPayload()).toBeNull();
        expect(range.fillDownTo(3)).toBe(false);
        expect(range.fillHandleCell()).toBeNull();
        expect(range.gestureActive()).toBe(false);
    });
});

describe('key handlers', () => {
    it.each(SOURCES)('%s registers its handlers with KEY_PRIORITY, never a literal number', (name) => {
        expect(read(name)).not.toMatch(/addKeyHandler\(\s*\d/);
    });

    it('has every handler of the chain on a priority of the one table', () => {
        const users = SOURCES.filter((name) => /addKeyHandler\(\s*KEY_PRIORITY\./.test(read(name)));
        expect(users).toEqual(
            expect.arrayContaining([
                'data-table-cell-interaction-controller.ts',
                'data-table-column-drag-controller.ts',
                'data-table-expansion-controller.ts',
                'data-table-resize-controller.ts',
                'data-table-selection-controller.ts',
            ]),
        );
    });
});

describe('the session files', () => {
    it('import no controller (the boundary rule), only the contract and providers', () => {
        for (const name of ['data-table-edit-session.ts', 'data-table-range-session.ts', 'data-table-cell-session.ts', 'lazy/range.ts']) {
            for (const [, specifier] of read(name).matchAll(/(?:from|import\s*\()\s*['"]([^'"]+)['"]/g)) expect(specifier).not.toMatch(/controller/);
        }
    });
});
