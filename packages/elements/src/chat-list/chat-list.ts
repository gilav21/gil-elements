import { html, unsafeCSS, type PropertyValues } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { UiElement } from '@gilav21/elements-base';
import '../scroll-area/define.js';
import type { GeScrollArea } from '../scroll-area/scroll-area.js';
import css from './chat-list.css?inline';

/**
 * The scrolling column of a conversation: a `ge-scroll-area` that fills the space it is given, around the
 * `ge-chat-message`s you put in it.
 *
 * With `auto-scroll` on it stays pinned to the newest message: it watches its content, including text edits (so a
 * streaming reply keeps following), and jumps to the bottom on every change. It does so unconditionally, so a reader
 * who scrolled up is pulled back down.
 *
 * @attr {boolean} auto-scroll - Keep the list scrolled to the newest message.
 * @csspart scroll-area - The `ge-scroll-area` that scrolls.
 * @slot - The messages.
 */
export class GeChatList extends UiElement {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        autoScroll: { type: Boolean, attribute: 'auto-scroll', reflect: true },
    };

    declare autoScroll: boolean;
    private readonly area = createRef<GeScrollArea>();
    private readonly content = createRef<HTMLElement>();
    private observer: MutationObserver | null = null;

    constructor() {
        super();
        this.autoScroll = false;
    }

    protected override render() {
        return html`<ge-scroll-area ${ref(this.area)} class="area" part="scroll-area" data-slot="chat-list"><div ${ref(this.content)} class="content"><slot></slot></div></ge-scroll-area>`;
    }

    protected override updated(changed: PropertyValues<this>): void {
        if (changed.has('autoScroll')) this.watch();
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.observer?.disconnect();
        this.observer = null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        if (this.hasUpdated) this.watch();
    }

    /** Jumps to the newest message. Done for you while `auto-scroll` is on; call it from a "jump to latest" button when it is off. */
    scrollToBottom(): void {
        this.area.value?.scrollToBottom();
    }

    private watch(): void {
        this.observer?.disconnect();
        this.observer = null;
        if (!this.autoScroll || typeof MutationObserver !== 'function') return;
        // The messages are this element's own children, projected into the content box.
        this.observer = new MutationObserver(() => this.scrollToBottom());
        this.observer.observe(this, { childList: true, subtree: true, characterData: true });
        this.scrollToBottom();
    }
}
