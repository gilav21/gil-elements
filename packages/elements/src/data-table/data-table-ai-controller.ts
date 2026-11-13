/**
 * The `ai` controller (wave 7, package D): a shell that provides the `ai` service always and loads the AI part (`lazy/ai.ts`: the NL filter box,
 * the NL filter, the AI fill) once `aiProvider` is set, so a table without AI never loads it. The box is drawn once the part is there; a method
 * called before waits for the load and answers (does nothing) without a provider, after a failed load (reported once, latched until the
 * provider is removed or the table detaches) or when the table detaches meanwhile.
 */
import type { TemplateResult } from 'lit';
import type { DataTableCoreHost } from './data-table-host.js';
import { callPart, lazyPart } from './data-table-lazy.js';
import type { AiService } from './data-table-providers.js';
import type { AiPart } from './lazy/ai.js';

export class AiController<T> {
    private unprovide: (() => void) | undefined;
    /** Methods waiting for the part: woken when it attached, when its load failed, or at detach. */
    private waiters: (() => void)[] = [];
    private failed = false;
    private readonly lazy = lazyPart<AiPart<T>>(() => import('./lazy/ai.js').then((m) => new m.AiPart(this.host)), {
        changed: () => {
            this.host.requestRender(); // the box
            this.wake();
        },
        onError: (error) => {
            console.error('[ge-data-table] a lazy part failed to load:', error);
            this.failed = true;
            this.wake();
        },
    });

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private readonly service: AiService = {
        runAiFilter: () => this.call((part) => part.runBox()),
        applyNaturalLanguageFilter: (query) => this.call((part) => part.filter(query)),
        aiFillColumn: (columnKey, prompt, options) => this.call((part) => part.fill(columnKey, prompt, options)),
        cancelAi: () => this.lazy.part?.cancel(),
        busy: () => this.lazy.part?.busy() ?? false,
    };

    attach(): void {
        this.unprovide = this.host.provide('ai', this.service);
    }

    hostUpdate(): void {
        const on = this.host.config.aiProvider !== undefined;
        if (!on) this.failed = false; // the latch of `lazyPart` is released with the provider too
        this.lazy.sync(on);
    }

    detach(): void {
        this.failed = false; // `dispose()` releases the latch: the next attach loads again
        this.lazy.dispose();
        this.wake();
        this.unprovide?.();
        this.unprovide = undefined;
    }

    renderToolbar(): TemplateResult | null {
        return callPart(this.lazy.part, this.host, 'ai-part-render', (part) => part.render(), null);
    }

    private wake(): void {
        for (const wake of this.waiters.splice(0)) wake();
    }

    private async call(run: (part: AiPart<T>) => Promise<void>): Promise<void> {
        if (!this.unprovide || this.host.config.aiProvider === undefined) return;
        if (!this.lazy.part && !this.failed) {
            await new Promise<void>((resolve) => {
                this.waiters.push(resolve);
                this.lazy.sync(true); // a method called before the first update with the provider starts the load
            });
        }
        const part = this.lazy.part;
        if (part) await run(part);
    }
}
