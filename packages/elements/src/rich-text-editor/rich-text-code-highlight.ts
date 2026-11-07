import { highlightCodeElementKeepingCaret, languageOfCodeElement } from '../shared/code-highlight.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import type { RichTextController } from './rich-text-host.js';
import { Disposables } from './rich-text-registry.js';

/**
 * Repaints the code block the caret is in once typing goes quiet. The spans are decoration only: the
 * shell strips them when it reads the content, and nothing here touches the value or the history.
 * A wholesale load paints every block through the shell's `replaceEditorHtml`.
 */
export class CodeHighlightController implements RichTextController {
    private readonly life = new Disposables();
    private cancelPending: (() => void) | null = null;

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        this.life.add(this.host.addInputTransform(() => {
            this.schedule();
            return false;
        }));
        this.life.add(this.host.onContentReplaced(() => this.cancel()));
        this.life.add(() => this.cancel());
    }

    detach(): void {
        this.life.dispose();
    }

    private schedule(): void {
        this.cancel();
        const delay = this.host.config.codeHighlightDebounceMs;
        if (delay <= 0) this.repaintCaretBlock();
        else this.cancelPending = this.life.timeout(() => this.repaintCaretBlock(), delay);
    }

    private cancel(): void {
        this.cancelPending?.();
        this.cancelPending = null;
    }

    private repaintCaretBlock(): void {
        if (this.host.isDisabled || this.host.readonly) return;
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const start = selection.getRangeAt(0).startContainer;
        const code = (start instanceof Element ? start : start.parentElement)?.closest<HTMLElement>('pre > code');
        if (code && this.host.contentRoot.contains(code)) {
            highlightCodeElementKeepingCaret(code, languageOfCodeElement(code), selection);
        }
    }
}
