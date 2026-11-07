import { graphemeLength, truncateToGraphemes } from '../shared/grapheme.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import type { RichTextController } from './rich-text-host.js';
import { ZERO_WIDTH } from './rich-text-dom.js';
import { RichTextPasteNormalizer } from './rich-text-paste-normalizer.js';
import { Disposables } from './rich-text-registry.js';

/**
 * Inserts what a paste carries and holds `maxLength` on every path that adds text the shell does not
 * (typing, paste, drop). The shell has already cancelled the paste and run the addon interceptors by the
 * time this controller's listener sees it, so nothing reaches the document unfiltered.
 */
export class ClipboardController implements RichTextController {
    private readonly life = new Disposables();
    private normalizer: RichTextPasteNormalizer | undefined;

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        this.normalizer = new RichTextPasteNormalizer({ document: this.host.doc, markdown: this.host.markdown });
        const root = this.host.contentRoot;
        this.life.listen(root, 'beforeinput', this.onBeforeInput);
        this.life.listen(root, 'paste', this.onPaste);
        this.life.listen(root, 'drop', this.onDrop);
    }

    detach(): void {
        this.life.dispose();
        this.normalizer = undefined;
    }

    /** Blocks typing past the limit; deletions and formatting stay allowed so an over-limit document can be edited down. */
    private readonly onBeforeInput = (event: InputEvent): void => {
        if (!this.host.config.maxLength || event.inputType.startsWith('delete') || event.inputType.startsWith('format')) return;
        // A drop or a paste carries its text in dataTransfer, not data.
        if (this.exceedsMaxLength(event.data ?? this.transferredText(event.dataTransfer))) event.preventDefault();
    };

    private readonly onPaste = (event: ClipboardEvent): void => {
        const data = event.clipboardData;
        const normalized = this.normalizer?.normalize(data?.getData('text/html') ?? null, data?.getData('text/plain') ?? '');
        const insert = this.host.provider('insert');
        if (normalized === undefined || !insert) return;

        // Budgeted on the flavour that is inserted: the plain flavour alone let a paste whose HTML says more through.
        const text = this.host.sanitizer.stripTags(normalized);
        const remaining = this.host.remainingLength();
        if (remaining <= 0) return;
        if (graphemeLength(text) > remaining) insert.textAtCaret(truncateToGraphemes(text, remaining));
        else insert.htmlAtCaret(normalized);
    };

    /** An unclaimed drop is inserted by the browser itself, past every insert seam, so it is held here. */
    private readonly onDrop = (event: DragEvent): void => {
        if (this.host.config.maxLength && this.exceedsMaxLength(this.transferredText(event.dataTransfer))) event.preventDefault();
    };

    /** The text a drop or a paste would add, from the flavour that is inserted: the HTML when there is some. */
    private transferredText(data: DataTransfer | null | undefined): string {
        const html = data?.getData('text/html') ?? '';
        return html ? this.host.sanitizer.stripTags(html) : (data?.getData('text/plain') ?? '');
    }

    private exceedsMaxLength(text: string): boolean {
        const max = this.host.config.maxLength;
        if (!max) return false;
        // Graphemes never outnumber UTF-16 units, so a raw fit settles it without segmenting the document.
        const selection = this.host.getSelection();
        const inside = selection && this.host.contentRoot.contains(selection.anchorNode);
        const selected = inside ? selection.toString().length : 0;
        const shown = (this.host.contentRoot.textContent ?? '').replaceAll(ZERO_WIDTH, '').length;
        if (shown - selected + text.length <= max) return false;
        return graphemeLength(text) > this.host.remainingLength();
    }
}
