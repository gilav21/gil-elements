/**
 * The addons that can be named in the `addons="..."` attribute, by id. An addon's `define` module registers itself here and imports
 * no element (unlike the rich-text editor's `registerAddon`), so an addon entry never pulls the table. A table already on the page
 * starts an addon it lists as soon as the addon registers.
 */
import type { DataTableAddon } from './data-table-addon-kit.js';

const addons = new Map<string, DataTableAddon>();
const listeners = new Set<() => void>();

/** Every registered addon by id (the registry an `AddonSet` resolves the attribute through). */
export const dataTableAddons: ReadonlyMap<string, DataTableAddon> = addons;

/** Makes `addon` available by its id; registering an id again replaces it. */
export function registerDataTableAddon<T>(addon: DataTableAddon<T>): void {
    addons.set(addon.id, addon as DataTableAddon);
    for (const listener of [...listeners]) listener();
}

export function getDataTableAddon(id: string): DataTableAddon | undefined {
    return addons.get(id);
}

/** `listener` runs after every registration; returns the way to stop. */
export function onDataTableAddonRegistered(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}
