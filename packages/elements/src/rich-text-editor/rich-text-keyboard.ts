import type { RichTextControllerHost } from './rich-text-controllers.js';
import { createEmptyParagraph, findAncestorByTag, lastTextNodeIn, setSelectionRange, trailingBreakIn } from './rich-text-dom.js';
import type { RichTextController } from './rich-text-host.js';
import { KEY_PRIORITY } from './rich-text-key-priority.js';
import {
    holdsNothing,
    lineIsEmpty,
    lineKeepsItsElement,
    lineOf,
    lineOwnNodes,
    positionAfterLine,
    type Line,
} from './rich-text-lines.js';
import { Disposables } from './rich-text-registry.js';

type EnterRule = (range: Range, selection: Selection) => boolean;

/** The Enter rules that leave a block: summary, details, blockquote, inline code, code block. */
export class KeyboardController implements RichTextController {
    private readonly life = new Disposables();

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        const enter = (priority: number, rule: EnterRule, commit = true) =>
            this.life.add(this.host.addKeyHandler(priority, (event) => this.onEnter(event, rule, commit)));
        enter(KEY_PRIORITY.enterSummary, (range, selection) => this.enterInSummary(range, selection), false);
        enter(KEY_PRIORITY.enterDetailsEnd, (range, selection) => this.enterAtDetailsEnd(range, selection));
        enter(KEY_PRIORITY.enterBlockquote, (range, selection) => this.enterInBlockquote(range, selection));
        enter(KEY_PRIORITY.enterInlineCode, (range, selection) => this.enterInInlineCode(range, selection));
        enter(KEY_PRIORITY.enterCodeBlock, (range, selection) => this.enterInCodeBlock(range, selection));
    }

    detach(): void {
        this.life.dispose();
    }

    private ancestor(node: Node, tag: string): HTMLElement | null {
        return findAncestorByTag(node, tag, this.host.contentRoot);
    }

    private newParagraph(): HTMLParagraphElement {
        return createEmptyParagraph(this.host.doc);
    }

    /** Runs a rule on a plain Enter; a rule that handles the key returns true and the edit is committed. */
    private onEnter(event: KeyboardEvent, rule: EnterRule, commit: boolean): boolean {
        if (event.key !== 'Enter' || event.shiftKey) return false;
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return false;
        if (!rule(selection.getRangeAt(0), selection)) return false;
        event.preventDefault();
        if (commit) this.host.commit();
        return true;
    }

    private enterInSummary(range: Range, selection: Selection): boolean {
        const summary = this.ancestor(range.startContainer, 'SUMMARY');
        if (!summary) return false;
        const details = summary.parentElement;
        if (!details) return true;
        let body = summary.nextElementSibling;
        if (!body) {
            body = this.newParagraph();
            details.append(body);
            this.host.commit();
        }
        setSelectionRange(selection, body, 0);
        return true;
    }

    private enterAtDetailsEnd(range: Range, selection: Selection): boolean {
        const details = this.ancestor(range.startContainer, 'DETAILS');
        const last = details?.lastElementChild;
        if (!details || !last || last.tagName === 'SUMMARY') return false;

        // Left only from a blank last line; a line with content is never the exit.
        const line = lineOf(range.startContainer, this.host.contentRoot);
        if (!line || !last.contains(range.startContainer) || !lineIsEmpty(line)) return false;

        const paragraph = this.newParagraph();
        const at = positionAfterLine({ kind: 'block', owner: details, holder: details });
        at.parent.insertBefore(paragraph, at.before);
        last.remove();
        setSelectionRange(selection, paragraph, 0);
        return true;
    }

    private enterInBlockquote(range: Range, selection: Selection): boolean {
        const quote = this.ancestor(range.startContainer, 'BLOCKQUOTE');
        if (!quote) return false;

        // A quoted list, table or code block owns its Enter: its lines are not the quote's own.
        const quoted = lineOf(range.startContainer, this.host.contentRoot);
        if (!quoted || (quoted.owner.parentElement !== quote && quoted.owner !== quote)) return false;

        const paragraph = this.newParagraph();
        quote.parentNode?.insertBefore(paragraph, quote.nextSibling);
        setSelectionRange(selection, paragraph, 0);

        if (holdsNothing(quoted.owner)) quoted.owner.remove();
        if (holdsNothing(quote)) quote.remove();
        return true;
    }

    /** Enter in inline code opens a plain paragraph instead of cloning the `<code>` into the split line. */
    private enterInInlineCode(range: Range, selection: Selection): boolean {
        const code = this.ancestor(range.startContainer, 'CODE');
        if (!code || this.ancestor(range.startContainer, 'PRE')) return false;
        const line = lineOf(code, this.host.contentRoot);
        if (!line) return false;

        const paragraph = this.newParagraph();
        // A line that cannot sit beside a block (an `li` or a `td`) would orphan its own text.
        if (lineKeepsItsElement(line)) this.giveLineItsOwnBlock(line);
        const at = positionAfterLine(line);
        at.parent.insertBefore(paragraph, at.before);
        setSelectionRange(selection, paragraph, 0);
        return true;
    }

    private giveLineItsOwnBlock(line: Line): void {
        const own = lineOwnNodes(line);
        const [first] = own;
        if (!first) return;
        const paragraph = this.host.doc.createElement('p');
        first.before(paragraph);
        paragraph.append(...own);
    }

    /** Enter always leaves a code block (Shift+Enter adds a line), dropping the blank line the user left. */
    private enterInCodeBlock(range: Range, selection: Selection): boolean {
        const pre = this.ancestor(range.startContainer, 'PRE');
        if (!pre) return false;
        const body = pre.querySelector('code') ?? pre;

        const last = lastTextNodeIn(body);
        const trailingBreak = trailingBreakIn(body);
        if (last?.data.endsWith('\n') && !last.data.trim()) {
            last.remove();
        } else {
            trailingBreak?.remove();
        }

        const paragraph = this.newParagraph();
        pre.parentNode?.insertBefore(paragraph, pre.nextSibling);
        setSelectionRange(selection, paragraph, 0);
        return true;
    }
}
