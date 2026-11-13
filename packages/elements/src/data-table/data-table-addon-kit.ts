/**
 * Addons extend the table without the core knowing them: the core never imports one (the boundary test enforces it).
 * An addon is `{ id, setup(host, options) }`, made available by `use(addon)` or by id in the `addons="..."` attribute.
 */
import { resolveAddonLocale } from '../shared/addon-locale.js';
import { Disposables } from '../shared/registry.js';
import { reportOncePer, warnOncePer } from './data-table-warn.js';
import type { DataTableLocale } from './data-table.locales.js';
import type { DataTableAddonEvents } from './data-table-events.js';
import type { DataTableTopic } from './data-table-host.js';
import type { AddonsService, CellActionSlot, DataTableProviders, HeaderActionSlot } from './data-table-providers.js';

export { resolveAddonLocale };
export type { AddonLocaleTable } from '../shared/addon-locale.js';

/** Services an addon may reach through `provider()`; the rest of the host is not its business. */
export type DataTableAddonServiceKey = 'query' | 'columns' | 'interaction' | 'selection';

/**
 * The stable surface an addon sees. Of the 26 members of Angular's `DataTableAddonHost` only the registration of the two
 * slots and the busy overlay are addon-specific (they belong to the `addon-host` controller); the other 20 are reads and
 * commands the core already has, so they are reached as services through `provider()` instead of being copied here.
 */
export interface DataTableAddonHost<T = unknown> {
    /** The table element (light DOM): where an addon listens for gestures on rows, cells and headers. */
    readonly root: HTMLElement;
    readonly resolvedLocale: DataTableLocale;
    /**
     * Fires a bubbling, composed `CustomEvent` on the table. Names are kebab-case; an addon types its own by augmenting
     * `DataTableAddonEvents` (`data-table-events.ts`).
     */
    emit<K extends string>(name: K, detail?: K extends keyof DataTableAddonEvents ? DataTableAddonEvents[K] : unknown): void;
    /** Writes to the table's polite live region. */
    announce(message: string): void;
    /** Publishes this addon's imperative API: `table.addon<A>(id)` returns it until the addon is torn down. */
    expose<A extends object>(api: A): void;
    /** `'locale'` re-runs `defineAddon`'s `create`; the other topics are for addons that follow rows or the cell. */
    subscribe(topic: DataTableTopic, fn: () => void): () => void;
    registerCellAction(slot: CellActionSlot<T>): () => void;
    registerHeaderAction(slot: HeaderActionSlot<T>): () => void;
    /** Shows the busy overlay with the addon's own (localised) label; `null` clears it. */
    setBusy(label: string | null): void;
    provider<K extends DataTableAddonServiceKey>(key: K): DataTableProviders<T>[K] | undefined;
}

export interface DataTableAddon<T = unknown> {
    readonly id: string;
    /** The ids this addon sets up itself. Makes it a bundle: `setup` receives the whole `addonOptions` map, and those ids are never set up a second time. */
    readonly covers?: readonly string[];
    /** May return a teardown. */
    setup(host: DataTableAddonHost<T>, options?: unknown): void | (() => void);
}

/** Bare (`''`) or `true` enables with defaults, `false` disables, an object enables with those options. */
export type DataTableAddonSetting<O extends object = object> = boolean | '' | O;

export type DataTableAddonState<O extends object> = O & { readonly enabled: boolean };

export interface DataTableAddonContext<O extends object, T> {
    readonly host: DataTableAddonHost<T>;
    readonly options: DataTableAddonState<O>;
    /** Released before the next run and when the addon is torn down. */
    readonly life: Disposables;
}

/**
 * Builds an addon. `create` runs when the addon starts and again whenever the locale changes, after everything the
 * previous run registered through `life` was released; a teardown it returns joins `life`. An addon switched off
 * (`false`) never runs.
 */
