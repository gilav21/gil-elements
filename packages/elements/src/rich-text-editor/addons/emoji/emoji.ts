import { html } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { defineAddon, resolveAddonLocale } from '../../rich-text-addon-kit.js';
import type { RichTextAddonOptions } from '../../rich-text-host.js';
import { registerPopoverButton, triggerButton } from '../../rich-text-popover-button.js';
import { RICH_TEXT_EMOJI_LOCALES, type RichTextEmojiLocale } from './emoji-locale.js';

export const EMOJI_SLOT_ID = 'emoji.insert';

const ICON =
    '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" x2="9.01" y1="9" y2="9"/><line x1="15" x2="15.01" y1="9" y2="9"/></svg>';

export interface RichTextEmojiOptions extends RichTextAddonOptions {
    /** A locale id or a full dictionary, instead of the editor's. */
    readonly locale?: string | RichTextEmojiLocale;
}

export const emojiAddon = defineAddon<RichTextEmojiOptions>('emoji', 400, ({ host, options, life }) => {
    if (!options.toolbar) return;
    const locale = resolveAddonLocale(RICH_TEXT_EMOJI_LOCALES, host, options.locale);

    const insert = (event: Event): void => {
        if (host.isDisabled || host.readonly) return;
        const emoji = (event as CustomEvent<string>).detail;
        host.insertTextFromOverlay(emoji);
        host.emit('emoji-insert', emoji);
    };

    registerPopoverButton(host, life, {
        id: EMOJI_SLOT_ID,
        order: options.order,
        template: (view) => html`<ge-emoji-picker
            close-on-select="false"
            close-on-scroll
            ${ref(view.popover)}
            @open-change=${view.onOpenChange}
            @emoji-select=${insert}
        >
            <ge-emoji-picker-trigger>${triggerButton(locale.insertEmoji, view.disabled, ICON)}</ge-emoji-picker-trigger>
            <ge-emoji-picker-content strategy="fixed"></ge-emoji-picker-content>
        </ge-emoji-picker>`,
    });
});
