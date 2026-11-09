import css from './rich-text-content.css?inline';
import { adoptSheet } from '../shared/adopt-sheet.js';

export { adoptSheet };

/**
 * Adopts the content stylesheet onto the tree the editor lives in. The editable is a light-DOM
 * child, so the document's styles reach it and a shadow stylesheet cannot.
 */
export function adoptRichTextContentStyles(root: Document | ShadowRoot): () => void {
    return adoptSheet(root, 'rich-text-content', css);
}
