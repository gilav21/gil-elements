import { describe, expect, it, vi } from 'vitest';
import { AddonSet, type DataTableAddon, type DataTableAddonHost } from './data-table-addon-kit.js';
import { dataTableAddons, getDataTableAddon, onDataTableAddonRegistered, registerDataTableAddon } from './data-table-addon-registry.js';

const host = { subscribe: () => () => undefined } as unknown as DataTableAddonHost;

describe('the addons service: busy labels per addon (review)', () => {
    it('shows the most recent label while any addon is busy, and clears all at once', async () => {
        const { createAddonsService } = await import('./data-table-addon-host-controller.js');
        const service = createAddonsService(() => undefined);
        service.setBusy('Exporting', 'export');
        service.setBusy('Pivoting', 'pivot');
        expect(service.busyLabel()).toBe('Pivoting');
        service.setBusy(null, 'pivot');
        expect(service.busyLabel()).toBe('Exporting'); // the other addon is still busy
        service.setBusy('Pivoting', 'pivot');
        service.clearBusy();
        expect(service.busyLabel()).toBeNull();
    });
});

describe('the data-table addon registry', () => {
    it('finds a registered addon by id, and a second registration of the id replaces it', () => {
        const first: DataTableAddon = { id: 'registry-test-a', setup: () => undefined };
        const second: DataTableAddon = { id: 'registry-test-a', setup: () => undefined };
        registerDataTableAddon(first);
        expect(getDataTableAddon('registry-test-a')).toBe(first);
        expect(dataTableAddons.get('registry-test-a')).toBe(first);
        registerDataTableAddon(second);
        expect(getDataTableAddon('registry-test-a')).toBe(second);
        expect(getDataTableAddon('registry-test-none')).toBeUndefined();
    });

    it('tells its listeners after each registration, until they stop listening', () => {
        const listener = vi.fn();
        const stop = onDataTableAddonRegistered(listener);
        registerDataTableAddon({ id: 'registry-test-b', setup: () => undefined });
        stop();
        registerDataTableAddon({ id: 'registry-test-c', setup: () => undefined });
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('is the registry an AddonSet resolves the attribute through: an id listed before its module registered starts on the sync it triggers', () => {
        vi.spyOn(console, 'warn').mockImplementation(() => undefined);
        const set = new AddonSet(host, dataTableAddons);
        const stop = onDataTableAddonRegistered(() => set.sync());
        set.start();
        set.configure('registry-test-late', {});
        const setup = vi.fn();
        registerDataTableAddon({ id: 'registry-test-late', setup });
        expect(setup).toHaveBeenCalledTimes(1);
        stop();
        set.stop();
    });
});
