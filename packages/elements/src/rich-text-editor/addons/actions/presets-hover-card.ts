import { inheritThemeTokens } from '../../../shared/theme-presets.js';
import type { RichTextActionEvent, RichTextActionHandler } from './actions-runtime.js';
import type { RichTextActionDefinition, RichTextActionField } from './actions-types.js';
import { anchorOverlay, directionOf, mountTopLayer, type MountedOverlay } from './presets-overlay.js';

/** Options for the built-in hover-card preset. */
export interface HoverCardPresetOptions {
    /** Action id (also the serialized attribute value). Default `'preset.hover-card'`. */
    id?: string;
    /** Picker label. Default `'Hover card'`. */
    label?: string;
    /** Extra fields appended after the built-in `title`/`body`. */
    extraFields?: RichTextActionField[];
    /** Delay before the card closes on hover-end, ms. Default 200. */
    closeDelay?: number;
    /** Closes the open card when aborted, e.g. when the page that bound the handlers goes away. */
    signal?: AbortSignal;
}

const DEFAULT_ID = 'preset.hover-card';

/** A ready-made hover-card action definition (tier-1 `title`/`body` fields). */
export function hoverCardAction(o: HoverCardPresetOptions = {}): RichTextActionDefinition {
    return {
        id: o.id ?? DEFAULT_ID,
        label: o.label ?? 'Hover card',
        icon: 'sparkles',
        triggers: ['hover'],
        fields: [
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'body', label: 'Body', type: 'textarea', required: true },
            ...(o.extraFields ?? []),
        ],
    };
}

function paragraph(className: string, text: string): HTMLParagraphElement {
    const p = document.createElement('p');
    p.className = className;
    p.textContent = text;
    return p;
}

/** The card shown on the published page: a bold title line (omitted when empty) over muted body text. */
function buildCard(title: string, body: string, dir: 'ltr' | 'rtl'): HTMLElement {
    const slot = document.createElement('div');
    slot.dataset['slot'] = 'preset-hover-card';
    const card = document.createElement('div');
    card.className = 'card';
    card.dir = dir;
    if (title) card.append(paragraph('title', title));
    card.append(paragraph('body', body));
    slot.append(card);
    return slot;
}

/**
 * Handlers for the hover-card preset; spread the returned map into the handlers you bind. Renders a
 * floating card in the top layer on hover-start and removes it (after `closeDelay`) on hover-end, on Escape,
 * or when the options' `signal` aborts.
 */
export function hoverCardHandlers(o: HoverCardPresetOptions = {}): Record<string, RichTextActionHandler> {
    const id = o.id ?? DEFAULT_ID;
    const closeDelay = o.closeDelay ?? 200;
    let open: MountedOverlay | null = null;
    let closeTimer: ReturnType<typeof setTimeout> | undefined;
    let onKeydown: ((e: KeyboardEvent) => void) | null = null;

    const cancelClose = (): void => clearTimeout(closeTimer);
    const close = (): void => {
        cancelClose();
        if (onKeydown) document.removeEventListener('keydown', onKeydown);
        onKeydown = null;
        open?.destroy();
        open = null;
    };
    const scheduleClose = (): void => {
        cancelClose();
        closeTimer = setTimeout(close, closeDelay);
    };

    const handler: RichTextActionHandler = (event: RichTextActionEvent) => {
        if (event.phase === 'end') {
            scheduleClose();
            return;
        }
        close();
        const overlay = mountTopLayer(buildCard(
            String(event.params['title'] ?? ''), String(event.params['body'] ?? ''), directionOf(event.element),
        ));
        open = overlay;
        inheritThemeTokens(event.element, overlay.host);
        anchorOverlay(overlay.host, event.element);
        // Grace area: the card stays open while the pointer is over it.
        overlay.host.addEventListener('mouseenter', cancelClose);
        overlay.host.addEventListener('mouseleave', scheduleClose);
        onKeydown = (e) => {
            if (e.key === 'Escape') close();
        };
        document.addEventListener('keydown', onKeydown);
    };

    o.signal?.addEventListener('abort', close, { once: true });
    return { [id]: handler };
}
