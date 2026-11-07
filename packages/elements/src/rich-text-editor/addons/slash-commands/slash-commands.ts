import { caretIsInCode } from '../../../shared/caret-context.js';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import {
    globalRichTextCommands,
    type RichTextSlashCommand,
    type RichTextSlashCommandAvailabilityContext,
    type RichTextSlashCommandContext,
} from '../../rich-text-command-registry.js';
import type { RichTextAddonHost, RichTextAddonOptions } from '../../rich-text-host.js';
import { caretRect, node, SuggestionPopup } from '../shared-popup.js';
import { buildDefaultSlashCommands } from './slash-commands-defaults.js';
import { slashCommandsLocales, type SlashCommandsLocale } from './slash-commands-locale.js';
import {
    captureSlashTriggerRange,
    getClosestEditableBlockForSlashCommand,
    getClosestEditableBlockFromSelection,
    isSelectionInsideEditor,
    matchSlashTriggerAtCaret,
    matchSlashTriggerInText,
    matchSlashTriggerWithinCurrentBlock,
    placeCaretAtEndOfBlock,
    removeCaretSentinelAtSelection,
    removeSlashTriggerText,
} from './slash-commands-utils.js';

export interface SlashCommandsOptions extends RichTextAddonOptions {
    /** Commands merged in after the built-in, global and editor-registered ones. */
    readonly commands?: readonly RichTextSlashCommand[];
    /** A locale id or a full dictionary; defaults to the editor's locale. */
    readonly locale?: string | SlashCommandsLocale;
}

const MENU_KEYS = new Set(['ArrowDown', 'ArrowUp', 'Enter', 'Escape', 'Tab', ' ', 'Spacebar']);
const MAX_COMMANDS = 10;

function matchesQuery(command: RichTextSlashCommand, needle: string): boolean {
    if (!needle) return true;
    const haystack = [command.label, command.description ?? '', ...(command.keywords ?? []), ...(command.aliases ?? [])];
    return haystack.join(' ').toLowerCase().includes(needle);
}

function compareCommands(a: RichTextSlashCommand, b: RichTextSlashCommand): number {
    return (a.order ?? 9999) - (b.order ?? 9999) || a.label.localeCompare(b.label);
}

function fillCommand(option: HTMLElement, command: RichTextSlashCommand): void {
    option.append(node('div', 'label', command.label));
    if (command.description) option.append(node('div', 'description', command.description));
}

function liveRange(doc: Document): Range | undefined {
    const selection = doc.getSelection();
    return selection?.rangeCount ? selection.getRangeAt(0) : undefined;
}

function caretHint(doc: Document): { x: number; y: number } | undefined {
    const rect = liveRange(doc)?.getBoundingClientRect();
    return rect && (rect.width > 0 || rect.height > 0 || rect.top > 0 || rect.left > 0) ? { x: rect.left, y: rect.bottom } : undefined;
}

class SlashMenu {
    private query = '';
    private anchorBlock: HTMLElement | null = null;
    private triggerRange: Range | null = null;
    private readonly popup: SuggestionPopup<RichTextSlashCommand>;
    private readonly defaults: RichTextSlashCommand[];

    constructor(
        private readonly host: RichTextAddonHost,
        private readonly locale: SlashCommandsLocale,
        private readonly custom: readonly RichTextSlashCommand[],
    ) {
        this.defaults = buildDefaultSlashCommands(locale, host);
        this.popup = new SuggestionPopup({
            host,
            keys: MENU_KEYS,
            fill: fillCommand,
            onSelect: (command) => void this.select(command),
            onDismiss: () => this.close(),
        });
    }

    private get doc(): Document {
        return this.host.doc;
    }

    readonly observe = (text: string, caret: number): void => {
        const root = this.host.contentRoot;
        if (this.host.isDisabled || this.host.readonly || caretIsInCode(this.doc)) return this.close();
        const match = matchSlashTriggerInText(text, caret)
            ?? matchSlashTriggerAtCaret(this.doc)
            ?? matchSlashTriggerWithinCurrentBlock(this.doc, root);
        if (!match) return this.close();
        this.triggerRange = captureSlashTriggerRange(this.doc, root);
        this.anchorBlock = getClosestEditableBlockFromSelection(this.doc, root);
        this.query = match[1] ?? '';
        const range = liveRange(this.doc);
        const anchor = range ? caretRect(range, this.anchorBlock) : null;
        this.popup.show({ items: this.filtered(), label: this.locale.menuAriaLabel, emptyText: this.locale.noResults, anchor });
    };

    readonly keydown = (event: KeyboardEvent): boolean => this.popup.handleKey(event);

    close(): void {
        this.query = '';
        this.anchorBlock = null;
        this.triggerRange = null;
        this.popup.close();
    }

    private filtered(): RichTextSlashCommand[] {
        const availability: RichTextSlashCommandAvailabilityContext = {
            query: this.query,
            disabled: this.host.isDisabled,
            readonly: this.host.readonly,
            hasSelection: this.host.selection().text.length > 0,
        };
        const merged = new Map<string, RichTextSlashCommand>();
        const sources = [this.defaults, globalRichTextCommands.listCommands(), this.host.commands.listCommands(), this.custom];
        for (const command of sources.flat()) merged.set(command.id, command);
        const needle = this.query.trim().toLowerCase();
        return [...merged.values()]
            .filter((command) => (!command.when || command.when(availability)) && matchesQuery(command, needle))
            .sort(compareCommands)
            .slice(0, MAX_COMMANDS);
    }

    /** Removes the typed trigger, commits that as its own history step, then runs the command. */
    private async select(command: RichTextSlashCommand): Promise<void> {
        if (this.host.isDisabled || this.host.readonly) return;
        const root = this.host.contentRoot;
        const hint = caretHint(this.doc);
        const query = this.query;
        const resolved = removeSlashTriggerText(this.doc, root, query, this.triggerRange, this.anchorBlock);
        const block = resolved ?? getClosestEditableBlockForSlashCommand(this.doc, root, this.anchorBlock, this.triggerRange);
        if (block) {
            placeCaretAtEndOfBlock(this.doc, block);
            removeCaretSentinelAtSelection(this.doc);
        }
        this.host.commitContent();
        this.close();
        await command.run(this.contextFor(query, block, hint));
        if (!isSelectionInsideEditor(this.doc, root)) root.focus();
    }

    private contextFor(query: string, block: HTMLElement | null, hint: { x: number; y: number } | undefined): RichTextSlashCommandContext {
        return {
            query,
            selectedText: this.host.selection().text,
            executeToolbarCommand: (command) => this.host.executeToolbarCommandOnBlock(command, block),
            insertText: (text) => this.host.insertTextAtCaret(text),
            insertHtml: (html) => this.host.insertHtmlAtCaret(html),
            showLinkDialog: () => this.host.showLinkDialog(hint),
            focusEditor: () => this.host.contentRoot.focus(),
        };
    }
}

export const slashCommandsAddon = defineAddon<SlashCommandsOptions>('slash-commands', 0, ({ host, options, life }) => {
    if (!options.slashCommand) return;
    const menu = new SlashMenu(host, resolveAddonLocale(slashCommandsLocales, host, options.locale), options.commands ?? []);
    life.add(host.registerInputObserver(menu.observe));
    life.add(host.registerKeydownInterceptor(menu.keydown));
    life.add(() => menu.close());
});
