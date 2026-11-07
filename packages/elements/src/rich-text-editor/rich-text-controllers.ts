import type { TemplateResult } from 'lit';
import type { RichTextController, RichTextCoreHost } from './rich-text-host.js';
import type { RichTextShellHost } from './rich-text-providers.js';

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
 * The core controllers in attach order. Each unit adds one line,
 * e.g. `(host) => new HistoryController(host)`; a controller registers what it provides on `attach()`.
 */
export const RICH_TEXT_CONTROLLERS: readonly RichTextControllerFactory[] = [];
