import { html, type TemplateResult } from 'lit';
import './toolbar-define.js';
import { adoptSheet } from '../shared/adopt-sheet.js';
import type { RichTextControllerHost, RichTextRenderingController } from './rich-text-controllers.js';
import { ZERO_WIDTH, setSelectionRange } from './rich-text-dom.js';
import { isRichTextFormatCommand, type RichTextFormatCommand, type RichTextTopic } from './rich-text-host.js';
import { KEY_PRIORITY } from './rich-text-key-priority.js';
import { Disposables } from './rich-text-registry.js';
import { TOOLBAR_BUTTONS, type GeRichTextToolbar, type ToolbarItem } from './rich-text-toolbar.js';
import css from './rich-text-floating-toolbar.css?inline';


const DEFAULT_ITEMS: readonly ToolbarItem[] = [
    'bold', 'italic', 'underline', 'separator',
    'textStyle', 'separator',
    'bulletList', 'orderedList', 'taskList', 'separator',
    'indent', 'outdent', 'separator',
    'alignLeft', 'alignCenter', 'alignRight', 'separator',
    'code', 'codeBlock', 'separator',
    'horizontalRule', 'separator',
    'clear',
];
const FLOATING_ITEMS: readonly ToolbarItem[] = ['bold', 'italic', 'underline', 'separator', 'clear'];
const NO_FORMATS: ReadonlySet<string> = new Set();
const REFRESH_TOPICS: readonly RichTextTopic[] = ['state', 'selection', 'history', 'disabled'];

const INLINE_TAGS: ReadonlyMap<string, string> = new Map([
    ['bold', 'b'],
    ['italic', 'i'],
    ['underline', 'u'],
    ['strikethrough', 's'],
]);
const SELECTION_COMMANDS: ReadonlySet<string> = new Set(['clear', 'heading1', 'heading2', 'heading3', 'bulletList', 'orderedList']);
const FORMATTING_TAGS: ReadonlySet<string> = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'STRIKE', 'CODE']);

const BAR_WIDTH = 220;
const EDGE = 8;

function isToolbarItem(value: string): value is ToolbarItem {
    return value === 'separator' || value === 'textStyle' || Object.hasOwn(TOOLBAR_BUTTONS, value);
}

const detailOf = (event: Event): string => String((event as CustomEvent).detail);

/**
 * Connects `ge-rich-text-toolbar` to the editor: the full toolbar above the editable (`toolbar="top"`) and
 * the compact bubble beside a selection (`toolbar="floating"`). The bubble is hidden by Escape, blur,
 * a collapsed selection, scrolling and any format run while it is the active toolbar.
 *
 * Attach it last: it wraps the commands the earlier controllers registered, and gives them back on detach.
 */
export class ToolbarController implements RichTextRenderingController {
    private readonly life = new Disposables();
    private readonly wrapped = new Map<RichTextFormatCommand, { original: () => void; wrapper: () => void }>();
    private visible = false;
    private x = 0;
    private y = 0;
    private unwatchScroll: (() => void) | null = null;
    private itemsSource: readonly string[] | undefined;
    private itemsResolved: readonly ToolbarItem[] = DEFAULT_ITEMS;

    constructor(private readonly host: RichTextControllerHost) {}

    attach(): void {
        const { host, life } = this;
        life.add(this.adoptStyles());
        life.add(host.onSelectionMoved(() => this.onSelectionChange()));
        life.listen<FocusEvent>(host.contentRoot, 'blur', (event) => this.onBlur(event));
        life.add(host.addKeyHandler(KEY_PRIORITY.hideFloatingToolbar, (event) => {
            if (event.key === 'Escape') this.hide();
            return false;
        }));
        for (const topic of REFRESH_TOPICS) life.add(host.subscribe(topic, () => this.refresh()));
        this.wrapCommands();
    }

    detach(): void {
        for (const [command, { original, wrapper }] of this.wrapped) {
            if (this.host.commandTable.get(command) === wrapper) this.host.commandTable.set(command, original);
        }
        this.wrapped.clear();
        this.life.dispose();
        this.unwatchScroll = null;
        this.visible = false;
    }

    renderToolbar(): TemplateResult | null {
        const { host } = this;
        if (host.config.toolbar !== 'top' || host.readonly) return null;
        return html`<ge-rich-text-toolbar
            .items=${this.items()}
            .activeFormats=${host.activeFormats}
            .textStyleAvailable=${host.textStyleAvailable}
            .locale=${host.resolvedLocale}
            .slots=${host.toolbarSlots}
            ?disabled=${host.isDisabled}
            ?readonly=${host.readonly}
            @toolbar-command=${this.onCommand}
            @text-style-select=${this.onCommand}
            @undo=${() => host.provider('history')?.undo()}
            @redo=${() => host.provider('history')?.redo()}        ></ge-rich-text-toolbar>`;
    }

    renderOverlay(): TemplateResult | null {
        const { host } = this;
        if (!this.visible || host.config.toolbar !== 'floating' || host.readonly) return null;
        return html`<div class="floating-toolbar" data-slot="rich-text-floating-toolbar" style="left: ${this.x}px; top: ${this.y}px">
            <ge-rich-text-toolbar
                compact
                .items=${FLOATING_ITEMS}
                .activeFormats=${NO_FORMATS}
                .locale=${host.resolvedLocale}
                .slots=${host.toolbarSlots}
                ?disabled=${host.isDisabled}
                ?readonly=${host.readonly}
                @toolbar-command=${(event: Event) => this.runFloatingCommand(detailOf(event))}
            ></ge-rich-text-toolbar>
        </div>`;
    }

