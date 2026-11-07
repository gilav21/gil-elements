import { html, ReactiveElement, type TemplateResult } from 'lit';
import { runAiTask, type AiProvider, type AiTask } from '../../../shared/ai.js';
import { graphemeLength } from '../../../shared/grapheme.js';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonHost, RichTextAddonOptions } from '../../rich-text-host.js';
import { Disposables } from '../../rich-text-registry.js';
import { AI_LOCALES, type AiLocale } from './ai-locale.js';
import { renderAiChip, renderAiPanel, type AiPhase, type AiPoint, type AiViewModel } from './ai-view.js';
import css from './ai.css?inline';

export interface AiOptions extends RichTextAddonOptions {
    /** The bring-your-own AI hook; without it the addon contributes nothing. */
    readonly provider?: AiProvider;
    /** A locale id or a full dictionary; by default the editor's. */
    readonly locale?: string | AiLocale;
}

const CHIP_OFFSET_Y = 40;
const PANEL_OFFSET_Y = 8;
const PANEL_MIN_X = 8;
const PANEL_WIDTH = 288;
const PANEL_MAX_HEIGHT = 240;

const DRAFT_CSS = "ge-rich-text-editor > [data-slot='editor'] [data-ai-draft] { background-color: color-mix(in oklab, var(--primary) 10%, transparent); border-radius: 0.125rem; }";

/** A collapsed caret in an empty block can report an all-zero rect; fall back to its block's. */
function caretRect(range: Range): DOMRect | null {
    const rect = range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0) return rect;
    const node = range.startContainer;
    const block = (node instanceof Element ? node : node.parentElement)?.getBoundingClientRect();
    return block && (block.width > 0 || block.height > 0) ? block : null;
}

/** Keeps the fixed panel inside the viewport: left of the right edge, below the caret unless that overflows. */
function panelPoint(rect: DOMRect, view: Window): AiPoint {
    const x = Math.max(PANEL_MIN_X, Math.min(rect.left, view.innerWidth - PANEL_WIDTH - PANEL_MIN_X));
    const below = rect.bottom + PANEL_OFFSET_Y;
    const y = below + PANEL_MAX_HEIGHT > view.innerHeight ? Math.max(PANEL_MIN_X, rect.top - PANEL_MAX_HEIGHT - PANEL_OFFSET_Y) : below;
    return { x, y };
}

const rendered = (element: HTMLElement): Promise<unknown> => (element instanceof ReactiveElement ? element.updateComplete : Promise.resolve());

/**
 * Ask-AI: a chip over a text selection and a task panel (menu, streaming draft, accept / discard /
 * retry). The draft streams into the document as a marked span; accepting commits it as one history
 * entry, discarding restores the selection.
 */
export class AiController implements AiViewModel {
    readonly locale: AiLocale;
    readonly tasks: AiViewModel['tasks'];
    chip: AiPoint | null = null;
    panel: AiPoint | null = null;
    phase: AiPhase = 'menu';
    error: string | null = null;
    prompt = '';

    private readonly panelLife = new Disposables();
    private run = 0;
    private abort: AbortController | null = null;
    private draft: HTMLElement | null = null;
    private returnFocusTo: HTMLElement | null = null;
    private range: Range | null = null;
    private savedHtml = '';
    private savedText = '';
    private lastTask: AiTask = 'rewrite';
    private lastPrompt: string | undefined;

    constructor(
        private readonly host: RichTextAddonHost,
        private readonly provider: AiProvider,
        locale: string | AiLocale | undefined,
        private readonly life: Disposables,
    ) {
        this.locale = resolveAddonLocale(AI_LOCALES, host, locale);
        const l = this.locale;
        this.tasks = [
            { task: 'rewrite', label: l.rewrite },
            { task: 'fix-grammar', label: l.fixGrammar },
            { task: 'shorten', label: l.shorten },
            { task: 'expand', label: l.expand },
            { task: 'summarize', label: l.summarize },
            { task: 'continue', label: l.continueWriting },
        ];
    }

