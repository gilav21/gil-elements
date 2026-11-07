import '../../../button/define.js';
import { inheritThemeTokens } from '../../../shared/theme-presets.js';
import type { RichTextActionHandler } from './actions-runtime.js';
import type { ActionParams, RichTextActionDefinition, RichTextActionField } from './actions-types.js';
import { directionOf, mountTopLayer } from './presets-overlay.js';

/** Options for the built-in open-dialog preset. */
export interface OpenDialogPresetOptions {
    /** Action id (also the serialized attribute value). Default `'preset.open-dialog'`. */
    id?: string;
    /** Picker label. Default `'Open dialog'`. */
    label?: string;
    /** Extra fields appended after the built-in `title`/`body`/`confirmLabel`. */
    extraFields?: RichTextActionField[];
    /** Tag of a custom element shown in the dialog body instead of the authored text; it receives the action params as its `params` property. */
    contentTag?: string;
    /** Called when the confirm button is pressed, with the action params. */
    onConfirm?: (params: ActionParams) => void;
    /** Dismisses every open dialog when aborted, e.g. when the page that bound the handlers goes away. */
    signal?: AbortSignal;
}

const DEFAULT_ID = 'preset.open-dialog';

/** A ready-made open-dialog action definition (tier-1 `title`/`body`/`confirmLabel` fields). */
export function openDialogAction(o: OpenDialogPresetOptions = {}): RichTextActionDefinition {
    return {
        id: o.id ?? DEFAULT_ID,
        label: o.label ?? 'Open dialog',
        icon: 'app-window',
        triggers: ['click'],
        fields: [
            { key: 'title', label: 'Title', type: 'text', required: true },
            { key: 'body', label: 'Body', type: 'textarea' },
            { key: 'confirmLabel', label: 'Confirm button label', type: 'text' },
            ...(o.extraFields ?? []),
        ],
    };
}

interface DialogView {
    readonly params: ActionParams;
    readonly dir: 'ltr' | 'rtl';
    readonly contentTag?: string;
    readonly onConfirm: () => void;
    readonly onDismiss: () => void;
}

function button(text: string, variant: 'ghost' | 'default', onClick: () => void): HTMLElement {
    const el = document.createElement('ge-button');
    el.setAttribute('variant', variant);
    el.textContent = text;
    el.addEventListener('click', onClick);
    return el;
}

/** The modal shown on the published page: the authored title and body (or a custom element), Close and confirm buttons. */
function buildDialog(view: DialogView): HTMLElement {
    const { params } = view;
    const slot = document.createElement('div');
    slot.dataset['slot'] = 'preset-dialog';

    const backdrop = document.createElement('button');
    backdrop.type = 'button';
    backdrop.className = 'backdrop';
    backdrop.setAttribute('aria-label', 'Close');
    backdrop.addEventListener('click', view.onDismiss);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.dir = view.dir;

    const title = String(params['title'] ?? '');
    if (title) {
        const heading = document.createElement('h2');
        heading.textContent = title;
        panel.append(heading);
    }
    if (view.contentTag) {
        const content = document.createElement(view.contentTag) as HTMLElement & { params?: ActionParams };
        content.params = params;
        panel.append(content);
    } else {
        const body = document.createElement('p');
        body.className = 'body';
        body.textContent = String(params['body'] ?? '');
        panel.append(body);
    }

    const footer = document.createElement('div');
    footer.className = 'footer';
    const confirm = button(String(params['confirmLabel'] ?? '') || 'OK', 'default', view.onConfirm);
    confirm.dataset['testid'] = 'preset-dialog-confirm';
    footer.append(button('Close', 'ghost', view.onDismiss), confirm);

    panel.append(footer);
    slot.append(backdrop, panel);
    return slot;
}

/**
 * Handlers for the open-dialog preset; spread the returned map into the handlers you bind. Opens a
 * real modal on click showing the authored title and body (or a `contentTag` element) and calls
 * `onConfirm`. Escape, the backdrop, Close and the options' `signal` dismiss it.
 */
export function openDialogHandlers(o: OpenDialogPresetOptions = {}): Record<string, RichTextActionHandler> {
    const id = o.id ?? DEFAULT_ID;
    const openDismissers = new Set<() => void>();

    const handler: RichTextActionHandler = (event) => {
        const { params } = event;
        const dismiss = (): void => {
            document.removeEventListener('keydown', onKeydown);
            openDismissers.delete(dismiss);
            overlay.destroy();
        };
        const onKeydown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') dismiss();
        };
        const overlay = mountTopLayer(buildDialog({
            params,
            dir: directionOf(event.element),
            contentTag: o.contentTag,
            onDismiss: dismiss,
            onConfirm: () => {
                o.onConfirm?.(params);
                dismiss();
            },
        }));
        inheritThemeTokens(event.element, overlay.host);
        openDismissers.add(dismiss);
        document.addEventListener('keydown', onKeydown);
    };

    // Each dismiss() removes only itself from the set; deleting the current element during Set iteration is well-defined.
    o.signal?.addEventListener('abort', () => {
        for (const dismiss of openDismissers) dismiss();
    }, { once: true });
    return { [id]: handler };
}
