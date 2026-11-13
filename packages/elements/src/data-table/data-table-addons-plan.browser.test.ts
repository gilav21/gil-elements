/** Wave 7 step 0 (final review): the addon host on tables whose plan lacks a controller (no cell-interaction: no roving cell; no addon-host). */
import { describe, expect, it, vi } from 'vitest';
import { mountTable, qa, settle } from './data-table-fixtures.js';

const plan = vi.hoisted(() => ({ without: [] as string[] }));
vi.mock('./data-table-factories.js', async (importOriginal) => {
    const original = await importOriginal<typeof import('./data-table-factories.js')>();
    return {
        ...original,
        createFactories: <T,>() => {
            const factories = original.createFactories<T>() as Record<string, unknown>;
            for (const id of plan.without) delete factories[id];
            return factories as ReturnType<typeof original.createFactories<T>>;
        },
    };
});

describe('a plan without cell-interaction (no roving cell)', () => {
    it('keeps the row action buttons in the tab order, like the other in-cell controls', async () => {
        plan.without = ['cell-interaction', 'clipboard'];
        const table = await mountTable();
        let register: ((id: string) => void) | undefined;
        table.use({ id: 'plan-probe', setup: (host) => void (register = (id) => host.registerCellAction({ id, onClick: () => undefined })) });
        register!('menu');
        await settle(table);
        const buttons = qa(table, '[data-action-id="menu"]');
        expect(buttons).toHaveLength(4);
        expect(buttons.every((b) => !b.hasAttribute('tabindex'))).toBe(true);
    });
});

describe('a plan without addon-host', () => {
    it('lets an addon set and clear its busy label, and tears it down, without throwing', async () => {
        plan.without = ['addon-host'];
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const table = await mountTable();
        const off = table.use({ id: 'busy-probe', setup: (host) => host.setBusy('Working') });
        expect(() => off()).not.toThrow();
        expect(() => table.remove()).not.toThrow();
        expect(error).not.toHaveBeenCalled();
        error.mockRestore();
    });
});
