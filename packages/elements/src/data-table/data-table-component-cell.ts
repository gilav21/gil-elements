import { nothing } from 'lit';
import { AsyncDirective } from 'lit/async-directive.js';
import { directive, PartType, type PartInfo } from 'lit/directive.js';
import type { ComponentOutputs } from './data-table.types.js';

/**
 * Draws a custom element by tag name in a child part: created once per cell and reused while the tag is unchanged,
 * `inputs` assigned as PROPERTIES (never attributes) and `outputs` added as event listeners. The one way a framework
 * component gets into a cell: expose it as a custom element and name its tag.
 */
class ComponentCellDirective extends AsyncDirective {
    private element: HTMLElement | null = null;
    private outputs: ComponentOutputs = {};
    private listeners = new Map<string, EventListener>();

    constructor(info: PartInfo) {
        super(info);
        if (info.type !== PartType.CHILD) throw new Error('componentCell() works only in a child position');
    }

    render(_tag: string, _inputs?: Readonly<Record<string, unknown>>, _outputs?: ComponentOutputs): unknown {
        return nothing;
    }

    override update(_part: unknown, [tag, inputs = {}, outputs = {}]: Parameters<this['render']>): HTMLElement {
        if (this.element?.localName !== tag.toLowerCase()) {
            this.removeListeners();
            this.element = document.createElement(tag);
            this.element.setAttribute('data-slot', 'cell-component');
        }
        Object.assign(this.element, inputs);
        this.outputs = outputs;
        this.syncListeners();
        return this.element;
    }

    private syncListeners(): void {
        const element = this.element;
        if (!element) return;
        for (const [name, listener] of this.listeners) {
            if (this.outputs[name] === listener) continue;
            element.removeEventListener(name, listener);
            this.listeners.delete(name);
        }
        for (const [name, handler] of Object.entries(this.outputs)) {
            if (this.listeners.has(name)) continue;
            element.addEventListener(name, handler);
            this.listeners.set(name, handler);
        }
    }

    private removeListeners(): void {
        for (const [name, listener] of this.listeners) this.element?.removeEventListener(name, listener);
        this.listeners.clear();
    }

    protected override disconnected(): void {
        this.removeListeners();
    }

    protected override reconnected(): void {
        this.syncListeners();
    }
}

export const componentCell = directive(ComponentCellDirective);
