import type { ComponentMeta, InputDefinition, InputType, PageData, PageDashboardItem, PageItemData } from './page-builder.types.js';

const BOOLEAN_NAMES = new Set(['disabled', 'checked', 'isOpen', 'visible', 'readonly']);

/** Names that read as flags when nothing else says what the type is. */
export function isBooleanByConvention(name: string): boolean {
    return BOOLEAN_NAMES.has(name) || name.startsWith('is') || name.startsWith('has');
}

interface PropertyDeclaration {
    type?: unknown;
    state?: boolean;
}

/** The public properties of a custom element class: what Lit declares in `static properties`, minus internal state. */
export function reflectInputs(tag: string): Array<{ name: string; declaredType: InputType | null }> {
    const ctor: (CustomElementConstructor & { elementProperties?: Map<PropertyKey, PropertyDeclaration> }) | undefined = customElements.get(tag);
    if (!ctor?.elementProperties) return [];
    const inputs: Array<{ name: string; declaredType: InputType | null }> = [];
    for (const [key, options] of ctor.elementProperties) {
        if (typeof key !== 'string' || options.state) continue;
        inputs.push({ name: key, declaredType: options.type === Number ? 'number' : options.type === Boolean ? 'boolean' : null });
    }
    return inputs;
}

/**
 * What kind of control an input gets: the type of the live value, else of the declared default, else what Lit declares,
 * else the naming convention (`is*`, `has*`, `disabled` and friends read as flags). Anything left is text.
 */
export function resolveInputType(name: string, defaultValue: unknown, instance: Record<string, unknown> | undefined, declared: InputType | null): InputType {
    const live = instance?.[name];
    if (typeof live === 'number') return 'number';
    if (typeof live === 'boolean') return 'boolean';
    if (typeof defaultValue === 'number') return 'number';
    if (typeof defaultValue === 'boolean') return 'boolean';
    if (declared) return declared;
    return isBooleanByConvention(name) ? 'boolean' : 'string';
}

/** The reflected inputs with the hand-written ones merged over them, by name; hand-written ones the element lacks are appended. */
export function mergeInputs(auto: InputDefinition[], manual: InputDefinition[]): InputDefinition[] {
    const merged = [...auto];
    for (const input of manual) {
        const index = merged.findIndex((candidate) => candidate.name === input.name);
        if (index > -1) merged[index] = { ...merged[index], ...input };
        else merged.push(input);
    }
    return merged;
}

/** The palette entry with its `inputs` filled in: read from the element class unless the entry declares its own, which then win. */
export function withInputs(meta: ComponentMeta, instance: Record<string, unknown> | undefined): ComponentMeta {
    const auto: InputDefinition[] = reflectInputs(meta.tag).map(({ name, declaredType }) => {
        const defaultValue = meta.defaultInputs?.[name];
        return { name, type: resolveInputType(name, defaultValue, instance, declaredType), defaultValue };
    });
    if (!meta.inputs || meta.inputs.length === 0) return { ...meta, inputs: auto };
    return { ...meta, inputs: mergeInputs(auto, meta.inputs) };
}

/** A bare number is pixels: `20` and `20px` mean the same; anything else (`1fr`, `2rem`) is kept as typed. */
export function normaliseLength(value: string): string {
    if (value && !Number.isNaN(Number.parseFloat(value)) && Number.isFinite(Number(value))) return `${value}px`;
    return value;
}

/** The row below everything already on the board. */
export function nextFreeRow(items: ReadonlyArray<{ y: number; rows: number }>): number {
    let row = 0;
    for (const item of items) row = Math.max(row, item.y + item.rows);
    return row;
}

/** Looks a dot-path up in `source`; `undefined` for an empty path or any missing step. */
export function resolvePath(source: Record<string, unknown>, path: string): unknown {
    if (!path) return undefined;
    let current: unknown = source;
    for (const key of path.split('.')) {
        if (current === undefined || current === null) return undefined;
        current = (current as Record<string, unknown>)[key];
    }
    return current;
}

/** A saved item as a grid item. `null` when the palette no longer has its component: the item is dropped. */
export function toDashboardItem(item: PageItemData, palette: readonly ComponentMeta[], inputs: Record<string, unknown> = item.inputs ?? {}): PageDashboardItem | null {
    const meta = palette.find((candidate) => candidate.id === item.componentId);
    if (!meta) return null;
    return { id: item.id, x: item.x, y: item.y, cols: item.cols, rows: item.rows, content: meta.name, componentId: meta.id, inputs, bindings: item.bindings ?? {} };
}

export function isPageData(value: unknown): value is PageData {
    const candidate = value as Partial<PageData> | null;
    return !!candidate && typeof candidate === 'object' && !!candidate.grid && Array.isArray(candidate.items);
}
