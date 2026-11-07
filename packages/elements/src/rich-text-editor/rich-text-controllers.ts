import type { TemplateResult } from 'lit';
import { BlocksController } from './rich-text-blocks.js';
import { HistoryController } from './rich-text-history.js';
import type { RichTextController, RichTextCoreHost } from './rich-text-host.js';
import { InlineFormatsController } from './rich-text-inline-formats.js';
import { InsertController } from './rich-text-insert.js';
import { KeyboardController } from './rich-text-keyboard.js';
import { ListsController } from './rich-text-lists.js';
import type { RichTextShellHost } from './rich-text-providers.js';
import { SelectionController } from './rich-text-selection.js';

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
 * The core controllers in attach order. Key handlers run by the priorities in `rich-text-key-priority.ts`,
 * so the order here only matters where controllers hook the same event:
 * - Insert before Blocks: horizontal rules and toggles insert through it.
 * - Lists before Selection: the caret is confined to a task row's text before the formats are read from it.
 */
export const RICH_TEXT_CONTROLLERS: readonly RichTextControllerFactory[] = [
    (host) => new HistoryController(host),
    (host) => new InsertController(host),
    (host) => new BlocksController(host),
    (host) => new InlineFormatsController(host),
    (host) => new ListsController(host),
    (host) => new SelectionController(host),
    (host) => new KeyboardController(host),
];
