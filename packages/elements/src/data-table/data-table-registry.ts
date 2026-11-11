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
    spec('expansion', { provides: ['expansion'], needs: ['query'], reads: ['rows', 'config'], writes: ['expansion'] }),
    spec('selection', { provides: ['selection'], needs: ['query', 'columns'], reads: ['rows', 'config'], writes: ['selection'] }),
    spec('virtual', { provides: ['virtual'], needs: ['query', 'columns'], reads: ['rows', 'columns', 'config'], writes: ['viewport'] }),
    spec('cell-interaction', {
        // `range` is the range session's service, always provided (inert until range selection is switched on); the edit session's methods are on `interaction`.
        provides: ['interaction', 'range'],
        needs: ['query', 'columns', 'virtual'],
        // Selection and expansion are asked for when a key or a collapse runs, never at attach (their handlers register at priority 50).
        uses: ['selection', 'expansion'],
        reads: ['rows', 'columns', 'viewport', 'selection', 'expansion'],
        writes: ['cell'],
    }),
    spec('clipboard', {
        provides: ['clipboard'],
        needs: ['query', 'columns', 'interaction'],
        uses: ['range', 'selection', 'virtual'],
        reads: ['cell'],
    }),
    spec('resize', { provides: ['resize'], needs: ['columns'], reads: ['columns'], writes: ['columns', 'viewport'] }),
    spec('column-drag', { needs: ['columns'], reads: ['columns'], writes: ['columns'] }),
    spec('row-drag', {
        provides: ['rowDrag'],
        needs: ['query', 'columns'],
        uses: ['virtual', 'selection', 'expansion'],
        reads: ['rows'],
        writes: ['rows'],
    }),
    // `cell` is written by the flash (wave 6): a flashing cell is a cell state change.
    spec('formatting', { provides: ['formatting'], needs: ['query', 'columns'], reads: ['rows', 'columns'], writes: ['cell'] }),
    spec('footer', { provides: ['footer'], needs: ['query', 'columns'], reads: ['rows', 'columns'] }),
    spec('filter-ui', { provides: ['filters'], needs: ['columns'], uses: ['query'], reads: ['columns', 'locale'] }),
    spec('ai', { needs: ['query', 'columns'], uses: ['interaction'], reads: ['locale'] }),
    spec('diagnostics', { uses: ['virtual', 'query'], reads: ['config', 'rows'] }),
    spec('aria', { needs: ['query', 'columns'], uses: ['interaction', 'virtual'], reads: ['rows', 'columns', 'selection', 'cell', 'viewport', 'locale'] }),
    spec('addon-host', { provides: ['addons'], uses: ['query', 'columns', 'interaction'], reads: ['locale'] }),
];

/**
 * The ONE key-priority table of the grid's `keydown` chain (`host.addKeyHandler(priority, fn)`): lower runs first and the first
 * handler to return true consumes the event. A handler claims a key only inside its own gate (a config flag, a target) and returns
 * false otherwise; it never claims a combination another row of this table owns. Every owner registers with its constant, never a
 * literal, so the order is read in one place. Gaps are left for later waves.
 *
 * | priority | owner | keys (gate) |
 * |---|---|---|
 * | 5 `editor` | wave 5, edit session | EVERY key whose composed path is inside the open editor's cell: the session returns true (so nothing below acts) but calls `preventDefault` only for Enter, Escape and Tab; typing, native copy / paste and a date picker keep their behaviour. False for an event outside the editor cell |
 * | 10 `clipboard` | wave 6, clipboard | Ctrl/Cmd+C (`enable-copy`), Ctrl/Cmd+V (`enable-clipboard-paste`, not editing); never from a text field |
 * | 15 `columnResize` | wave 4 | arrows on a column resize handle (header target only) |
 * | 20 `history` | wave 5, edit session | Ctrl/Cmd+Z, Ctrl/Cmd+Y, Ctrl/Cmd+Shift+Z (`enable-edit-history`, never while editing, never from a text field or outside a cell) |
 * | 25 `columnDrag` | wave 4 | Alt+Shift+Arrow on a reorderable header (header target only) |
 * | 30 `range` | wave 6, range session | Escape (only while a range exists), Shift+Arrow / Home / End / PageUp / PageDown, Ctrl/Cmd+A, Ctrl/Cmd+D (`enable-cell-range-selection`, `enable-fill-handle` for Ctrl+D) |
 * | 40 `rowMove` | wave 6, row-drag | Alt+ArrowUp / Alt+ArrowDown (`enable-row-drag`) |
 * | 50 `rowControls` | wave 4 | Space (select the focused row), tree ArrowLeft / ArrowRight and the group / detail toggles |
 * | 60 `editStart` | wave 5, edit session | Enter and F2 on the focused cell (never while editing: priority 5 owns the keys then) |
 * | 100 `navigation` | wave 4 | arrows, Home, End, PageUp, PageDown without Alt (Shift is the range's at 30 when its gate is on, else plain navigation) |
 *
 * Decisions: there is no type-to-edit (wave 5 D13) and no Delete / Backspace handler in either wave, so printable characters and
 * those two keys are not claimed by any row; a wave that adds one takes the free priority 70 (`reserved`) and amends this table.
 * Escape: the editor (5) while one is open, else the range (30) when one exists; a popover closes itself before the chain sees it.
 */
export const KEY_PRIORITY = {
    editor: 5,
    clipboard: 10,
    columnResize: 15,
    history: 20,
    columnDrag: 25,
    range: 30,
    rowMove: 40,
    rowControls: 50,
    editStart: 60,
    reserved: 70,
    navigation: 100,
} as const;

export type KeyOwner = keyof typeof KEY_PRIORITY;

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