    attach(slashCommand: boolean, order: number): void {
        const { host, life } = this;
        life.add(host.adoptStyles(css, 'shadow'));
        life.add(host.adoptStyles(DRAFT_CSS, 'document'));
        life.add(host.overlays.register({ id: 'ai', render: () => this.render() }));
        life.listen(host.doc, 'selectionchange', () => this.updateChip());
        life.add(host.registerKeydownInterceptor((event) => event.key === 'Tab' && (this.chip !== null || this.panel !== null)));
        life.add(() => {
            this.cancel();
            this.panelLife.dispose();
        });
        if (!slashCommand) return;
        life.add(host.commands.registerCommand({
            id: 'insert.ai',
            label: this.locale.slash,
            description: this.locale.slashDescription,
            keywords: ['ai', 'assist', 'rewrite', 'summarize', 'generate'],
            order,
            run: () => this.openPanel(),
        }));
    }

    private render(): TemplateResult {
        return html`${renderAiChip(this)}${renderAiPanel(this)}`;
    }

    setPrompt(prompt: string): void {
        this.prompt = prompt;
        this.host.invalidate();
    }

    private updateChip(): void {
        if (this.panel) return;
        const selection = this.host.getSelection();
        const active = selection && !selection.isCollapsed && selection.rangeCount > 0
            && !this.host.readonly && !this.host.isDisabled && this.host.contentRoot.contains(selection.anchorNode);
        const rect = active ? selection.getRangeAt(0).getBoundingClientRect() : null;
        const next = rect ? { x: rect.left, y: rect.top - CHIP_OFFSET_Y } : null;
        if (next?.x === this.chip?.x && next?.y === this.chip?.y) return;
        this.chip = next;
        this.host.invalidate();
    }

    openPanel(): void {
        this.captureSelection();
        this.error = null;
        this.prompt = '';
        this.phase = 'menu';
        this.chip = null;
        const rect = this.range ? caretRect(this.range) : null;
        const view = this.host.doc.defaultView;
        if (rect && view) this.panel = panelPoint(rect, view);
        else this.panel ??= { x: PANEL_MIN_X, y: PANEL_MIN_X };
        this.bindPanelDismiss();
        this.returnFocusTo = this.host.doc.activeElement as HTMLElement | null;
        this.host.invalidate();
        void rendered(this.host.element).then(() => this.panelElement()?.querySelector<HTMLElement>('button, input')?.focus());
    }

    private panelElement(): HTMLElement | null {
        return this.host.overlayAnchor.querySelector<HTMLElement>('[data-slot="rich-text-ai-panel"]');
    }

    /** The menu is a detached chooser (Escape, an outside press or a scroll closes it); once a task runs, Escape discards the draft instead. */
    private bindPanelDismiss(): void {
        const { doc } = this.host;
        this.panelLife.dispose();
        this.panelLife.listen<KeyboardEvent>(doc, 'keydown', (event) => this.onKeydown(event), true);
        this.panelLife.listen(doc, 'mousedown', (event) => this.dismissMenu(event), true);
        if (doc.defaultView) this.panelLife.listen(doc.defaultView, 'scroll', (event) => this.dismissMenu(event), { capture: true, passive: true });
    }

    private onKeydown(event: KeyboardEvent): void {
        if (event.key !== 'Escape' || !this.panel) return;
        event.preventDefault();
        if (this.phase === 'menu') this.finish();
        else this.discard();
    }

    private dismissMenu(event: Event): void {
        if (this.phase !== 'menu') return;
        const panel = this.panelElement();
        if (panel && event.composedPath().includes(panel)) return;
        this.finish();
    }

    private captureSelection(): void {
        const selection = this.host.getSelection();
        this.savedHtml = '';
        this.savedText = '';
        if (!selection || selection.rangeCount === 0) {
            this.range = null;
            return;
        }
        const range = selection.getRangeAt(0);
        this.range = range.cloneRange();
        if (range.collapsed) {
            this.savedText = this.host.contentRoot.textContent ?? '';
            return;
        }
        this.savedText = selection.toString();
        const wrapper = this.host.doc.createElement('div');
        wrapper.append(range.cloneContents());
        this.savedHtml = wrapper.innerHTML;
    }

