/** Wave 7, package D: the `ai` shell. It loads the AI part only with a provider, every method waits for the load, a failed load is reported once and the methods answer without throwing. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AiController } from './data-table-ai-controller.js';
import type { DataTableCoreHost } from './data-table-host.js';
import type { AiService, DataTableConfig } from './data-table-providers.js';

const load = vi.hoisted(() => ({ count: 0, fail: false, detachThrows: false, calls: [] as string[] }));

// `count`: parts built (one per load); `fail`: the load rejects (the module mock is cached across tests, so the failure is in building the part).
vi.mock('./lazy/ai.js', () => {
    return {
        AiPart: class {
            constructor() {
                load.count++;
                if (load.fail) throw new Error('chunk gone');
            }
            attach = () => load.calls.push('attach');
            detach = () => {
                load.calls.push('detach');
                if (load.detachThrows) throw new Error('detach failed');
            };
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
    return { controller, ai: providers.get('ai') as Required<AiService>, providers, renders: () => renders, config: host.config as { aiProvider: unknown } };
}

afterEach(() => {
    vi.restoreAllMocks();
    Object.assign(load, { count: 0, fail: false, detachThrows: false, calls: [] });
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

    it('aiProvider = null is off too: no load, no box, the methods answer at once (final review)', async () => {
        const { controller, ai } = setup(null);
        controller.hostUpdate();
        await ai.applyNaturalLanguageFilter('q');
        await ai.aiFillColumn('note', 'p');
        await new Promise((r) => setTimeout(r, 10));
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

    const settled = (p: Promise<unknown>) => Promise.race([p.then(() => 'resolved'), new Promise((r) => setTimeout(() => r('hung'), 50))]);

    it('a method waiting for the load resolves as a no-op when aiProvider goes away, and never runs on the part (PR #80 review)', async () => {
        const { controller, ai, config } = setup(() => '{}');
        const pending = ai.applyNaturalLanguageFilter('q');
        config.aiProvider = undefined;
        controller.hostUpdate();
        expect(await settled(pending)).toBe('resolved');
        await new Promise((r) => setTimeout(r, 20)); // the load in flight resolves and is dropped
        expect(load.calls).toEqual([]);
        // (A reload in the same test is not driven here: a second dynamic import of the mocked module, after one that was dropped, resolves the real
        // module in vitest. The generation check that keeps a woken method from running on a later part is the one cancelAi uses, tested below.)
    });

    it('cancelAi while the part loads: the waiting fill does nothing and the provider is never asked (PR #80 review)', async () => {
        const { ai } = setup(() => '{}');
        const pending = ai.aiFillColumn('note', 'p');
        ai.cancelAi();
        await pending;
        expect(load.calls).toEqual(['attach']);
    });

    it('a part that throws while detaching does not latch the shell as failed: the next load serves the methods (PR #80 review)', async () => {
        vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const { controller, ai, config } = setup(() => '{}');
        controller.hostUpdate();
        await vi.waitFor(() => expect(load.calls).toEqual(['attach']));
        load.detachThrows = true;
        config.aiProvider = undefined;
        controller.hostUpdate(); // the detach throws (reported)
        load.detachThrows = false;
        config.aiProvider = () => '{}';
        await ai.applyNaturalLanguageFilter('again'); // before any update: the call starts the load and waits for it
        expect(load.calls).toEqual(['attach', 'detach', 'attach', 'filter again']);
    });
});
