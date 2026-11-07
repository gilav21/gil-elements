import { html, nothing, type TemplateResult } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import type { AiTask } from '../../../shared/ai.js';
import type { AiLocale } from './ai-locale.js';

export type AiPhase = 'menu' | 'loading' | 'review';

export interface AiPoint {
    readonly x: number;
    readonly y: number;
}

/** What the chip and panel draw and call; the controller implements it. */
export interface AiViewModel {
    readonly locale: AiLocale;
    readonly tasks: readonly { readonly task: AiTask; readonly label: string }[];
    /** Where the chip floats; null while it is hidden. */
    readonly chip: AiPoint | null;
    /** Where the panel sits; null while it is closed. */
    readonly panel: AiPoint | null;
    readonly phase: AiPhase;
    readonly error: string | null;
    readonly prompt: string;
    setPrompt(prompt: string): void;
    openPanel(): void;
    runTask(task: AiTask): void;
    runCustom(): void;
    accept(): void;
    discard(): void;
    retryLast(): void;
}

const keepSelection = (event: Event): void => event.preventDefault();

export function renderAiChip(vm: AiViewModel): TemplateResult | typeof nothing {
    if (!vm.chip) return nothing;
    return html`<button type="button" class="ai-chip" data-slot="rich-text-ai-trigger"
        style=${styleMap({ left: `${vm.chip.x}px`, top: `${vm.chip.y}px` })}
        @mousedown=${keepSelection} @click=${() => vm.openPanel()}>${vm.locale.trigger}</button>`;
}

function renderMenu(vm: AiViewModel): TemplateResult {
    const { locale } = vm;
    return html`<div class="ai-menu" data-slot="rich-text-ai-menu">
        ${vm.tasks.map(({ task, label }) => html`<button type="button" @mousedown=${keepSelection} @click=${() => vm.runTask(task)}>${label}</button>`)}
        <div class="ai-prompt">
            <input type="text" .value=${vm.prompt} placeholder=${locale.promptPlaceholder} aria-label=${locale.promptPlaceholder}
                @input=${(event: Event) => vm.setPrompt((event.target as HTMLInputElement).value)}
                @keydown=${(event: KeyboardEvent) => event.key === 'Enter' && vm.runCustom()}
                @mousedown=${(event: Event) => event.stopPropagation()} />
            <button type="button" class="ai-action" ?disabled=${!vm.prompt.trim()} @click=${() => vm.runCustom()}>${locale.go}</button>
        </div>
    </div>`;
}

function renderReview(vm: AiViewModel): TemplateResult {
    const { locale } = vm;
    const loading = vm.phase === 'loading';
    return html`<div class="ai-review" data-slot="rich-text-ai-review">
        ${loading ? html`<output class="ai-status" aria-live="polite" data-slot="rich-text-ai-loading">${locale.generating}</output>` : nothing}
        ${vm.error ? html`<p class="ai-error" role="alert" data-slot="rich-text-ai-error">${vm.error}</p>` : nothing}
        <div class="ai-buttons">
            <button type="button" class="ai-action" ?disabled=${loading} @click=${() => vm.accept()}>${locale.accept}</button>
            <button type="button" class="ai-action" data-variant="outline" @click=${() => vm.discard()}>${locale.discard}</button>
            <button type="button" class="ai-action" data-variant="ghost" ?disabled=${loading} @click=${() => vm.retryLast()}>${locale.retry}</button>
        </div>
    </div>`;
}

export function renderAiPanel(vm: AiViewModel): TemplateResult | typeof nothing {
    if (!vm.panel) return nothing;
    return html`<div class="ai-panel" data-slot="rich-text-ai-panel" role="dialog" aria-label=${vm.locale.panelLabel}
        style=${styleMap({ left: `${vm.panel.x}px`, top: `${vm.panel.y}px` })}>
        ${vm.phase === 'menu' ? renderMenu(vm) : renderReview(vm)}
    </div>`;
}
