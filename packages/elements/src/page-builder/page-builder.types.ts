import type { DashboardItem } from '../bento-grid/index.js';

export type InputType = 'string' | 'number' | 'boolean' | 'select' | 'json' | 'color';

export type PageBuilderViewMode = 'edit' | 'preview';

/** One editable property of a widget, as the property editor draws it. */
export interface InputDefinition {
    name: string;
    type: InputType;
    label?: string;
    /** The choices of a `select`. */
    options?: string[];
    defaultValue?: unknown;
}

export interface PageGridConfig {
    cols: number;
    rowHeight: string;
    columnWidth: string;
    gap: string;
    showBorders?: boolean;
    borderRadius: string;
    itemPadding: string;
    squareCells?: boolean;
}

export interface PageItemData {
    id: string;
    x: number;
    y: number;
    cols: number;
    rows: number;
    componentId: string;
    inputs?: Record<string, unknown>;
    /** Maps an input name to a dot-path in the renderer's `context` (`title` to `user.name`). */
    bindings?: Record<string, string>;
}

/** The saved document: what `save` emits and what `data` and a `ge-page-renderer` take. */
export interface PageData {
    grid: PageGridConfig;
    items: PageItemData[];
    timestamp?: string;
}

/** One palette entry. */
export interface ComponentMeta {
    /** Unique id; saved layouts refer to a widget by it. */
    id: string;
    name: string;
    description?: string;
    category: string;
    /** Tag name of the custom element to create, such as `ge-badge`. */
    tag: string;
    /** Name of a `ge-icon` glyph. */
    icon?: string;
    defaultInputs?: Record<string, unknown>;
    /** Schema for the property editor, merged over the properties read from the element class. */
    inputs?: InputDefinition[];
    defaultCols?: number;
    defaultRows?: number;
}

/** A grid item carrying what the builder and renderer need: which palette entry it is, and its inputs. */
export interface PageDashboardItem extends DashboardItem {
    componentId: string;
    inputs: Record<string, unknown>;
    bindings: Record<string, string>;
}
