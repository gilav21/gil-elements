import { INTERACTIVE } from '../shared/activator.js';
import { GePopover } from '../popover/popover.js';
import { defaultTrue } from '../shared/chart/chart-base.js';

/**
 * A button that opens a panel of emoji to pick from. It is a `ge-popover`, so `open`, `show()`, `hide()`, `toggle()` and
 * `close-on-scroll` work as they do there. Put a `ge-emoji-picker-trigger` and a `ge-emoji-picker-content` inside it.
 *
 * @slot - `ge-emoji-picker-trigger` and `ge-emoji-picker-content`.
 * @attr {boolean} open - Whether the panel is showing.
 * @attr {boolean} close-on-select - Closes the panel after a pick. Defaults to true; `close-on-select="false"` lets the user choose several in one visit.
 * @attr {boolean} close-on-scroll - Closes when anything outside the picker scrolls.
 * @fires emoji-select - The user picked an emoji; `detail` is the emoji as a string. A flag or a skin-tone variant is more than one code point, so count it with `Intl.Segmenter`, not `.length`.
 * @fires open-change - The panel opened or closed by the user; `detail` is the new state.
 */
export class GeEmojiPicker extends GePopover {
    static override properties = {
        ...GePopover.properties,
        closeOnSelect: { attribute: 'close-on-select', converter: defaultTrue },
    };

    declare closeOnSelect: boolean;

    constructor() {
        super();
        this.closeOnSelect = true;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'emoji-picker';
    }

    override triggerRect(): DOMRect | null {
        return this.querySelector('ge-emoji-picker-trigger')?.shadowRoot?.querySelector('[part="base"]')?.getBoundingClientRect() ?? null;
    }

    override triggerFocusTarget(): HTMLElement | null {
        const trigger = this.querySelector<HTMLElement>('ge-emoji-picker-trigger');
        return trigger?.querySelector<HTMLElement>(INTERACTIVE) ?? trigger?.shadowRoot?.querySelector<HTMLElement>('[part="base"]') ?? null;
    }

    /** Commits a pick: fires `emoji-select`, then closes unless `close-on-select` is off. Usable from your own controls too. */
    selectEmoji(emoji: string): void {
        this.dispatchEvent(new CustomEvent<string>('emoji-select', { detail: emoji, bubbles: true, composed: true }));
        if (this.closeOnSelect) this.hide();
    }
}
