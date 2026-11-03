import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';

/** Whether `event` is the key combination `shortcut` names, such as `Mod+K`; `Mod` is Command on a Mac and Control elsewhere. */
export function matchesShortcut(event: KeyboardEvent, shortcut: string, mac: boolean): boolean {
    const parts = shortcut.toLowerCase().split('+').map((part) => part.trim());
    const key = parts.pop();
    const wants = (name: string) => parts.includes(name);
    const mod = wants('mod');
    const meta = wants('meta') || (mod && mac);
    const ctrl = wants('ctrl') || wants('control') || (mod && !mac);
    return event.key.toLowerCase() === key && event.metaKey === meta && event.ctrlKey === ctrl && event.altKey === wants('alt') && event.shiftKey === wants('shift');
}

/**
 * A command palette in a modal dialog. Project a `ge-command` into it. A global key combination toggles it, and
 * each time it opens the projected `ge-command-input` takes focus.
 *
 * Rows inside get roomier padding and a muted group colour, as in shadcn-angular's dialog.
 *
 * @slot - A `ge-command`.
 * @fires open-change - When the user opens or closes it; `detail` is the new state.
 * @attr {boolean} open - Whether the dialog is showing.
 * @attr {string} shortcut - Key combination that toggles it, in `Mod+K` syntax. Defaults to `Mod+K`.
 * @attr {boolean} no-shortcut - Drops the key binding; drive `open` yourself.
 */
export class GeCommandDialog extends UiElement {
    static override styles = [
        UiElement.styles,
        unsafeCSS(`:host{display:contents;--command-group-px:0.5rem;--command-group-weight:500;--command-group-color:var(--muted-foreground);--command-item-px:0.5rem;--command-item-py:0.75rem}
ge-dialog-content::part(panel){overflow:hidden;padding:0;box-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1),0 4px 6px -4px rgb(0 0 0 / 0.1)}`),
    ];
    static override properties = {
        open: { type: Boolean, reflect: true },
        shortcut: {},
        noShortcut: { type: Boolean, attribute: 'no-shortcut' },
    };

    declare open: boolean;
    declare shortcut: string;
    declare noShortcut: boolean;

    constructor() {
        super();
        this.open = false;
        this.shortcut = 'Mod+K';
        this.noShortcut = false;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'command-dialog';
        document.addEventListener('keydown', this.onKeydown);
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        document.removeEventListener('keydown', this.onKeydown);
    }

    private readonly onKeydown = (event: KeyboardEvent) => {
        if (this.noShortcut || !this.shortcut.trim() || event.defaultPrevented) return;
        if (!matchesShortcut(event, this.shortcut, /mac|iphone|ipad/i.test(navigator.platform))) return;
        event.preventDefault();
        this.open = !this.open;
    };

    private readonly onOpenChange = (event: Event) => {
        event.stopPropagation();
        this.open = (event as CustomEvent<boolean>).detail;
        this.dispatchEvent(new CustomEvent<boolean>('open-change', { detail: this.open, bubbles: true, composed: true }));
    };

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        // After the dialog has rendered its content, so the field exists to be focused.
        if (changed.has('open') && this.open) setTimeout(() => this.querySelector<HTMLElement>('ge-command-input')?.focus());
    }

    protected override render() {
        return html`<ge-dialog .open=${this.open} @open-change=${this.onOpenChange}><ge-dialog-content><slot></slot></ge-dialog-content></ge-dialog>`;
    }
}
