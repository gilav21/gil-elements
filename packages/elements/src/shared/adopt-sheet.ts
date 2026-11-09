interface AdoptedSheet {
    readonly sheet: CSSStyleSheet;
    users: number;
}

const adopted = new WeakMap<Document | ShadowRoot, Map<string, AdoptedSheet>>();

/**
 * Adopts a stylesheet onto a tree, once per `key`; later calls share it. The returned teardown
 * releases one use and removes the sheet with the last. Client only.
 */
export function adoptSheet(root: Document | ShadowRoot, key: string, source: string): () => void {
    const sheets = adopted.get(root) ?? new Map<string, AdoptedSheet>();
    adopted.set(root, sheets);
    let entry = sheets.get(key);
    if (!entry) {
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(source);
        root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
        entry = { sheet, users: 0 };
        sheets.set(key, entry);
    }
    const current = entry;
    current.users++;
    let released = false;
    return () => {
        if (released) return;
        released = true;
        if (--current.users > 0) return;
        sheets.delete(key);
        root.adoptedStyleSheets = root.adoptedStyleSheets.filter((other) => other !== current.sheet);
    };
}
