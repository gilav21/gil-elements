/** The fluent `columnHelper<T>()` builder. Control columns are pinned left by the table itself, hence `pin: 'left'`. */
import type { ColumnDef } from './data-table.types.js';

type AccessorOptions<T> = Omit<ColumnDef<T>, 'accessorKey' | 'header'>;

const CONTROL = { header: '', enableSorting: false, enableHiding: false, enableReordering: false } as const;

export interface ColumnBuilder<T> {
    select(options?: Partial<ColumnDef<T>>): ColumnBuilder<T>;
    expander(options?: Partial<ColumnDef<T>>): ColumnBuilder<T>;
    actions(options?: Partial<ColumnDef<T>>): ColumnBuilder<T>;
    accessor<K extends keyof T & string>(key: K, header: string, options?: AccessorOptions<T>): ColumnBuilder<T>;
    /** A column drawn by a function; shorthand for `accessor` with `cellRenderer`. */
    renderer<K extends keyof T & string>(
        key: K,
        header: string,
        cellRenderer: NonNullable<ColumnDef<T>['cellRenderer']>,
        options?: AccessorOptions<T>,
    ): ColumnBuilder<T>;
    /** A column drawn by a custom element (tag name, e.g. `'ge-badge'`). */
    component<K extends keyof T & string>(key: K, header: string, tag: string, options?: AccessorOptions<T>): ColumnBuilder<T>;
    custom(column: ColumnDef<T>): ColumnBuilder<T>;
    /** A copy of the columns so far; later calls on the builder do not change it. */
    build(): ColumnDef<T>[];
}

export function columnHelper<T>(): ColumnBuilder<T> {
    const columns: ColumnDef<T>[] = [];
    const add = (column: ColumnDef<T>): ColumnBuilder<T> => {
        columns.push(column);
        return builder;
    };
    const builder: ColumnBuilder<T> = {
        select: (options) => add({ accessorKey: '_selection', ...CONTROL, pin: 'left', width: '40px', ...options }),
        expander: (options) => add({ accessorKey: '_expander', ...CONTROL, pin: 'left', width: '40px', ...options }),
        actions: (options) => add({ accessorKey: '_actions', ...CONTROL, width: '50px', ...options }),
        accessor: (key, header, options) => add({ accessorKey: key, header, ...options }),
        renderer: (key, header, cellRenderer, options) => add({ accessorKey: key, header, cellRenderer, ...options }),
        component: (key, header, component, options) => add({ accessorKey: key, header, component, ...options }),
        custom: (column) => add(column),
        build: () => [...columns],
    };
    return builder;
}
