import { describe, expect, it, vi } from 'vitest';
import { FilterUiController } from './data-table-filter-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';
import { lazyElement } from './data-table-lazy.js';

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

describe('FilterUiController.prefetch', () => {
    it('reports a failed lazy load once per element instead of swallowing it, and tries again after the next attach', async () => {
        const host = { provide: () => () => undefined } as unknown as DataTableCoreHost<unknown>;
        const controller = new FilterUiController(host);
        const builderError = vi.fn();
        const panelsError = vi.fn();
        const builderImport = vi.fn(() => Promise.reject(new Error('builder 404')));
        const panelsImport = vi.fn(() => Promise.reject(new Error('panels 404')));
        Object.assign(controller, {
            builder: lazyElement('ge-b', builderImport, builderError),
            panels: lazyElement('ge-p', panelsImport, panelsError),
        });
        for (let hover = 0; hover < 4; hover++) {
            controller.prefetch();
            await flush();
        }
        expect(builderImport).toHaveBeenCalledTimes(1);
        expect(panelsImport).toHaveBeenCalledTimes(1);
        expect(builderError).toHaveBeenCalledTimes(1);
        expect(panelsError).toHaveBeenCalledTimes(1);
        controller.attach();
        controller.prefetch();
        await flush();
        expect(builderImport).toHaveBeenCalledTimes(2);
        expect(panelsError).toHaveBeenCalledTimes(2);
    });
});
