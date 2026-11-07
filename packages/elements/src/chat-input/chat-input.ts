import { html, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import '../textarea/define.js';
import '../button/define.js';
import type { GeTextarea } from '../textarea/textarea.js';
import css from './chat-input.css?inline';

const ARROW_UP = html`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon" aria-hidden="true"><path d="m5 12 7-7 7 7" /><path d="M12 19V5" /></svg>`;

/**
 * The composer: a growing-free textarea with a send button in its bottom-end corner. Enter sends, Shift+Enter adds a
 * line, and Enter that confirms an IME composition does neither. The draft is cleared as soon as it is sent, without
 * waiting for you, so restore it yourself if the send fails. The draft is sent as typed (only an all-blank one is
 * refused).
 *
 * @fires send - The user sent the draft; `detail` is the text.
 * @attr {string} placeholder - Hint in the empty textarea. Not translated for you. Defaults to `Type a message...`.
 * @attr {boolean} disabled - Blocks sending: the button is disabled and Enter does nothing. The textarea stays editable, so a half-typed message survives.
 * @csspart textarea - The native textarea.
 * @csspart send - The send button.
 */
export class GeChatInput extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        placeholder: { type: String },
        disabled: { type: Boolean, reflect: true },
        draft: { state: true },
    };

    declare placeholder: string;
    declare disabled: boolean;
    declare draft: string;

    constructor() {
        super();
        this.placeholder = 'Type a message...';
        this.disabled = false;
        this.draft = '';
    }

    protected override render() {
        return html`<div class="wrap" data-slot="chat-input">
            <ge-textarea
                rows="1"
                placeholder=${this.placeholder}
                .value=${this.draft}
                @input=${(event: Event) => { this.draft = (event.target as GeTextarea).value; }}
                @keydown=${this.onKey}
            ></ge-textarea>
            <ge-button size="icon" part="send" aria-label="Send message" ?disabled=${!this.draft || this.disabled} @click=${this.submit}>${ARROW_UP}</ge-button>
        </div>`;
    }

    private readonly onKey = (event: KeyboardEvent): void => {
        if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return;
        event.preventDefault();
        this.submit();
    };

    private readonly submit = (): void => {
        if (!this.draft.trim() || this.disabled) return;
        const text = this.draft;
        this.draft = '';
        this.dispatchEvent(new CustomEvent<string>('send', { detail: text, bubbles: true, composed: true }));
    };
}
