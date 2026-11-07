import { html, nothing, render, type TemplateResult } from 'lit';
import { createRef, type Ref } from 'lit/directives/ref.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { RichTextAddonHost, RichTextExclusivePopover } from '../rich-text-host.js';
import type { Disposables } from '../rich-text-registry.js';

type PopoverElement = HTMLElement & { hide(): void };

/** What a popover button's template is given for the toolbar instance it draws. */
export interface PopoverButtonView {
    readonly open: boolean;
    /** Disabled, or readonly. */
    readonly disabled: boolean;
    /** Put on the popover element, so the group can close it. */
    readonly popover: Ref<PopoverElement>;
    /** Wire to the popover's `open-change`. */
    readonly onOpenChange: (event: Event) => void;
    close(): void;
}

export interface PopoverButtonOptions {
    readonly id: string;
    readonly order: number;
    /** Draws the popover inside the toolbar instance's shadow root. */
    readonly template: (view: PopoverButtonView) => TemplateResult;
    /** Runs after the selection was saved, when the panel opens. */
    readonly onOpen?: () => void;
    readonly onClose?: () => void;
    /** Scoped to the slot, because the toolbar's own button rules reach everything inside its shadow root. */
    readonly css?: string;
}

export interface PopoverButton {
    /** Redraws every toolbar instance showing the button. */
    update(): void;
    close(): void;
}

interface View extends PopoverButtonView {
    open: boolean;
    disabled: boolean;
    seen: boolean;
    readonly container: HTMLElement;
    readonly exclusive: RichTextExclusivePopover;
}

/** The button to put inside a popover's trigger; the toolbar's own button rules style it. `face` is a constant icon or a template. */
export function triggerButton(label: string, disabled: boolean, face: TemplateResult | string): TemplateResult {
    return html`<button type="button" title=${label} aria-label=${label} ?disabled=${disabled}>${typeof face === 'string' ? unsafeHTML(face) : face}</button>`;
}

/**
 * Registers a toolbar slot whose element is a popover: one per toolbar instance (the top bar and the floating
 * bubble each build their own). Opening a panel saves the editor selection first and closes the group's other
 * panels; a closed panel, or a toolbar instance that left the page, is released.
 */
export function registerPopoverButton(host: RichTextAddonHost, life: Disposables, options: PopoverButtonOptions): PopoverButton {
    const views = new Set<View>();

    const dispose = (view: View): void => {
        view.exclusive.release();
        views.delete(view);
    };

    const draw = (view: View): void => {
        if (view.container.isConnected) view.seen = true;
        else if (view.seen) return dispose(view);
        view.disabled = host.isDisabled || host.readonly;
        render(html`${options.css ? html`<style>${options.css}</style>` : nothing}${options.template(view)}`, view.container);
    };

    const update = (): void => {
        for (const view of views) draw(view);
    };

    const create = (): HTMLElement => {
        const container = document.createElement('span');
        container.style.display = 'contents';
        const popover = createRef<PopoverElement>();
        const view: View = {
            container,
            popover,
            open: false,
            disabled: false,
            seen: false,
            exclusive: host.registerExclusivePopover(() => popover.value?.hide()),
            close: () => popover.value?.hide(),
            onOpenChange: (event) => {
                const open = (event as CustomEvent<boolean>).detail;
                if (open === view.open) return;
                view.open = open;
                if (open) {
                    view.exclusive.notifyOpened();
                    host.saveSelection();
                    options.onOpen?.();
                } else {
                    options.onClose?.();
                }
                draw(view);
            },
        };
        views.add(view);
        draw(view);
        return container;
    };

    life.add(host.toolbarSlots.register({ id: options.id, order: options.order, create }));
    life.add(host.subscribe('state', update));
    life.add(host.subscribe('disabled', update));
    life.add(() => {
        for (const view of views) dispose(view);
    });
    return { update, close: () => views.forEach((view) => view.close()) };
}
