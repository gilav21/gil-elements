import { describe, expect, it, vi } from 'vitest';

vi.mock('../icon/define.js', () => {
    throw new Error('chunk failed');
});

describe('resetIconElement', () => {
    it('retries a failed ge-icon import at most once per page, however many tables connect', async () => {
        vi.stubGlobal('customElements', { get: () => undefined });
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { ensureIconElement, iconElement, resetIconElement } = await import('./data-table-icons.js');
        ensureIconElement();
        await vi.waitFor(() => expect(iconElement.failed()).toBe(true));
        expect(error).toHaveBeenCalledTimes(1);
        for (let connect = 0; connect < 5; connect++) {
            resetIconElement(); // a table attaches
            ensureIconElement();
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        expect(error.mock.calls.length).toBeLessThanOrEqual(2); // the first failure and ONE retry
        error.mockRestore();
        vi.unstubAllGlobals();
    });
});
