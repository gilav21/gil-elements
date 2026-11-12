import { describe, expect, it, vi } from 'vitest';

const imports = vi.hoisted(() => ({ count: 0 }));
vi.mock('../icon/define.js', () => {
    imports.count++;
    return {};
});

describe('ensureIconElement', () => {
    it('asks the lazy element to load ONCE however many icon cells call it per render, from the element\'s own state (no flag of its own to go stale)', async () => {
        vi.stubGlobal('customElements', { get: () => undefined });
        const { ensureIconElement, iconElement } = await import('./data-table-icons.js');
        const load = vi.spyOn(iconElement, 'load');
        for (let i = 0; i < 50; i++) ensureIconElement();
        expect(load).toHaveBeenCalledTimes(1);
        expect(iconElement.requested()).toBe(true);
        await vi.waitFor(() => expect(imports.count).toBe(1));
        expect(imports.count).toBe(1);
        iconElement.reset(); // a direct reset: the next call asks again (nothing stale remembers the earlier request)
        expect(iconElement.requested()).toBe(false);
        ensureIconElement();
        expect(load).toHaveBeenCalledTimes(2);
        vi.unstubAllGlobals();
    });
});
