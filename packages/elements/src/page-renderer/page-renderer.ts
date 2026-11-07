import { html, unsafeCSS, type PropertyValues } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import { WidgetCache } from '../shared/widget-cache.js';
import css from './page-renderer.css?inline';
import type { ComponentMeta, PageDashboardItem, PageData } from '../page-builder/page-builder.types.js';
import { resolvePath, toDashboardItem } from '../page-builder/page-builder.utils.js';


/**
 * Renders a saved page, the read-only counterpart of what `ge-page-builder` produces: the grid settings plus the placed
 * widgets, nothing draggable or editable. Each widget is the custom element named by its palette entry's `tag`, given
 * its saved inputs. An item whose `componentId` is not in `components` is dropped, so an incomplete catalogue shows a
 * partial page rather than failing.
 *
 * A binding maps an input name to a dot-path in `context`; a path that resolves overrides the saved value, and one that
 * resolves to `undefined` leaves it alone.
 *
 * @prop {PageData | null} data - The page to render.
 * @prop {ComponentMeta[]} components - Catalogue resolving each item's `componentId` to a tag.
 * @prop {Record<string, unknown>} context - Data source for bindings.
 */
export class GePageRenderer extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        data: { attribute: false },
        components: { attribute: false },
        context: { attribute: false },
    };

    declare data: PageData | null;
    declare components: ComponentMeta[];
    declare context: Record<string, unknown>;

    private readonly widgets = new WidgetCache();
    private readonly renderWidget = (item: PageDashboardItem) => {
        const meta = this.components.find((candidate) => candidate.id === item.componentId);
        return meta ? this.widgets.get(item.id, meta.tag, item.inputs) : html``;
    };

    constructor() {
        super();
        this.data = null;
        this.components = [];
        this.context = {};
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'page-renderer';
    }

    private get items(): PageDashboardItem[] {
        const items: PageDashboardItem[] = [];
        for (const item of this.data?.items ?? []) {
            const inputs = { ...item.inputs };
            for (const [prop, path] of Object.entries(item.bindings ?? {})) {
                const value = resolvePath(this.context, path);
                if (value !== undefined) inputs[prop] = value;
            }
            const resolved = toDashboardItem(item, this.components, inputs);
            if (resolved) items.push(resolved);
        }
        return items;
    }

    protected override willUpdate(changed: PropertyValues<this>): void {
        if (changed.has('data') || changed.has('components')) this.widgets.prune((this.data?.items ?? []).map((item) => item.id));
    }

    protected override render() {
        const grid = this.data?.grid;
        if (!grid) return html``;
        return html`<div class="root" data-slot="page-renderer-root">
            <ge-bento-grid
                .items=${this.items}
                .renderItem=${this.renderWidget}
                cols=${grid.cols}
                row-height=${grid.rowHeight}
                column-width=${grid.columnWidth}
                gap=${grid.gap}
                show-borders=${grid.showBorders ?? true}
                border-radius=${grid.borderRadius}
                item-padding=${grid.itemPadding}
                editable="false"
            ></ge-bento-grid>
        </div>`;
    }
}
