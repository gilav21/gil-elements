import { html, nothing, unsafeCSS, type PropertyValues } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { UiElement } from '@gilav21/elements-base';
import { adoptChildren } from '../shared/compound.js';
import css from './tabs.css?inline';

export const TABS_REGISTER = 'ge-tabs-register';

/** One entry for data-driven mode. */
export interface TabOption {
    value: string;
    label: string;
    /** Plain text shown in the panel while this tab is active. */
    content?: string;
    disabled?: boolean;
}

/** A trigger or panel: re-rendered whenever the active tab changes. */
export type TabsPart = HTMLElement & { requestUpdate(): void };

/** The part of the tabs its triggers and panels talk to. */
export interface TabsHost {
    readonly value: string;
    labelOf(value: string): string;
    select(value: string): void;
    register(part: TabsPart): void;
    unregister(part: TabsPart): void;
}

/**
 * Tabbed panels. Put a `ge-tabs-list` of `ge-tabs-trigger`s and one `ge-tabs-content` per tab inside, or set
 * `tabs` and let it build them. Only the panel of the active tab is rendered.
 *
 * @slot - A `ge-tabs-list` and `ge-tabs-content`s.
 * @fires tab-change - When the user picks a tab; `detail` is its value.
 * @attr {string} value - The active tab. With `tabs` set and no value, the first tab is active.
 */
export class GeTabs extends UiElement implements TabsHost {
    static override styles = [UiElement.styles, unsafeCSS(css)];
    static override properties = {
        value: { reflect: true },
        tabs: { attribute: false },
    };

    declare value: string;
    /** Data-driven mode: one trigger and panel per entry. Children are ignored. */
    declare tabs: readonly TabOption[] | undefined;

    private readonly parts = new Set<TabsPart>();

    constructor() {
        super();
        this.value = '';
        this.tabs = undefined;
        adoptChildren<TabsHost, TabsPart>(this, TABS_REGISTER, (part) => this.register(part));
    }

    register(part: TabsPart): void {
        this.parts.add(part);
        part.requestUpdate();
    }

    unregister(part: TabsPart): void {
        this.parts.delete(part);
    }

    /** The visible label of the trigger for `value`, which names that tab's panel. */
    labelOf(value: string): string {
        for (const part of this.parts) {
            if (part.getAttribute('value') === value && part.localName === 'ge-tabs-trigger') return part.textContent?.trim() ?? '';
        }
        return '';
    }

    /** Make `value` the active tab and announce it. */
    select(value: string): void {
        this.value = value;
        this.dispatchEvent(new CustomEvent<string>('tab-change', { detail: value, bubbles: true, composed: true }));
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        const first = this.tabs?.[0];
        if (changed.has('tabs') && this.value === '' && first) this.value = first.value;
    }

    protected override updated(): void {
        for (const part of this.parts) part.requestUpdate();
    }

    protected override render() {
        return html`<div class="tabs" data-slot="tabs">${this.tabs?.length ? this.renderTabs(this.tabs) : html`<slot></slot>`}</div>`;
    }

    private renderTabs(tabs: readonly TabOption[]) {
        return html`<ge-tabs-list>
                ${repeat(
                    tabs,
                    (tab) => tab.value,
                    (tab) => html`<ge-tabs-trigger value=${tab.value} ?disabled=${tab.disabled ?? false}>${tab.label}</ge-tabs-trigger>`,
                )}
            </ge-tabs-list>
            ${repeat(
                tabs.filter((tab) => tab.content),
                (tab) => tab.value,
                (tab) => html`<ge-tabs-content value=${tab.value}>${tab.content ?? nothing}</ge-tabs-content>`,
            )}`;
    }
}
