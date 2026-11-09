/**
 * The controller plan as data, and the slot registries addons contribute to.
 *
 * Each controller declares what it provides, needs, reads and writes, so the element can wire them in order without a
 * controller importing another and a test can check the whole plan without constructing one. The split is the corrected
 * one of docs/data-table-port.md section 8: Focus, Edit and Range are one `cell-interaction`; grouping and tree are
 * stages of `query`; the cell-write pipeline is a host channel, not a controller.
 */
import { SlotRegistry, TopicBus, Disposables, HandlerChain } from '../shared/registry.js';
import type { DataTableTopic } from './data-table-host.js';
import type { AddonsService, CellActionSlot, DataTableProviders, HeaderActionSlot } from './data-table-providers.js';

export { Disposables, HandlerChain, SlotRegistry, TopicBus };

export type ProviderKey = keyof DataTableProviders;

export type ControllerId =
    | 'columns'
    | 'query'
    | 'loading'
    | 'expansion'
    | 'selection'
    | 'virtual'
    | 'cell-interaction'
    | 'clipboard'
    | 'resize'
    | 'column-drag'
    | 'row-drag'
    | 'formatting'
    | 'footer'
    | 'filter-ui'
    | 'ai'
    | 'aria'
    | 'diagnostics'
    | 'addon-host';

export interface ControllerSpec {
    readonly id: ControllerId;
    /** Services this controller plugs in during `attach`. */
    readonly provides: readonly ProviderKey[];
    /** Services it asks for during `attach`: must be provided by a controller EARLIER in the plan. */
    readonly needs: readonly ProviderKey[];
    /** Services it asks for only when an event or a render runs: must exist somewhere in the plan. */
    readonly uses: readonly ProviderKey[];
    /** Topics it subscribes to. */
    readonly reads: readonly DataTableTopic[];
    /** Topics it publishes. */
    readonly writes: readonly DataTableTopic[];
}

const spec = (
    id: ControllerId,
    p: { provides?: ProviderKey[]; needs?: ProviderKey[]; uses?: ProviderKey[]; reads?: DataTableTopic[]; writes?: DataTableTopic[] } = {},
): ControllerSpec => ({ id, provides: [], needs: [], uses: [], reads: [], writes: [], ...p });

/**
 * Attach order (detach is the reverse). Placeholder for wave 3 to confirm against the real controllers; the reasons:
 * - columns, then query: the memo graph reads the enhanced columns; everything below reads both.
 * - virtual before cell-interaction: keeping the focused cell visible scrolls through it.
 * - cell-interaction before clipboard and ai: paste and fill write at the focused cell and through its editor state.
 * - aria after the services it summarises; addon-host last, nothing in the core waits for it.
 */
export const DEFAULT_ORDER: readonly ControllerSpec[] = [
    spec('columns', { provides: ['columns'], reads: ['config', 'locale'], writes: ['columns'] }),
    spec('query', { provides: ['query'], needs: ['columns'], reads: ['config', 'columns', 'expansion'], writes: ['rows'] }),
    spec('loading', { provides: ['loading'], reads: ['config', 'rows'], writes: ['loading'] }),
    spec('expansion', { needs: ['query'], reads: ['rows', 'config'], writes: ['expansion'] }),
    spec('selection', { needs: ['query', 'columns'], reads: ['rows', 'config'], writes: ['selection'] }),
    spec('virtual', { provides: ['virtual'], needs: ['query', 'columns'], reads: ['rows', 'columns', 'config'], writes: ['viewport'] }),
    spec('cell-interaction', {
        provides: ['interaction'],
        needs: ['query', 'columns', 'virtual'],
        reads: ['rows', 'columns', 'viewport', 'selection'],
        writes: ['cell'],
    }),
    spec('clipboard', { needs: ['query', 'columns', 'interaction'], uses: ['virtual'], reads: ['cell'] }),
    spec('resize', { needs: ['columns'], reads: ['columns'], writes: ['columns', 'viewport'] }),
    spec('column-drag', { needs: ['columns'], reads: ['columns'], writes: ['columns'] }),
    spec('row-drag', { needs: ['query', 'columns'], uses: ['virtual'], reads: ['rows'], writes: ['rows'] }),
    spec('formatting', { provides: ['formatting'], needs: ['query', 'columns'], reads: ['rows', 'columns'] }),
    spec('footer', { provides: ['footer'], needs: ['query', 'columns'], reads: ['rows', 'columns'] }),
    spec('filter-ui', { needs: ['columns'], uses: ['query'], reads: ['columns', 'locale'] }),
    spec('ai', { needs: ['query', 'columns'], uses: ['interaction'], reads: ['locale'] }),
    spec('diagnostics', { uses: ['virtual', 'query'], reads: ['config', 'rows'] }),
    spec('aria', { needs: ['query', 'columns', 'virtual'], uses: ['interaction'], reads: ['rows', 'columns', 'selection', 'cell', 'viewport', 'locale'] }),
    spec('addon-host', { provides: ['addons'], uses: ['query', 'columns', 'interaction'], reads: ['locale'] }),
];

