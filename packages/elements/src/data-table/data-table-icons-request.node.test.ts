import { describe, expect, it, vi } from 'vitest';

describe('ensureIconElement', () => {
    it('asks the lazy element to load ONCE however many icon cells call it per render (no promise allocated by the later calls)', async () => {
        vi.resetModules();
        const { ensureIconElement, iconElement } = await import('./data-table-icons.js');
        vi.spyOn(iconElement, 'ready').mockReturnValue(false);
        vi.spyOn(iconElement, 'failed').mockReturnValue(false);
        const load = vi.spyOn(iconElement, 'load').mockResolvedValue(false);
        for (let i = 0; i < 50; i++) ensureIconElement();
        expect(load).toHaveBeenCalledTimes(1);
    });
});
