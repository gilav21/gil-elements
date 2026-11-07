import { createTaskListItem, quoteBlockToDepth, replaceBlockTag } from './rich-text-blocks.js';
import type { RichTextControllerHost } from './rich-text-controllers.js';
import { LINE_OWNING_TAGS, ZERO_WIDTH, placeCaretAtStartOfBlock } from './rich-text-dom.js';
import type { RichTextController } from './rich-text-host.js';
import {
    matchBlockInputRule,
    matchInlineInputRule,
    type BlockInputRuleMatch,
    type InlineInputRuleKind,
} from './rich-text-input-rules.js';
import { KEY_PRIORITY } from './rich-text-key-priority.js';
import { holdsNothing } from './rich-text-lines.js';
import { Disposables } from './rich-text-registry.js';

/** Tags a block rule may transform; any other block is one the author already chose. */
const RULE_BLOCK_TAGS: ReadonlySet<string> = new Set(['P', 'DIV']);
/** Ancestors that veto a block rule even for a plain paragraph. */
const FORBIDDEN_BLOCK_ANCESTORS = 'pre, li, td, th, summary';
/** Ancestors where Markdown is literal or another feature owns the text. */
const FORBIDDEN_INLINE_ANCESTORS = 'code, pre, a, [data-mention], [data-tag], [data-action-click], [data-action-hover]';
const CARET_BLOCK_SELECTOR = 'p, div, h1, h2, h3, h4, h5, h6, li, td, th, pre, blockquote, summary';
/** The longest block marker plus terminator (a fence, a 16-char language and a space). */
const MAX_BLOCK_MARKER_LENGTH = 24;
const IGNORED_INPUT_TYPES = ['delete', 'history', 'format', 'insertCompositionText'];
const INLINE_TAGS: Readonly<Record<InlineInputRuleKind, string>> = { strong: 'strong', em: 'em', code: 'code' };

interface RuleContext {
    block: HTMLElement;
    textNode: Text | null;
    offset: number;
    blockPrefix: string;
}

