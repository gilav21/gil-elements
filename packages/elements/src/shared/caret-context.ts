/**
 * Whether the caret sits inside code (a `<code>` span or `<pre>` block). Trigger characters such as
 * `@` or `/` are content there, so the mentions and slash-command addons stay quiet.
 */
export function caretIsInCode(doc: Document): boolean {
    const selection = doc.getSelection();
    if (!selection || selection.rangeCount === 0) return false;
    const node = selection.getRangeAt(0).startContainer;
    const element = node instanceof Element ? node : node.parentElement;
    return !!element?.closest('code, pre');
}
