import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import { registerLayer } from '../shared/overlay.js';
import css from './dialog.css?inline';

export const DIALOG_REGISTER = 'ge-dialog-register';

/** What the parts of a dialog need from it. */
export interface DialogHost {
    readonly open: boolean;
    show(): void;
    hide(): void;
    toggle(): void;
    register(part: DialogPart): void;
    unregister(part: DialogPart): void;
}

/** A part that re-renders when the dialog opens or closes. */
export interface DialogPart extends HTMLElement {
    requestUpdate(): void;
}

/**
 * A modal dialog. This element only holds the open state; put a `ge-dialog-trigger` and a `ge-dialog-content`
 * inside it. Page scroll is locked while it is open, and Escape closes the innermost open dialog only.
 *
 * @slot - `ge-dialog-trigger` and `ge-dialog-content`.
 * @attr {boolean} open - Whether the dialog is showing.
 * @fires open-change - When the user opens or closes it; `detail` is the new state. Setting `open` yourself does not fire it.
 */
export class GeDialog extends UiElement implements DialogHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        open: { type: Boolean, reflect: true },
    };

    declare open: boolean;
    private readonly parts = new Set<DialogPart>();
    private release?: () => void;

    constructor() {
        super();
        this.open = false;
        adoptChildren<DialogHost, DialogPart>(this, DIALOG_REGISTER, (part) => this.register(part));
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.release?.();
        this.release = undefined;
    }

    register(part: DialogPart): void {
        this.parts.add(part);
    }

    unregister(part: DialogPart): void {
        this.parts.delete(part);
    }

    show(): void {
        this.setOpen(true);
    }

    hide(): void {
        this.setOpen(false);
    }

    toggle(): void {
        this.setOpen(!this.open);
    }

    private setOpen(next: boolean): void {
        if (this.open === next) return;
        this.open = next;
        this.dispatchEvent(new CustomEvent<boolean>('open-change', { detail: next, bubbles: true, composed: true }));
    }

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        if (changed.has('open')) this.syncLayer();
        for (const part of this.parts) part.requestUpdate();
    }

    private syncLayer(): void {
        this.release?.();
        this.release = this.open && this.isConnected ? registerLayer({ modal: true, dismiss: () => this.hide() }) : undefined;
    }

    protected override render() {
        return html`<slot></slot>`;
    }
}
