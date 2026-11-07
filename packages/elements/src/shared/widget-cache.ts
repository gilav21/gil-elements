/**
 * One custom element per grid item, kept between renders. A grid asks for an item's content every time it updates; making a
 * fresh element each time would replace the widget, losing its state and replaying its entrance. Instead the element for an
 * item is made once (again only if the item's tag changes) and later calls just set the inputs on it.
 */
export class WidgetCache {
    private readonly entries = new Map<string, { tag: string; element: HTMLElement }>();

    /** The element for `id`, with `inputs` set as properties. `created` is called once for each new element. */
    get(id: string, tag: string, inputs: Record<string, unknown>, created?: (element: HTMLElement) => void): HTMLElement {
        let entry = this.entries.get(id);
        if (entry?.tag !== tag) {
            entry = { tag, element: document.createElement(tag) };
            this.entries.set(id, entry);
            created?.(entry.element);
        }
        const target = entry.element as unknown as Record<string, unknown>;
        for (const [name, value] of Object.entries(inputs)) {
            if (target[name] !== value) target[name] = value;
        }
        return entry.element;
    }

    element(id: string): HTMLElement | undefined {
        return this.entries.get(id)?.element;
    }

    /** Forgets every element whose id is not in `keep`. */
    prune(keep: Iterable<string>): void {
        const wanted = new Set(keep);
        for (const id of this.entries.keys()) if (!wanted.has(id)) this.entries.delete(id);
    }

    forget(id: string): void {
        this.entries.delete(id);
    }

    clear(): void {
        this.entries.clear();
    }
}
