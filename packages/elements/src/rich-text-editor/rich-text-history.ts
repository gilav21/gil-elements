import { clampNodeOffset, getNodePath, resolveNodePath } from './rich-text-dom.js';
import type { RichTextController, RichTextHistoryEntrySnapshot } from './rich-text-host.js';
import {
    buildHistoryPreview,
    DEFAULT_HISTORY_DEBOUNCE_MS,
    DEFAULT_HISTORY_LIMIT,
    HistoryStack,
    type SerializedSelection,
} from './rich-text-history-stack.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import { KEY_PRIORITY } from './rich-text-key-priority.js';
import type { RichTextHistoryProvider } from './rich-text-providers.js';
import { Disposables } from './rich-text-registry.js';

/** Undo history: debounced snapshots with caret restore, Ctrl/Cmd+Z and Ctrl+Y / Ctrl+Shift+Z. */
export class HistoryController implements RichTextController, RichTextHistoryProvider {
    private readonly life = new Disposables();
    private readonly stack: HistoryStack;
    private cancelPending: (() => void) | null = null;
    private attached = false;

    constructor(private readonly host: RichTextControllerHost) {
        this.stack = new HistoryStack(
            () => host.config.history.limit ?? DEFAULT_HISTORY_LIMIT,
            (html) => buildHistoryPreview(html, (markup) => host.sanitizer.stripTags(markup)),
        );
    }

    attach(): void {
        this.attached = true;
        this.life.add(this.host.provide('history', this));
        this.life.add(this.host.addKeyHandler(KEY_PRIORITY.undoRedo, this.onKeydown));
        this.life.add(() => {
            this.attached = false;
            this.cancelPending?.();
        });
        // The shell fills the editable right after attaching, so the initial document is recorded once it is there.
        queueMicrotask(() => {
            if (this.attached) this.push();
        });
    }

    detach(): void {
        this.life.dispose();
    }

    push(): void {
        this.cancelPending?.();
        const html = this.host.readContent();
        if (html === null || !this.stack.push(html, this.captureSelection())) return;
        this.announce();
    }

    schedule(): void {
        this.cancelPending?.();
        const delay = Math.max(0, this.host.config.history.debounceMs ?? DEFAULT_HISTORY_DEBOUNCE_MS);
        this.cancelPending = this.life.timeout(() => {
            this.cancelPending = null;
            this.push();
        }, delay);
    }

    flush(): void {
        if (this.cancelPending) this.push();
    }

    canUndo(): boolean {
        return this.stack.canUndo;
    }

    canRedo(): boolean {
        return this.stack.canRedo;
    }

    undo(): void {
        this.flush();
        if (this.stack.canUndo) this.restore(this.stack.index - 1);
    }

    redo(): void {
        this.flush();
        if (this.stack.canRedo) this.restore(this.stack.index + 1);
    }

    entries(): readonly RichTextHistoryEntrySnapshot[] {
        return this.stack.snapshots();
    }

    index(): number {
        return this.stack.index;
    }

    reconstruct(index: number): { html: string; markdown: string } | null {
        const html = this.stack.html(index);
        return html === null ? null : { html, markdown: this.host.markdown.toMarkdown(html) };
    }

    /** Jumps to an entry without pushing, so forward entries stay redoable. */
    restore(index: number): void {
        this.flush();
        const target = this.stack.moveTo(index);
        if (!target) return;
        this.host.replaceEditorHtml(target.html);
        this.restoreSelection(target.selection);
        this.host.commitContent();
        this.announce();
    }

    private announce(): void {
        this.host.emit('history-change', { canUndo: this.stack.canUndo, canRedo: this.stack.canRedo });
    }

    private readonly onKeydown = (event: KeyboardEvent): boolean => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;
        const key = event.key.toLowerCase();
        const redo = key === 'y' || (key === 'z' && event.shiftKey);
        if (key !== 'z' && !redo) return false;
        event.preventDefault();
        if (this.host.readonly || this.host.isDisabled) return true;
        if (redo) this.redo();
        else this.undo();
        return true;
    };

    private captureSelection(): SerializedSelection | null {
        const root = this.host.contentRoot;
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const range = selection.getRangeAt(0);
        if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null;
        return {
            startPath: getNodePath(root, range.startContainer),
            startOffset: range.startOffset,
            endPath: getNodePath(root, range.endContainer),
            endOffset: range.endOffset,
        };
    }

    private restoreSelection(serialized: SerializedSelection | null): void {
        const selection = this.host.getSelection();
        if (!serialized || !selection) return;
        const root = this.host.contentRoot;
        const start = resolveNodePath(root, serialized.startPath);
        const end = resolveNodePath(root, serialized.endPath);
        if (!start || !end) return;
        const range = this.host.doc.createRange();
        range.setStart(start, clampNodeOffset(start, serialized.startOffset));
        range.setEnd(end, clampNodeOffset(end, serialized.endOffset));
        selection.removeAllRanges();
        selection.addRange(range);
    }
}
