/**
 * `@gilav21/elements/data-table/addons/pivot`: `table.use(pivotAddon)`, then `table.addon<PivotApi>('pivot')?.getPivot(config)`. The pure
 * `computePivot` pivots any rows without a table (Angular re-exports it the same way).
 */
export { pivotAddon, type PivotApi } from './pivot.js';
export {
    computePivot,
    pivotToColumns,
    toAggregatableNumber,
    PIVOT_KEY_PREFIX,
    PIVOT_TOTAL_KEY,
    type PivotAggregate,
    type PivotColumn,
    type PivotConfig,
    type PivotResult,
} from './pivot-utils.js';
