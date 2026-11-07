import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { isEditable } from '../../shared/shortcut.js';
import { shortcutBindings, type ShortcutComponentHandle } from '../../shared/shortcut-bindings.js';

export { matchesShortcut } from '../../shared/shortcut.js';

/**
 * A command palette in a modal dialog. Project a `ge-command` into it. A global key combination toggles it, and
 * each time it opens the projected `ge-command-input` takes focus.
 *
 * Rows inside get roomier padding and a muted group colour, as in shadcn-angular's dialog.
 *
 * @slot - A `ge-command`.
 * @fires open-change - When the user opens or closes it; `detail` is the new state.
 * @attr {boolean} open - Whether the dialog is showing.
 * @attr {string} shortcut - Key combinations that toggle it, in `Mod+K` syntax; separate alternatives with commas (`Mod+K, /`). Defaults to `Mod+K`.
 * @attr {boolean} no-shortcut - Drops the key binding; drive `open` yourself.
 */
export class GeCommandDialog extends UiElement {
    static override readonly styles = [
        UiElement.styles,
        unsafeCSS(`:host{display:contents;--command-group-px:0.5rem;--command-group-weight:500;--command-group-color:var(--muted-foreground);--command-item-px:0.5rem;--command-item-py:0.75rem}
ge-dialog-content::part(panel){overflow:hidden;padding:0;box-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1),0 4px 6px -4px rgb(0 0 0 / 0.1)}`),
    ];
    static override readonly properties = {
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

    private binding?: ShortcutComponentHandle;

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'command-dialog';
        this.bindShortcut();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.binding?.unregister();
        this.binding = undefined;
    }

    /** One registration per comma-separated alternative, so each can be remapped on its own in the shortcuts dialog. */
    private bindShortcut(): void {
        this.binding?.unregister();
        this.binding = undefined;
        const combos = this.noShortcut ? [] : this.shortcut.split(',').map((combo) => combo.trim()).filter(Boolean);
        if (combos.length === 0) return;
        this.binding = shortcutBindings.registerComponent(
            'command-dialog',
            combos.map((combo, index) => ({
                actionId: index === 0 ? 'command-dialog.toggle' : `command-dialog.toggle-${index + 1}`,
                description: 'Open or close the command palette',
                defaultShortcut: combo,
                category: 'Navigation',
                scope: 'global',
                // A bare key such as `/` must not steal typing from a field.
                when: (event) => combo.includes('+') || !isEditable(event.target),
                handler: () => {
                    this.open = !this.open;
                },
            })),
        );
    }

    private readonly onOpenChange = (event: Event) => {
        event.stopPropagation();
        this.open = (event as CustomEvent<boolean>).detail;
        this.dispatchEvent(new CustomEvent<boolean>('open-change', { detail: this.open, bubbles: true, composed: true }));
    };

    protected override updated(changed: Map<PropertyKey, unknown>): void {
        if (this.isConnected && (changed.has('shortcut') || changed.has('noShortcut'))) this.bindShortcut();
        // After the dialog has rendered its content, so the field exists to be focused.
        if (changed.has('open') && this.open) setTimeout(() => this.querySelector<HTMLElement>('ge-command-input')?.focus());
    }

    protected override render() {
        return html`<ge-dialog .open=${this.open} @open-change=${this.onOpenChange}><ge-dialog-content><slot></slot></ge-dialog-content></ge-dialog>`;
    }
}
