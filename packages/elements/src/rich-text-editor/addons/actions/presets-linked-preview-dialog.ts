import type { RichTextActionHandler } from './actions-runtime.js';
import type { ActionParamsMode, RichTextActionDefinition, RichTextActionField } from './actions-types.js';
import { hoverCardHandlers, type HoverCardPresetOptions } from './presets-hover-card.js';
import { openDialogHandlers, type OpenDialogPresetOptions } from './presets-open-dialog.js';

/** Options for the combined hover-preview + click-dialog preset. */
export interface LinkedPreviewDialogOptions {
    /** Action id (serialized). Default `'preset.linked-preview-dialog'`. */
    id?: string;
    /** Picker label. Default `'Preview + dialog'`. */
    label?: string;
    /** `'shared'` (default) or `'separate'`. */
    paramsMode?: ActionParamsMode;
    /** Extra fields appended after the built-in `title`/`body`/`confirmLabel`. */
    extraFields?: RichTextActionField[];
    /** Close delay for the hover preview, ms. Default 200 (from the hover-card preset). */
    closeDelay?: number;
    /** Forwarded to the hover-card preset. */
    hover?: HoverCardPresetOptions;
    /** Forwarded to the open-dialog preset. */
    dialog?: OpenDialogPresetOptions;
    /** Closes whatever is open when aborted. */
    signal?: AbortSignal;
}

const DEFAULT_ID = 'preset.linked-preview-dialog';

/** A ready-made combined action: hover shows a preview card, click opens a dialog. */
export function linkedPreviewDialogAction(o: LinkedPreviewDialogOptions = {}): RichTextActionDefinition {
    return {
        id: o.id ?? DEFAULT_ID,
        label: o.label ?? 'Preview + dialog',
        icon: 'book-open',
        triggers: ['click', 'hover'],
        combined: true,
        paramsMode: o.paramsMode ?? 'shared',
        fields: [
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'body', label: 'Body', type: 'textarea', required: true },
            { key: 'confirmLabel', label: 'Confirm button label', type: 'text' },
            ...(o.extraFields ?? []),
        ],
    };
}

/**
 * Handlers for the combined preset: one `{ [id]: handler }` entry that sends hover events to the
 * hover-card preset and click events to the open-dialog preset, both re-keyed onto the combined id.
 */
export function linkedPreviewDialogHandlers(o: LinkedPreviewDialogOptions = {}): Record<string, RichTextActionHandler> {
    const id = o.id ?? DEFAULT_ID;
    const signal = o.signal ?? o.hover?.signal;
    const hoverHandler = hoverCardHandlers({ ...o.hover, id, closeDelay: o.hover?.closeDelay ?? o.closeDelay, signal })[id];
    const dialogHandler = openDialogHandlers({ ...o.dialog, id, signal: o.dialog?.signal ?? signal })[id];
    const handler: RichTextActionHandler = (event) => {
        (event.trigger === 'hover' ? hoverHandler : dialogHandler)?.(event);
    };
    return { [id]: handler };
}
