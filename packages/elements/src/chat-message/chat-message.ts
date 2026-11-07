import { html, nothing, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import '../avatar/define.js';
import css from './chat-message.css?inline';

export type ChatSender = 'user' | 'assistant' | 'system';

/**
 * One message in a conversation. Who sent it drives the layout: a `user` message sits at the end in a primary bubble
 * with the avatar last, an `assistant` message at the start in a muted bordered bubble, and a `system` message is
 * centred italic meta text with no avatar. The element draws no box of its own.
 *
 * Give it `content` for plain text. Anything projected into it replaces `content`, which is how markdown, tool calls
 * or attachments are rendered.
 *
 * The sender is `sender`, not `role`: on an element `role` is the ARIA role, and `role="assistant"` is not one.
 *
 * @attr {'user' | 'assistant' | 'system'} sender - Who sent the message. Defaults to `user`.
 * @attr {string} content - The text for plain messages. Ignored once anything is projected.
 * @attr {string} avatar-src - Avatar image URL. While it loads, or when it fails or is omitted, `avatar-fallback` shows. No avatar is drawn for `system`.
 * @attr {string} avatar-fallback - Initials for the avatar; one or two characters. Defaults to `?`.
 * @csspart row - The flex line holding the avatar and the bubble.
 * @csspart bubble - The message bubble.
 * @slot - Rich message content.
 */
export class GeChatMessage extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        sender: { type: String, reflect: true },
        content: { type: String },
        avatarSrc: { type: String, attribute: 'avatar-src' },
        avatarFallback: { type: String, attribute: 'avatar-fallback' },
        projected: { state: true },
    };

    declare sender: ChatSender;
    declare content: string;
    declare avatarSrc: string;
    declare avatarFallback: string;
    declare projected: boolean;

    constructor() {
        super();
        this.sender = 'user';
        this.content = '';
        this.avatarSrc = '';
        this.avatarFallback = '?';
        this.projected = false;
    }

    protected override render() {
        return html`<div class="row" part="row" data-slot="chat-message" data-sender=${this.sender}>
            ${this.sender === 'system'
                ? nothing
                : html`<ge-avatar class="avatar" src=${this.avatarSrc} fallback=${this.avatarFallback}></ge-avatar>`}
            <div class="bubble" part="bubble" data-slot="chat-bubble">
                <span ?hidden=${!this.projected}><slot @slotchange=${this.measure}></slot></span>
                ${!this.projected && this.content ? html`<span>${this.content}</span>` : nothing}
            </div>
        </div>`;
    }

    private readonly measure = (event: Event): void => {
        const slot = event.target as HTMLSlotElement;
        this.projected = slot.assignedNodes().some((node) => node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim()));
    };
}
