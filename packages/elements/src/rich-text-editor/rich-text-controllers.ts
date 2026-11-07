import type { TemplateResult } from 'lit';
import { BlocksController } from './rich-text-blocks.js';
import { ClipboardController } from './rich-text-clipboard.js';
import { CodeHighlightController } from './rich-text-code-highlight.js';
import { FindController } from './rich-text-find.js';
import { HistoryController } from './rich-text-history.js';
import type { RichTextController, RichTextCoreHost } from './rich-text-host.js';
import { InlineFormatsController } from './rich-text-inline-formats.js';
import { InsertController } from './rich-text-insert.js';
import { KeyboardController } from './rich-text-keyboard.js';
import { ListsController } from './rich-text-lists.js';
import { MarkdownShortcutsController } from './rich-text-markdown-shortcuts.js';
import type { RichTextShellHost } from './rich-text-providers.js';
import { SelectionController } from './rich-text-selection.js';
import { ShortcutsController } from './rich-text-shortcuts.js';
import { TableCommandsController } from './rich-text-table-commands.js';
import { TableInteractionController } from './rich-text-table-interaction.js';
import { ToolbarController } from './rich-text-toolbar-controller.js';

/** A controller that also draws: the element calls these on every render. */
export interface RichTextRenderingController extends RichTextController {
    /** Drawn in the toolbar region above the editor. */
    renderToolbar?(): TemplateResult | null;
    /** Drawn inside the positioned container, over the editor (panels, menus, floating bars). */
    renderOverlay?(): TemplateResult | null;
}

/** What a controller is built with. */
export type RichTextControllerHost = RichTextCoreHost & RichTextShellHost;

export type RichTextControllerFactory = (host: RichTextControllerHost) => RichTextRenderingController;

/**
 * The controllers in attach order (detached in reverse). Key handlers run by the priorities in
 * `rich-text-key-priority.ts`, so the order here only matters where controllers share a seam:
 * - Insert before Blocks and Clipboard: horizontal rules, toggles and pastes insert through it.
 * - InlineFormats before TableCommands: the tables wrap its bold/italic/... commands to fan out over selected cells.
 * - TableCommands before TableInteraction: the menu reads the commands it provides.
 * - Lists before Selection: the caret is confined to a task row's text before the formats are read from it.
 * - Toolbar last: it wraps every command registered before it, so a format also closes the floating bar.
 */
export const RICH_TEXT_CONTROLLERS: readonly RichTextControllerFactory[] = [
    (host) => new HistoryController(host),
    (host) => new InsertController(host),
    (host) => new ClipboardController(host),
    (host) => new BlocksController(host),
    (host) => new InlineFormatsController(host),
    (host) => new ListsController(host),
    (host) => new TableCommandsController(host),
    (host) => new TableInteractionController(host),
    (host) => new SelectionController(host),
    (host) => new KeyboardController(host),
    (host) => new MarkdownShortcutsController(host),
    (host) => new ShortcutsController(host),
    (host) => new FindController(host),
    (host) => new CodeHighlightController(host),
    (host) => new ToolbarController(host),
];
