/** Wave 7, package D: the `ai` shell. It loads the AI part only with a provider, every method waits for the load, a failed load is reported once and the methods answer without throwing. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiController } from './data-table-ai-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';
import type { AiService, DataTableConfig } from './data-table-providers.js';

const load = vi.hoisted(() => ({ count: 0, fail: false, calls: [] as string[] }));

// `count`: parts built (one per load); `fail`: the load rejects (the module mock is cached across tests, so the failure is in building the part).
vi.mock('./lazy/ai.js', () => {
    return {
        AiPart: class {
            constructor() {
                load.count++;
                if (load.fail) throw new Error('chunk gone');
            }
            attach = () => load.calls.push('attach');
            detach = () => load.calls.push('detach');
            render = () => null;
            runBox = async () => void load.calls.push('runBox');
            filter = async (query: string) => void load.calls.push(`filter ${query}`);
            fill = async (key: string) => void load.calls.push(`fill ${key}`);
            cancel = () => load.calls.push('cancel');
            busy = () => true;
        },
    };
});

function setup(aiProvider: unknown) {
    const providers = new Map<string, unknown>();
    let renders = 0;
    const host = {
        config: { aiProvider } as unknown as DataTableConfig<unknown>,
        provide: (key: string, p: unknown) => (providers.set(key, p), () => providers.delete(key)),
        requestRender: () => void renders++,
        resolvedLocale: {},
    } as unknown as DataTableCoreHost<unknown>;
    const controller = new AiController(host);
    controller.attach();
    return { controller, ai: providers.get('ai') as Required<AiService>, providers, renders: () => renders };
}

afterEach(() => {
    vi.restoreAllMocks();
    Object.assign(load, { count: 0, fail: false, calls: [] });
});

describe('the ai shell', () => {
    it('a table without aiProvider never loads the part, and its methods answer at once', async () => {
        const { controller, ai } = setup(undefined);
        controller.hostUpdate();
        await ai.applyNaturalLanguageFilter('q');
        await ai.aiFillColumn('note', 'p');
        ai.cancelAi();
        expect(ai.busy()).toBe(false);
        expect(controller.renderToolbar()).toBeNull();
        expect(load.count).toBe(0);
    });

    it('loads the part at the first update with a provider and asks for a render (the box)', async () => {
        const { controller, renders } = setup(() => '{}');
        controller.hostUpdate();
        await vi.waitFor(() => expect(load.calls).toEqual(['attach']));
        expect(renders()).toBe(1);
        controller.detach();
        expect(load.calls).toEqual(['attach', 'detach']);
    });

    it('a method called before the load waits for it, then runs on the part', async () => {
        const { ai } = setup(() => '{}');
        await ai.applyNaturalLanguageFilter('show bob'); // no update yet: the call starts the load
        await ai.aiFillColumn('note', 'p');
        await ai.runAiFilter();
        expect(load.calls).toEqual(['attach', 'filter show bob', 'fill note', 'runBox']);
        expect(ai.busy()).toBe(true);
        expect(load.count).toBe(1);
    });

    it('a failed load is reported once and the methods answer without throwing (latched until detach)', async () => {
        load.fail = true;
        const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { controller, ai } = setup(() => '{}');
        await expect(ai.applyNaturalLanguageFilter('q')).resolves.toBeUndefined();
        controller.hostUpdate();
        await expect(ai.aiFillColumn('note', 'p')).resolves.toBeUndefined();
        expect(error).toHaveBeenCalledTimes(1);
        expect(load.calls).toEqual([]);
    });

    it('a method waiting for the load answers when the table detaches meanwhile', async () => {
        const { controller, ai } = setup(() => '{}');
        const pending = ai.applyNaturalLanguageFilter('q');
        controller.detach();
        await expect(pending).resolves.toBeUndefined();
        expect(load.calls.filter((c) => c.startsWith('filter'))).toEqual([]);
    });
});