    runTask(task: AiTask, prompt?: string): void {
        if (!this.range) return;
        this.cancel();
        if (this.beginDraft(task === 'continue')) void this.stream(task, prompt);
    }

    runCustom(): void {
        const prompt = this.prompt.trim();
        if (prompt) this.runTask('custom', prompt);
    }

    retryLast(): void {
        if (!this.draft) {
            this.runTask(this.lastTask, this.lastPrompt);
            return;
        }
        this.cancel();
        this.draft.textContent = '';
        void this.stream(this.lastTask, this.lastPrompt);
    }

    private async stream(task: AiTask, prompt?: string): Promise<void> {
        this.lastTask = task;
        this.lastPrompt = prompt;
        this.host.emit('ai-request', { task, prompt });
        this.error = null;
        this.phase = 'loading';
        this.host.invalidate();
        const run = ++this.run;
        const abort = new AbortController();
        this.abort = abort;
        try {
            for await (const text of runAiTask(this.provider, { task, input: this.savedText, prompt, signal: abort.signal })) {
                if (run !== this.run) return;
                if (this.draft) this.draft.textContent = text;
            }
            if (run !== this.run) return;
            this.host.emit('ai-result', this.draft?.textContent ?? '');
        } catch (error: unknown) {
            if (run !== this.run) return;
            this.error = (error instanceof Error && error.message) || this.locale.failed;
            this.host.emit('ai-error', this.error);
        }
        this.phase = 'review';
        this.host.invalidate();
    }

    private beginDraft(collapseToEnd: boolean): boolean {
        const selection = this.host.getSelection();
        if (!selection || !this.range) return false;
        this.host.contentRoot.focus();
        selection.removeAllRanges();
        selection.addRange(this.range);
        const range = selection.getRangeAt(0);
        if (collapseToEnd) range.collapse(false);
        else range.deleteContents();
        const span = this.host.doc.createElement('span');
        span.dataset['aiDraft'] = '';
        range.insertNode(span);
        this.draft = span;
        return true;
    }

    /** Keeps the generated text, unwrapping the draft marker as one history entry. */
    accept(): void {
        const span = this.draft;
        // A detached span still has a parent, and undo, redo and setContent replace the document while the panel is open.
        if (span && !this.host.contentRoot.contains(span)) {
            this.finish();
            this.host.emit('ai-error', this.locale.failed);
            return;
        }
        // The draft is already in the document and is the selection, so the document is over the limit exactly when the selection exceeds what remains once it is excluded.
        if (span && graphemeLength(this.host.selection().text) > this.host.remainingLength()) {
            this.discard();
            this.host.emit('ai-error', this.locale.tooLong);
            return;
        }
        this.host.mutateContent(() => span?.replaceWith(...span.childNodes));
        this.finish();
    }

    /** Drops the draft and restores the original selection. */
    discard(): void {
        this.cancel();
        const span = this.draft;
        if (span && this.host.contentRoot.contains(span)) {
            if (this.savedHtml) span.replaceWith(this.host.sanitizer.sanitizeToFragment(this.savedHtml));
            else span.remove();
        }
        this.finish();
        this.host.commitContent();
    }

    private cancel(): void {
        this.run++;
        this.abort?.abort();
        this.abort = null;
    }

    private finish(): void {
        this.cancel();
        this.panelLife.dispose();
        this.draft = null;
        this.range = null;
        this.savedHtml = '';
        this.savedText = '';
        this.panel = null;
        this.phase = 'menu';
        const returnTo = this.returnFocusTo;
        this.returnFocusTo = null;
        if (returnTo?.isConnected) returnTo.focus();
        else this.host.contentRoot.focus();
        this.host.invalidate();
    }
}

export const aiAddon = defineAddon<AiOptions>('ai', 5, ({ host, options, life }) => {
    if (typeof options.provider !== 'function') return;
    new AiController(host, options.provider, options.locale, life).attach(options.slashCommand, options.order);
});
