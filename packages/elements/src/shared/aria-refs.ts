/**
 * Resolves a space-separated id list on a shadow host to elements. ID references stop at a shadow
 * boundary, so the inner control is handed the elements themselves, which may live in the host's own tree.
 */
export function resolveIdRefs(host: Element, ids: string | null): HTMLElement[] | null {
    if (!ids) return null;
    const root = host.getRootNode() as Document | ShadowRoot;
    return ids
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => root.getElementById(id))
        .filter((el): el is HTMLElement => el !== null);
}
