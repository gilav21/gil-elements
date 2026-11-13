/**
 * The `ai` controller (wave 7, package D): a shell that provides the `ai` service always and loads the AI part (`lazy/ai.ts`: the NL filter box,
 * the NL filter, the AI fill) once `aiProvider` is set, so a table without AI never loads it. The box is drawn once the part is there; a method
 * called before waits for the load and answers (does nothing) without a provider, after a failed load (reported once, latched until the
 * provider is removed or the table detaches), or when the provider goes away, the table detaches or `cancelAi()` runs meanwhile.
 */
import type { TemplateResult } from 'lit';
import type { DataTableCoreHost } from './data-table-host.js';
import { callPart, lazyPart } from './data-table-lazy.js';
import type { AiService } from './data-table-providers.js';
import type { AiPart } from './lazy/ai.js';

export class AiController<T> {
    private unprovide: (() => void) | undefined;
    /** Methods waiting for the part: woken when it attached, when its load failed, when the provider goes away, or at detach. */
    private waiters: (() => void)[] = [];
    /** The load or the attach failed (latched like `lazyPart`'s own latch). */
    private failed = false;
    /** Bumped when the provider goes away, at detach and by `cancelAi()`: a method that waited across a bump does nothing. */
    private generation = 0;
    private readonly lazy = lazyPart<AiPart<T>>(() => import('./lazy/ai.js').then((m) => new m.AiPart(this.host)), {
        changed: () => {
            this.wake();
            this.host.requestRender(); // the box
        },
        onError: (error) => {
            console.error('[ge-data-table] a lazy part failed to load:', error);
            // Only a failed load or attach leaves no part; a throwing `changed` leaves the part attached. A throwing detach comes from `sync(false)` /
            // `dispose()`, after which the caller clears the latch.
            if (!this.lazy.part) this.failed = true;
            this.wake();
        },
    });

    constructor(private readonly host: DataTableCoreHost<T>) {}

    private readonly service: AiService = {
        runAiFilter: () => this.call((part) => part.runBox()),
        applyNaturalLanguageFilter: (query) => this.call((part) => part.filter(query)),
        aiFillColumn: (columnKey, prompt, options) => this.call((part) => part.fill(columnKey, prompt, options)),
        cancelAi: () => {
            this.generation++; // a method still waiting for the load is cancelled too
            this.lazy.part?.cancel();
        },
        busy: () => this.lazy.part?.busy() ?? false,
    };

    attach(): void {
        this.unprovide = this.host.provide('ai', this.service);
    }

    hostUpdate(): void {
        const on = this.host.config.aiProvider != null; // null is off too
        this.lazy.sync(on);
        if (!on) this.stop(); // after the sync: a part that throws while leaving does not latch
    }

    detach(): void {
        this.lazy.dispose();
        this.stop();
        this.unprovide?.();
        this.unprovide = undefined;
    }

    renderToolbar(): TemplateResult | null {
        return callPart(this.lazy.part, this.host, 'ai-part-render', (part) => part.render(), null);
    }

    /** The provider went away or the table detached: the latch is released and every waiting method answers as a no-op. */
    private stop(): void {
        this.failed = false;
        this.generation++;
        this.wake();
    }

    private wake(): void {
        for (const wake of this.waiters.splice(0)) wake();
    }

    private async call(run: (part: AiPart<T>) => Promise<void>): Promise<void> {
        if (!this.unprovide || this.host.config.aiProvider == null) return;
        const generation = this.generation;
        if (!this.lazy.part && !this.failed) {
            await new Promise<void>((resolve) => {
                this.waiters.push(resolve);
                this.lazy.sync(true); // a method called before the first update with the provider starts the load
            });
        }
        const part = this.lazy.part;
        if (part && generation === this.generation) await run(part);
    }
}