/** Turns completed Markdown markers into formatting as the author types; Backspace right after puts them back. */
export class MarkdownShortcutsController implements RichTextController {
    private readonly life = new Disposables();
    /** The element the last rule produced (an inline rule's parent), while Backspace may still revert it. */
    private lastRuleBlock: HTMLElement | null = null;

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        const { host, life } = this;
        life.add(host.addInputTransform((event) => this.applyInputRules(event)));
        life.add(host.addKeyHandler(KEY_PRIORITY.revertInputRule, (event) => this.onKeydown(event)));
        life.add(host.addKeyHandler(KEY_PRIORITY.enterCodeFence, (event) => this.enterOnCodeFence(event)));
        life.add(host.onSelectionMoved(() => this.closeWindowIfMoved()));
        life.add(host.provide('inputRules', { resetRevertWindow: () => this.resetRevertWindow() }));
        for (const type of ['blur', 'mousedown', 'paste']) {
            life.listen(host.contentRoot, type, () => this.resetRevertWindow());
        }
    }

    detach(): void {
        this.life.dispose();
        this.lastRuleBlock = null;
    }

    private resetRevertWindow(): void {
        this.lastRuleBlock = null;
    }

    private get active(): boolean {
        const { host } = this;
        return host.config.markdownShortcuts && !host.isDisabled && !host.readonly;
    }

    private onKeydown(event: KeyboardEvent): boolean {
        const revert = event.key === 'Backspace' && this.caretIsInLastRuleBlock();
        this.lastRuleBlock = null;
        if (!revert) return false;
        this.host.provider('history')?.undo();
        event.preventDefault();
        return true;
    }

    private caretIsInLastRuleBlock(): boolean {
        const selection = this.host.getSelection();
        return (
            !!this.lastRuleBlock &&
            !!selection &&
            selection.rangeCount > 0 &&
            selection.isCollapsed &&
            this.lastRuleBlock.contains(selection.getRangeAt(0).startContainer)
        );
    }

    private closeWindowIfMoved(): void {
        if (this.lastRuleBlock && !this.caretIsInLastRuleBlock()) this.lastRuleBlock = null;
    }

    private applyInputRules(event: Event): boolean {
        this.lastRuleBlock = null;
        if (!this.active) return false;
        const inputType = (event as InputEvent).inputType ?? 'insertText';
        if (IGNORED_INPUT_TYPES.some((ignored) => inputType.startsWith(ignored))) return false;
        const context = this.ruleContext();
        if (!context) return false;
        return this.tryBlockRule(context, this.terminatorOf(context.blockPrefix, event)) || this.tryInlineRule(context);
    }

    /** The caret's block, text node and the block's text before it; null unless a caret sits in the editor. */
    private ruleContext(): RuleContext | null {
        const root = this.host.contentRoot;
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) return null;
        const { startContainer, startOffset } = selection.getRangeAt(0);
        if (!root.contains(startContainer)) return null;

        const start = startContainer instanceof Text ? startContainer.parentElement : (startContainer as HTMLElement);
        if (!start) return null;
        const closest = start.closest<HTMLElement>(CARET_BLOCK_SELECTOR);
        const block = closest && closest !== root && root.contains(closest) ? closest : root;

        const prefix = new Range();
        prefix.setStart(block, 0);
        prefix.setEnd(startContainer, startOffset);
        return {
            block,
            textNode: startContainer instanceof Text ? startContainer : null,
            offset: startOffset,
            blockPrefix: prefix.toString().replaceAll(ZERO_WIDTH, ''),
        };
    }

    /** A space only when the author just typed one (a drop or paste ending in a space never completes a marker). */
    private terminatorOf(blockPrefix: string, event: Event): ' ' | '' {
        if (!/[  ]$/.test(blockPrefix)) return '';
        const { inputType, data } = event as InputEvent;
        if (inputType && inputType !== 'insertText') return '';
        return data == null || data === ' ' ? ' ' : '';
    }

    private tryBlockRule(context: RuleContext, terminator: ' ' | ''): boolean {
        if (context.blockPrefix.length > MAX_BLOCK_MARKER_LENGTH) return false;
        const block = this.blockRuleTarget(context.block);
        if (!block) return false;

        const marker = terminator === '' ? context.blockPrefix : context.blockPrefix.slice(0, -1);
        const match = matchBlockInputRule(marker, terminator);
        if (!match) return false;

        this.snapshotBeforeTransform();
        this.removeLeadingCharacters(block, match.markerLength);
        this.lastRuleBlock = this.buildBlock(block, match);
        return true;
    }

    private enterOnCodeFence(event: KeyboardEvent): boolean {
        if (event.key !== 'Enter' || !this.active) return false;
        const context = this.ruleContext();
        if (!context || context.blockPrefix.length > MAX_BLOCK_MARKER_LENGTH) return false;
        const block = this.blockRuleTarget(context.block);
        if (!block) return false;
        const match = matchBlockInputRule(context.blockPrefix, '\n');
        if (!match) return false;

        event.preventDefault();
        this.snapshotBeforeTransform();
        this.removeLeadingCharacters(block, match.markerLength - 1);
        this.lastRuleBlock = this.buildBlock(block, match);
        this.host.commit();
        return true;
    }

    /** The block a rule may rewrite; bare text directly under the editor is wrapped in a paragraph first. */
    private blockRuleTarget(block: HTMLElement): HTMLElement | null {
        if (block === this.host.contentRoot) return this.wrapBareTextInParagraph(block);
        if (!RULE_BLOCK_TAGS.has(block.tagName) || block.closest(FORBIDDEN_BLOCK_ANCESTORS)) return null;
        return block;
    }

    /** The unbroken run of non-block children around the caret; blocks bound it so a wrap never moves a node across one. */
    private bareRunAround(root: HTMLElement, caretNode: Node, caretOffset: number): ChildNode[] {
        const children = [...root.childNodes];
        const isBlock = (node: ChildNode | undefined): boolean => node instanceof HTMLElement && LINE_OWNING_TAGS.has(node.tagName);

        let anchor = children.findIndex((node) => node === caretNode || node.contains(caretNode));
        if (anchor === -1 && caretNode === root) anchor = Math.min(caretOffset, children.length - 1);
        if (anchor < 0 || isBlock(children[anchor])) return [];

        let start = anchor;
        while (start > 0 && !isBlock(children[start - 1])) start--;
        let end = anchor;
        while (end + 1 < children.length && !isBlock(children[end + 1])) end++;
        return children.slice(start, end + 1);
    }

    private wrapBareTextInParagraph(root: HTMLElement): HTMLElement | null {
        const selection = this.host.getSelection();
        if (!selection || selection.rangeCount === 0) return null;
        const { startContainer, startOffset } = selection.getRangeAt(0);
        const bare = this.bareRunAround(root, startContainer, startOffset);
        const first = bare[0];
        if (!first) return null;
        const runStart = [...root.childNodes].indexOf(first);

        const paragraph = this.host.doc.createElement('p');
        first.before(paragraph);
        paragraph.append(...bare);

        // A caret held as a child index of the editor no longer fits once the run moved into the paragraph.
        const restored = new Range();
        if (startContainer === root) {
            restored.setStart(paragraph, Math.max(0, Math.min(startOffset - runStart, paragraph.childNodes.length)));
        } else {
            restored.setStart(startContainer, startOffset);
        }
        restored.collapse(true);
        selection.removeAllRanges();
        selection.addRange(restored);
        return paragraph;
    }

    private removeLeadingCharacters(block: HTMLElement, count: number): void {
        let remaining = count;
        const walker = this.host.doc.createTreeWalker(block, NodeFilter.SHOW_TEXT);
        while (remaining > 0 && walker.nextNode()) {
            const text = walker.currentNode as Text;
            const take = Math.min(remaining, text.data.length);
            text.deleteData(0, take);
            remaining -= take;
        }
    }

    /** Rebuilds the block as the rule asks, parks the caret where typing continues, and returns the new block. */
    private buildBlock(block: HTMLElement, match: BlockInputRuleMatch): HTMLElement {
        switch (match.kind) {
            case 'heading1':
            case 'heading2':
            case 'heading3':
                return this.caretAtStart(replaceBlockTag(block, `h${match.kind.at(-1)}`));
            case 'bulletList':
                return this.caretAtStart(this.wrapInList(block, 'ul'));
            case 'orderedList':
                return this.caretAtStart(this.wrapInList(block, 'ol'));
            case 'blockquote':
                return this.caretAtStart(quoteBlockToDepth(block, match.depth ?? 1, this.host.contentRoot));
            case 'taskUnchecked':
                return this.buildTask(block, false);
            case 'taskChecked':
                return this.buildTask(block, true);
            case 'horizontalRule':
                return this.buildRule(block);
            default:
                return this.buildCodeBlock(block, match.language ?? '');
        }
    }

    private caretAtStart(block: HTMLElement): HTMLElement {
        const selection = this.host.getSelection();
        if (selection) placeCaretAtStartOfBlock(selection, block);
        return block;
    }

    private wrapInList(block: HTMLElement, tag: 'ul' | 'ol'): HTMLElement {
        const doc = this.host.doc;
        if (block.tagName === 'LI') {
            const parent = block.parentElement;
            if (parent && (parent.tagName === 'UL' || parent.tagName === 'OL') && parent.localName !== tag) {
                const list = doc.createElement(tag);
                list.append(...parent.childNodes);
                parent.replaceWith(list);
            }
            return block;
        }
        const list = doc.createElement(tag);
        const item = doc.createElement('li');
        item.append(...block.childNodes);
        if (holdsNothing(item)) item.innerHTML = '<br>';
        list.append(item);
        block.replaceWith(list);
        return item;
    }

    private buildTask(block: HTMLElement, checked: boolean): HTMLElement {
        const list = this.host.doc.createElement('ul');
        list.dataset['taskList'] = '';
        const item = createTaskListItem(this.host.doc, checked);
        const text = item.querySelector('span')!;
        if (holdsNothing(block)) {
            text.textContent = ZERO_WIDTH;
        } else {
            text.replaceChildren(...block.childNodes);
        }
        list.append(item);
        block.replaceWith(list);
        this.caretAtStart(text);
        return item;
    }

    /** A rule plus the empty paragraph the author carries on in; built here since the insert command pushes its own history. */
    private buildRule(block: HTMLElement): HTMLElement {
        const doc = this.host.doc;
        const paragraph = doc.createElement('p');
        paragraph.innerHTML = '<br>';
        block.replaceWith(doc.createElement('hr'), paragraph);
        return this.caretAtStart(paragraph);
    }

    /** The shape the code-block command makes, newline seed included, so Enter-to-exit works in it. */
    private buildCodeBlock(block: HTMLElement, language: string): HTMLElement {
        const doc = this.host.doc;
        const pre = doc.createElement('pre');
        const code = doc.createElement('code');
        if (language) {
            code.dataset['language'] = language;
            code.className = `language-${language}`;
            pre.dataset['language'] = language;
        }
        code.textContent = block.textContent?.replaceAll(ZERO_WIDTH, '') || '\n';
        pre.append(code);
        block.replaceWith(pre);
        return this.caretAtStart(code);
    }

    /** Records the pre-transform DOM as its own history entry, so one undo restores the typed markers. */
    private snapshotBeforeTransform(): void {
        this.host.flushPendingHistoryPush();
        this.host.readContent();
        this.host.pushHistory();
    }

    /** Replaces a completed wrapper with its element and parks the caret after it so typing leaves the element. */
    private tryInlineRule({ textNode, offset, block }: RuleContext): boolean {
        if (!textNode || textNode.parentElement?.closest(FORBIDDEN_INLINE_ANCESTORS)) return false;
        const match = matchInlineInputRule(textNode.data.slice(0, offset));
        if (!match) return false;

        this.snapshotBeforeTransform();
        const tail = textNode.splitText(match.start);
        tail.deleteData(0, match.end - match.start);
        const element = this.host.doc.createElement(INLINE_TAGS[match.kind]);
        element.textContent = match.text;
        const anchor = this.host.doc.createTextNode(ZERO_WIDTH);
        tail.before(element, anchor);

        const selection = this.host.getSelection();
        if (selection) {
            const caret = new Range();
            caret.setStart(anchor, 1);
            caret.collapse(true);
            selection.removeAllRanges();
            selection.addRange(caret);
        }
        this.lastRuleBlock = element.parentElement ?? block;
        return true;
    }
}
