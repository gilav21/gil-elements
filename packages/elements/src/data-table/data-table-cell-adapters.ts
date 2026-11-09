/**
 * The registry of framework adapters (Angular, React, Vue) that render a non-string `component` into a cell. The core
 * never recognises a framework component itself: each adapter says what it `matches`. Adapters live in their own entry
 * points and register as a side effect.
 */
import type { CellAdapter, CellRendering } from './data-table.types.js';

const adapters: CellAdapter[] = [];

/** Registers an adapter; later registrations are checked first. The returned function unregisters exactly this one. */
export function registerCellAdapter(adapter: CellAdapter): () => void {
    adapters.unshift(adapter);
    return () => {
        const at = adapters.indexOf(adapter);
        if (at >= 0) adapters.splice(at, 1);
    };
}

/** The newest adapter matching `component`. Strings are tag names and never go through an adapter. */
export function findCellAdapter(component: unknown): CellAdapter | undefined {
    if (typeof component === 'string' || component == null) return undefined;
    return adapters.find((a) => a.matches(component));
}

const warned = new WeakSet<object>();

/**
 * Warns once per component that no adapter handles it (a framework component without its adapter entry point loaded).
 * Returns whether it warned.
 */
export function warnMissingAdapter(component: unknown, warn: (message: string) => void = console.warn): boolean {
    if (component == null || typeof component === 'string') return false;
    const key = component as object;
    if (typeof key !== 'object' && typeof key !== 'function') return false;
    if (warned.has(key)) return false;
    warned.add(key);
    warn('[ge-data-table] No cell adapter matches this component. Import the adapter entry point for its framework.');
    return true;
}

export type CellKind = 'adapter' | 'tag' | 'renderer' | 'text';

/**
 * How a cell is drawn, by precedence: a framework component with a matching adapter, a custom-element tag, a
 * `cellRenderer`, else text (`cell` or the raw value). A non-string component with no adapter falls through to the
 * next strategy; the caller can {@link warnMissingAdapter}.
 */
export function resolveCellKind<T>(column: Pick<CellRendering<T>, 'component' | 'cellRenderer'>): CellKind {
    const component = column.component;
    if (typeof component === 'string' && component !== '') return 'tag';
    if (component != null && typeof component !== 'string' && findCellAdapter(component)) return 'adapter';
    return column.cellRenderer ? 'renderer' : 'text';
}
