/** Anything `customElements.define` accepts. */
export type ElementConstructor = CustomElementConstructor;

/**
 * Registers `ctor` as `<prefix-name>`. Registering twice with the same constructor is a
 * no-op, so two bundles on one page (or a hot reload) do not throw; a different constructor
 * under an existing tag still throws, because silently keeping the old one would hide a bug.
 */
export function defineElement(name: string, ctor: ElementConstructor, prefix = 'ge'): void {
    const tag = `${prefix}-${name}`;
    const existing = customElements.get(tag);
    if (existing === ctor) return;
    customElements.define(tag, ctor);
}