    private readonly onCommand = (event: Event): void => {
        const command = detailOf(event);
        if (isRichTextFormatCommand(command)) this.host.format(command);
    };

    private items(): readonly ToolbarItem[] {
        const source = this.host.config.toolbarItems;
        if (source !== this.itemsSource) {
            this.itemsSource = source;
            this.itemsResolved = source ? source.filter(isToolbarItem) : DEFAULT_ITEMS;
        }
        return this.itemsResolved;
    }

    private refresh(): void {
        const toolbars = this.host.element.shadowRoot?.querySelectorAll<GeRichTextToolbar>('ge-rich-text-toolbar') ?? [];
        for (const toolbar of toolbars) toolbar.refresh();
    }

    private adoptStyles(): () => void {
        const root = this.host.element.shadowRoot;
        return root ? adoptSheet(root, 'rich-text-floating-toolbar', css) : () => undefined;
    }

    // Commands run while the bubble is the active toolbar collapse the selection, so it never lingers over a formatted run.
    private wrapCommands(): void {
        const { commandTable } = this.host;
        for (const [command, original] of commandTable) {
            const wrapper = (): void => {
                original();
                this.collapseAfterFormat();
            };
            this.wrapped.set(command, { original, wrapper });
            commandTable.set(command, wrapper);
        }
    }

    private collapseAfterFormat(): void {
        if (this.host.config.toolbar !== 'floating') return;
        const selection = this.host.getSelection();
        if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            range.collapse(false);
            this.parkPastFormatting(selection, range);
        }
        this.hide();
    }

    private parkPastFormatting(selection: Selection, range: Range): void {
        const root = this.host.contentRoot;
        for (let node: Node | null = range.startContainer; node && node !== root; node = node.parentNode) {
            if (node instanceof Element && FORMATTING_TAGS.has(node.tagName)) {
                const after = new Range();
                after.setStartAfter(node);
                after.collapse(true);
                selection.removeAllRanges();
                selection.addRange(after);
                return;
            }
        }
    }

    /** Works on the live selection, which is what the bubble is anchored to; it never restores a saved one. */
    private runFloatingCommand(command: string): void {
        const { host } = this;
        if (host.readonly || host.isDisabled) return;
        host.flushPendingHistoryPush();
        const selection = host.getSelection();
        if (!selection || selection.rangeCount === 0) return;
        const range = selection.getRangeAt(0);
        const tag = INLINE_TAGS.get(command);
        if (tag && range.toString()) {
            this.wrapAndPark(selection, range, tag);
            return;
        }
        if (SELECTION_COMMANDS.has(command) && isRichTextFormatCommand(command)) {
            (this.wrapped.get(command)?.original ?? host.commandTable.get(command))?.();
            selection.collapseToEnd();
        }
        this.hide();
        host.commit({ focus: true });
    }

    /** Wraps the selection in the tag and parks the caret in a zero-width text after it, so typing continues unstyled. */
    private wrapAndPark(selection: Selection, range: Range, tag: string): void {
        const { host } = this;
        const wrapper = host.doc.createElement(tag);
        wrapper.append(range.extractContents());
        range.insertNode(wrapper);
        const anchor = host.doc.createTextNode(ZERO_WIDTH);
        wrapper.after(anchor);
        host.commitContent();
        this.hide();
        host.contentRoot.focus();
        setSelectionRange(selection, anchor, 1);
        host.pushHistory();
    }

    private onSelectionChange(): void {
        if (this.host.config.toolbar !== 'floating') return;
        const selection = this.host.getSelection();
        if (selection && !selection.isCollapsed && selection.rangeCount > 0) {
            this.show(selection.getRangeAt(0));
            return;
        }
        // A click about to become a drag reports collapsed for an instant, so the selection is read again.
        this.life.timeout(() => {
            const current = this.host.getSelection();
            if (!current || current.isCollapsed) this.hide();
        }, 100);
    }

    private onBlur(event: FocusEvent): void {
        const { element, doc } = this.host;
        if (event.relatedTarget instanceof Node && element.contains(event.relatedTarget)) return;
        this.life.timeout(() => {
            if (!element.contains(doc.activeElement)) this.hide();
        }, 200);
    }

    private show(range: Range): void {
        const rect = range.getBoundingClientRect();
        const viewportWidth = this.host.doc.defaultView?.innerWidth ?? 1024;
        this.x = Math.max(EDGE, Math.min(rect.left + rect.width / 2 - 100, viewportWidth - BAR_WIDTH - EDGE));
        this.y = Math.max(EDGE, rect.top - 45);
        this.visible = true;
        this.watchScroll();
        this.host.invalidate();
    }

    private hide(): void {
        if (!this.visible) return;
        this.visible = false;
        this.unwatchScroll?.();
        this.unwatchScroll = null;
        this.host.invalidate();
    }

    private watchScroll(): void {
        if (this.unwatchScroll) return;
        // Deferred a tick so the scroll that revealed the selection does not hide the bar at once.
        this.unwatchScroll = this.life.timeout(() => {
            const view = this.host.doc.defaultView;
            if (view) this.unwatchScroll = this.life.listen(view, 'scroll', () => this.hide(), { capture: true, passive: true });
        }, 0);
    }
}
