import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { GePopoverContent } from '../../popover/sub/popover-content.js';
import { prefersReducedMotion } from '../../shared/motion.js';
import { EMOJI_CATEGORIES, type EmojiCategory } from '../emoji-picker.categories.js';
import { EMOJI_DATA } from '../emoji-picker.keywords.js';
import type { GeEmojiPicker } from '../emoji-picker.js';
import css from './emoji-picker-content.css?inline';

/** How many leading keywords make up an emoji's spoken name. */
const EMOJI_LABEL_WORDS = 3;
/** How far below the top of the grid a section may start and still count as the one being read. */
const SPY_BUFFER = 50;
/** How long the scroll-spy stays quiet while a tab click scrolls, so it cannot fight the animation. */
const SCROLL_SETTLE_MS = 800;

const SEARCH_ICON = html`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon" aria-hidden="true"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>`;

/**
 * An emoji's accessible name. A bare glyph is read as whatever the screen reader's table holds, often "unknown character";
 * the first few search keywords separate emoji that share a lead word ("person red hair" vs "person white hair").
 */
export function emojiLabel(emoji: string): string {
    const keywords = EMOJI_DATA[emoji];
    return keywords?.length ? keywords.slice(0, EMOJI_LABEL_WORDS).join(' ') : emoji;
}

/** The categories with only the emoji matching `query` (by category name, glyph or keyword); empty ones drop out. */
export function filterCategories(query: string): EmojiCategory[] {
    const needle = query.toLowerCase().trim();
    if (!needle) return EMOJI_CATEGORIES;
    return EMOJI_CATEGORIES.map((category) => ({
        ...category,
        emojis: category.emojis.filter(
            (emoji) => category.name.toLowerCase().includes(needle) || emoji.includes(needle) || (EMOJI_DATA[emoji]?.some((keyword) => keyword.toLowerCase().includes(needle)) ?? false),
        ),
    })).filter((category) => category.emojis.length > 0);
}

/**
 * The emoji panel: a search box, one tab per category and a scrolling grid. Place it inside a `ge-emoji-picker`. It
 * is a `ge-popover-content`, so `side`, `align` (default `start`), `side-offset`, `no-collisions` and `strategy`
 * (`fixed` escapes clipping ancestors) work as they do there.
 *
 * @csspart panel - The panel.
 */
export class GeEmojiPickerContent extends GePopoverContent {
    static override readonly styles = [...GePopoverContent.styles, unsafeCSS(css)];
    static override readonly properties = {
        ...GePopoverContent.properties,
        query: { state: true },
        active: { state: true },
    };

    declare private query: string;
    declare private active: string;
    private viewport?: HTMLElement;
    private scrollingByTab = false;
    private settleTimer?: ReturnType<typeof setTimeout>;

    constructor() {
        super();
        this.align = 'start';
        this.query = '';
        this.active = EMOJI_CATEGORIES[0]?.id ?? '';
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'emoji-picker-content';
    }

    override disconnectedCallback(): void {
        super.disconnectedCallback();
        this.viewport?.removeEventListener('scroll', this.onScroll);
        this.viewport = undefined;
        clearTimeout(this.settleTimer);
    }

    protected override updated(changed: PropertyValues<this>): void {
        super.updated(changed);
        this.bindViewport();
    }

    /** The scroll area is rebuilt each time the panel opens, so its viewport is picked up again here. */
    private bindViewport(): void {
        const viewport = this.shadowRoot?.querySelector('ge-scroll-area')?.shadowRoot?.querySelector<HTMLElement>('[part="viewport"]') ?? undefined;
        if (viewport === this.viewport) return;
        this.viewport?.removeEventListener('scroll', this.onScroll);
        this.viewport = viewport;
        viewport?.addEventListener('scroll', this.onScroll, { passive: true });
        if (viewport) this.onScroll();
    }

    protected override renderPanelBody() {
        const categories = filterCategories(this.query);
        return html`<div class="body">
            <ge-input-group>
                <ge-input-group-addon>${SEARCH_ICON}</ge-input-group-addon>
                <ge-input variant="ghost" type="text" placeholder="Search emojis..." aria-label="Search emojis" .value=${this.query} @input=${this.onSearch}></ge-input>
            </ge-input-group>
            <div class="tabs">
                ${EMOJI_CATEGORIES.map(
                    (category) => html`<ge-tooltip content=${category.name}>
                        <ge-tooltip-trigger>
                            <button type="button" class="tab" aria-label=${category.name} aria-current=${this.active === category.id ? 'true' : 'false'} @click=${() => this.scrollToCategory(category.id)}>${category.icon}</button>
                        </ge-tooltip-trigger>
                    </ge-tooltip>`,
                )}
            </div>
            <ge-scroll-area>
                <div class="scroll">
                    ${categories.map(
                        (category) => html`<div class="section" data-category=${category.id}>
                            <div class="heading">${category.name}</div>
                            <div class="grid">
                                ${category.emojis.map((emoji) => html`<button type="button" class="emoji" aria-label=${emojiLabel(emoji)} @click=${() => this.pick(emoji)}>${emoji}</button>`)}
                            </div>
                        </div>`,
                    )}
                    ${categories.length === 0
                        ? html`<div class="empty"><span class="empty-icon">🔍</span><span>No emojis found</span></div>`
                        : nothing}
                </div>
            </ge-scroll-area>
        </div>`;
    }

    private readonly onSearch = (event: Event) => {
        this.query = (event.target as HTMLInputElement).value;
    };

    private pick(emoji: string): void {
        (this.owner as GeEmojiPicker | undefined)?.selectEmoji(emoji);
    }

    /** Jumps to a category. The search is cleared first, so every category is there to scroll to. */
    private async scrollToCategory(id: string): Promise<void> {
        this.query = '';
        this.active = id;
        this.scrollingByTab = true;
        clearTimeout(this.settleTimer);
        await this.updateComplete;
        if (!this.alignTo(id, prefersReducedMotion() ? 'auto' : 'smooth')) {
            this.scrollingByTab = false;
            return;
        }
        // Sections below the fold have only an estimated height (content-visibility) until they are scrolled past, so the
        // distance measured up front is off; once the animation is done, settle on the real position.
        this.settleTimer = setTimeout(() => {
            this.alignTo(id, 'auto');
            this.scrollingByTab = false;
        }, SCROLL_SETTLE_MS);
    }

    private alignTo(id: string, behavior: ScrollBehavior): boolean {
        const viewport = this.viewport;
        const section = this.shadowRoot?.querySelector<HTMLElement>(`[data-category="${id}"]`);
        if (!viewport || !section) return false;
        viewport.scrollTo({ top: viewport.scrollTop + section.getBoundingClientRect().top - viewport.getBoundingClientRect().top, behavior });
        return true;
    }

    /** The active tab follows the last section whose top has reached the top of the grid. */
    private readonly onScroll = () => {
        const viewport = this.viewport;
        if (this.scrollingByTab || !viewport) return;
        const edge = viewport.getBoundingClientRect().top + SPY_BUFFER;
        let current: string | undefined;
        for (const section of this.shadowRoot?.querySelectorAll<HTMLElement>('.section') ?? []) {
            if (section.getBoundingClientRect().top > edge) break;
            current = section.dataset.category;
        }
        if (current && current !== this.active) this.active = current;
    };
}