export function defineAddon<O extends object = object, T = unknown>(
    id: string,
    create: (context: DataTableAddonContext<O, T>) => void | (() => void),
): DataTableAddon<T> {
    return {
        id,
        setup(host, setting) {
            if (setting === false) return undefined;
            const given = typeof setting === 'object' && setting !== null ? setting : {};
            const options = { ...given, enabled: true } as DataTableAddonState<O>;
            let life = new Disposables();
            const run = (): void => {
                life.dispose();
                life = new Disposables();
                const teardown = create({ host, options, life });
                if (teardown) life.add(teardown);
            };
            run();
            const unsubscribe = host.subscribe('locale', run);
            return () => {
                unsubscribe();
                life.dispose();
            };
        },
    };
}

/** The `addons="..."` attribute: ids separated by spaces or commas, once each. */
export function parseAddonIds(attribute: string): string[] {
    return [...new Set(attribute.split(/[\s,]+/).filter(Boolean))];
}

/** Plain data (objects, arrays, primitives) by value; anything else (functions, class instances) by identity. */
function sameValue(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true;
    if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
    const plain = (v: object): boolean => Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype;
    if (!plain(a) || !plain(b) || Array.isArray(a) !== Array.isArray(b)) return false;
    const ka = Object.keys(a);
    return ka.length === Object.keys(b).length && ka.every((k) => Object.hasOwn(b, k) && sameValue((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}

/**
 * Which addons run and with what, for one table: `use()`d ones, the `addons` attribute resolved through the registry of
 * defined addons, and `addonOptions`. `sync()` is idempotent; it only tears down what is no longer wanted or whose
 * options changed, and starts what is new. An enabled bundle stands in for the ids it `covers`.
 */
export class AddonSet<T = unknown> {
    private readonly used = new Map<string, { addon: DataTableAddon<T>; options: unknown }>();
    private readonly active = new Map<string, { teardown: () => void; options: unknown }>();
    /** What each running addon exposed (`host.expose`), by addon id. */
    private readonly apis = new Map<string, object>();
    private ids: readonly string[] = [];
    private optionsMap: Readonly<Record<string, unknown>> = {};
    private settings: Readonly<Record<string, unknown>> = {};
    private started = false;

    constructor(
        private readonly host: DataTableAddonHost<T>,
        private readonly registry: ReadonlyMap<string, DataTableAddon<T>>,
    ) {}

    /** Adds an addon (with options) regardless of the attribute; the returned function removes it. */
    use(addon: DataTableAddon<T>, options?: unknown): () => void {
        this.used.set(addon.id, { addon, options });
        this.merge();
        this.sync();
        return () => {
            this.used.delete(addon.id);
            this.merge();
            this.sync();
        };
    }

    configure(addons: string, addonOptions: Readonly<Record<string, unknown>>): void {
        this.ids = parseAddonIds(addons);
        this.optionsMap = addonOptions;
        this.merge();
        this.sync();
    }

    start(): void {
        this.started = true;
        this.sync();
    }

    stop(): void {
        this.started = false;
        for (const { teardown } of this.active.values()) teardown();
        this.active.clear();
    }

    /** The API the running addon `id` exposed, or undefined. */
    api<A extends object>(id: string): A | undefined {
        return this.apis.get(id) as A | undefined;
    }

    /** Called when the registry gained an addon, so an id listed before its module loaded now starts. */
    sync(): void {
        if (!this.started) return;
        const wanted = this.wanted();
        for (const [id, running] of this.active) {
            const addon = wanted.get(id);
            if (addon && this.optionsFor(id, addon) === running.options) continue;
            running.teardown();
            this.active.delete(id);
        }
        for (const [id, addon] of wanted) {
            const options = this.optionsFor(id, addon);
            if (options === false || this.active.has(id)) continue;
            this.launch(id, addon, options);
        }
    }

    /**
     * Sets an addon up with a host of its own, whose `expose` files the API under its id until its teardown (a late call after it is ignored).
     * An addon that throws (in `setup`, in a topic listener such as `defineAddon`'s locale re-run, or in its teardown) is reported once and the
     * table carries on; one whose `setup` threw counts as running, so it is not retried until its options change or it is removed.
     */
    private launch(id: string, addon: DataTableAddon<T>, options: unknown): void {
        let live = true;
        const guard = (phase: string, fn: () => void): boolean => {
            try {
                fn();
                return true;
            } catch (error) {
                reportOncePer(this, `addon:${id}`, `[ge-data-table] addon "${id}" threw in ${phase}; it is skipped:`, error);
                return false;
            }
        };
        const host = Object.create(this.host, {
            expose: { value: (api: object): void => void (live && this.apis.set(id, api)) },
            subscribe: { value: (topic: DataTableTopic, fn: () => void) => this.host.subscribe(topic, () => guard(`a '${topic}' listener`, fn)) },
        }) as DataTableAddonHost<T>;
        let teardown: void | (() => void);
        if (!guard('setup', () => (teardown = addon.setup(host, options)))) {
            live = false; // a half set-up addon publishes no API
            this.apis.delete(id);
        }
        this.active.set(id, {
            options,
            teardown: () => {
                live = false;
                this.apis.delete(id);
                if (teardown) guard('teardown', teardown);
            },
        });
    }

    /**
     * `addonOptions` with the options given to `use()` on top. Every entry that is equal by value to the previous one keeps
     * the previous object, and the map itself is kept while no entry changed, so a re-configure with the same options
     * (even freshly built objects) does not restart an addon, and a bundle, whose options are the whole map, is not torn down.
     */
    private merge(): void {
        const used = [...this.used].flatMap(([id, { options }]) => (options === undefined ? [] : [[id, options] as const]));
        const next: Record<string, unknown> = { ...this.optionsMap, ...Object.fromEntries(used) };
        for (const key of Object.keys(next)) if (sameValue(this.settings[key], next[key])) next[key] = this.settings[key];
        const keys = Object.keys(next);
        const unchanged = keys.length === Object.keys(this.settings).length && keys.every((k) => Object.hasOwn(this.settings, k) && Object.is(this.settings[k], next[k]));
        if (!unchanged) this.settings = next;
    }

    private wanted(): Map<string, DataTableAddon<T>> {
        const wanted = new Map([...this.used].map(([id, { addon }]) => [id, addon]));
        for (const id of this.ids) {
            const addon = this.registry.get(id);
            if (addon) wanted.set(id, addon);
            else warnOncePer(this, `unknown-addon:${id}`, `[ge-data-table] unknown addon "${id}": import its define module first.`); // once per set (one table) and id: another table with the same typo warns for itself
        }
        for (const [id, bundle] of [...wanted]) {
            if (bundle.covers && this.optionsFor(id, bundle) !== false) for (const covered of bundle.covers) wanted.delete(covered);
        }
        return wanted;
    }

    private optionsFor(id: string, addon: DataTableAddon<T>): unknown {
        if (this.settings[id] === false) return false;
        return addon.covers ? this.settings : this.settings[id];
    }
}

/**
 * Builds the narrow addon host from what the `addon-host` controller provides and the core host offers. The element
 * calls this once; nothing else implements `DataTableAddonHost`.
 */
export function createAddonHost<T>(parts: {
    readonly root: HTMLElement;
    readonly resolvedLocale: () => DataTableLocale;
    readonly emit: (name: string, detail: unknown) => void;
    readonly announce: (message: string) => void;
    readonly subscribe: DataTableAddonHost<T>['subscribe'];
    readonly provider: DataTableAddonHost<T>['provider'];
    readonly addons: () => Pick<AddonsService<T>, 'cellActions' | 'headerActions' | 'setBusy'>;
}): DataTableAddonHost<T> {
    return {
        root: parts.root,
        get resolvedLocale() {
            return parts.resolvedLocale();
        },
        emit: (name, detail) => parts.emit(name, detail),
        announce: parts.announce,
        // `AddonSet` hands each addon a host of its own whose `expose` files the API under the addon's id; this one has no id to file under.
        expose: () => undefined,
        subscribe: parts.subscribe,
        provider: parts.provider,
        registerCellAction: (slot) => parts.addons().cellActions.register(slot),
        registerHeaderAction: (slot) => parts.addons().headerActions.register(slot),
        setBusy: (label) => parts.addons().setBusy(label),
    };
}
