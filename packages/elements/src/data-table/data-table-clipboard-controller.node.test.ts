import { describe, expect, it, vi } from 'vitest';
import { ClipboardController } from './data-table-clipboard-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';

describe('ClipboardController', () => {
    it('asks for no render when its paste part attaches: nothing is drawn from it', async () => {
        const requestRender = vi.fn();
        const host = { config: { enableClipboardPaste: true }, provide: () => () => undefined, requestRender } as unknown as DataTableCoreHost<unknown>;
        const controller = new ClipboardController(host);
        controller.attach();
        controller.hostUpdate();
        await new Promise((resolve) => setTimeout(resolve, 20)); // the lazy module loads and the part attaches
        expect(requestRender).not.toHaveBeenCalled();
        controller.detach();
    });
});
