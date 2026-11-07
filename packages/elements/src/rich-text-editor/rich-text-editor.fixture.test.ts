import { mount } from '../test-utils.js';
import './define.js';
import type { GeRichTextEditor } from './rich-text-editor.js';

/** Mounts markup holding one editor and waits for it to settle. */
export async function editorIn(markup: string): Promise<GeRichTextEditor> {
    const page = await mount(markup);
    const editor = page.querySelector<GeRichTextEditor>('ge-rich-text-editor')!;
    await editor.updateComplete;
    return editor;
}

/** Creates an editor, lets `setup` configure it (listeners, properties) before it connects, and waits for it to settle. */
export async function createEditor(setup?: (editor: GeRichTextEditor) => void): Promise<GeRichTextEditor> {
    const page = await mount('<div></div>');
    const editor = document.createElement('ge-rich-text-editor') as GeRichTextEditor;
    setup?.(editor);
    page.firstElementChild!.append(editor);
    await editor.updateComplete;
    return editor;
}

export const editableOf = (editor: Element): HTMLDivElement => editor.querySelector<HTMLDivElement>('[data-slot="editor"]')!;

/** Replaces the editable's markup the way typing would and raises the input event the browser raises. */
export async function typeHtml(editor: GeRichTextEditor, markup: string): Promise<void> {
    const editable = editableOf(editor);
    editable.innerHTML = markup;
    editable.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'insertText', data: 'x' }));
    await editor.updateComplete;
}

export function placeCaret(node: Node, offset: number): void {
    const range = new Range();
    range.setStart(node, offset);
    range.collapse(true);
    const selection = document.getSelection()!;
    selection.removeAllRanges();
    selection.addRange(range);
}

/** Records the detail of every `type` event the editor fires. */
export function record<T = unknown>(editor: Element, type: string): T[] {
    const seen: T[] = [];
    editor.addEventListener(type, (event) => seen.push((event as CustomEvent<T>).detail));
    return seen;
}
