import css from './rich-text-content.css?inline';

let sheet: CSSStyleSheet | undefined;
const adopted = new WeakSet<Document | ShadowRoot>();

/**
 * Adopts the content stylesheet onto the tree the editor lives in, once per tree. The editable is a
 * light-DOM child, so the document's styles reach it and a shadow stylesheet cannot. Client only.
 */
export function adoptRichTextContentStyles(root: Document | ShadowRoot): void {
    if (adopted.has(root)) return;
    adopted.add(root);
    sheet ??= new CSSStyleSheet();
    sheet.replaceSync(css);
    root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}
