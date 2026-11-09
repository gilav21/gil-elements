import {
    addonSetting,
    type RichTextAddon,
    type RichTextAddonHost,
    type RichTextAddonOptions,
    type RichTextAddonSetting,
    type RichTextAddonState,
} from './rich-text-host.js';
import { type AddonLocaleTable, resolveAddonLocale } from '../shared/addon-locale.js';
import { Disposables } from './rich-text-registry.js';

/** What an addon's `create` is given on every run: its normalised options and a bag of teardowns. */
export interface RichTextAddonContext<O extends RichTextAddonOptions> {
    readonly host: RichTextAddonHost;
    /** The addon's flat options with `toolbar`, `slashCommand` and `order` filled in. */
    readonly options: RichTextAddonState & O;
    /** Released before the next run and when the addon is torn down. */
    readonly life: Disposables;
}

/**
 * Builds an addon. `create` runs when the addon starts and again whenever the editor's locale
 * changes, after everything the previous run registered through `life` was released; a teardown
 * it returns joins `life`. An addon switched off (`addonOptions[id] === false`) never runs.
 */
export function defineAddon<O extends RichTextAddonOptions = RichTextAddonOptions>(
    id: string,
    defaultOrder: number,
    create: (context: RichTextAddonContext<O>) => void | (() => void),
): RichTextAddon {
    const settle = addonSetting(defaultOrder);
    return {
        id,
        setup(host, setting) {
            // addonSetting spreads the caller's object, so the addon's own fields survive.
            const options = settle(setting as RichTextAddonSetting) as RichTextAddonState & O;
            if (!options.enabled) return undefined;
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

/** A per-language dictionary table keyed by the editor's locale id; `en` is the fallback. */
export type RichTextAddonLocaleTable<T extends object> = AddonLocaleTable<T>;

// Shared with the data-table addon kit; the editor's addons keep importing it from here.
export { resolveAddonLocale };