/** Topics the element itself publishes (an input changed, the locale changed), so no controller has to. */
const ELEMENT_TOPICS: readonly DataTableTopic[] = ['config', 'locale'];

/**
 * Problems with a plan, one message each; empty when the order can be wired. `strict` (default) also checks that every
 * topic read is published and every lazily used service exists, which only holds for the whole plan, not a subset.
 */
export function validatePlan(plan: readonly ControllerSpec[], { strict = true } = {}): string[] {
    const problems: string[] = [];
    const ids = new Set<string>();
    const providerOf = new Map<ProviderKey, ControllerId>();
    for (const s of plan) {
        if (ids.has(s.id)) problems.push(`controller '${s.id}' appears twice`);
        ids.add(s.id);
        for (const key of s.provides) {
            const owner = providerOf.get(key);
            if (owner) problems.push(`service '${key}' is provided by both '${owner}' and '${s.id}'`);
            providerOf.set(key, s.id);
        }
    }
    const written = new Set<DataTableTopic>(ELEMENT_TOPICS);
    for (const s of plan) for (const topic of s.writes) written.add(topic);
    const before = new Set<ProviderKey>();
    for (const s of plan) {
        for (const topic of strict ? s.reads : []) {
            if (!written.has(topic)) problems.push(`'${s.id}' reads topic '${topic}', which nothing publishes`);
        }
        for (const key of s.needs) {
            if (!before.has(key)) problems.push(`'${s.id}' needs '${key}' at attach, but no earlier controller provides it`);
        }
        for (const key of strict ? s.uses : []) {
            if (!providerOf.has(key)) problems.push(`'${s.id}' uses '${key}', but no controller provides it`);
        }
        for (const key of s.provides) before.add(key);
    }
    return problems;
}

/** What the table's addons contribute: a ⋮ button in every data row's action cell and in every column header. */
export interface DataTableSlots<T> {
    readonly cellActions: SlotRegistry<CellActionSlot<T>>;
    readonly headerActions: SlotRegistry<HeaderActionSlot<T>>;
}

export function createDataTableSlots<T>(): DataTableSlots<T> {
    return { cellActions: new SlotRegistry(), headerActions: new SlotRegistry() };
}

/** The `addons` service: the slot registries plus the busy-overlay label; `onChange` is the element's re-render. */
export function createAddonsService<T>(onChange: () => void): AddonsService<T> {
    const slots = createDataTableSlots<T>();
    let busy: string | null = null;
    slots.cellActions.subscribe(onChange);
    slots.headerActions.subscribe(onChange);
    return {
        ...slots,
        busyLabel: () => busy,
        setBusy(label) {
            if (busy === label) return;
            busy = label;
            onChange();
        },
    };
}
