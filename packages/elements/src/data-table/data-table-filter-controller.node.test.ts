import { describe, expect, it, vi } from 'vitest';
import { FilterUiController } from './data-table-filter-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';

describe('FilterUiController at the joint step 0', () => {
    it('provides an inert filters service while attached, draws nothing, and unprovides at detach', () => {
        const unprovide = vi.fn();
        const provide = vi.fn(() => unprovide);
        const controller = new FilterUiController({ provide } as unknown as DataTableCoreHost<unknown>);
        controller.attach();
        expect(provide).toHaveBeenCalledWith('filters', expect.objectContaining({ isActive: expect.any(Function), advancedCount: expect.any(Function) }));
        const service = (provide.mock.calls[0] as unknown as [string, { isActive(key: string): boolean; hasAnyFloating(): boolean; advancedCount(): number }])[1];
        expect(service.isActive('a')).toBe(false);
        expect(service.hasAnyFloating()).toBe(false);
        expect(service.advancedCount()).toBe(0);
        expect(controller.renderToolbar()).toBeNull();
        controller.detach();
        expect(unprovide).toHaveBeenCalledTimes(1);
    });
});
