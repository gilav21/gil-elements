/** `'inline'` flows with the text; `'left'` / `'right'` float with the text wrapping; `'center'` is a centred block. */
export type ImageAlignment = 'inline' | 'left' | 'center' | 'right';

/** Which sources the insert popover offers. */
export type ImageSources = 'all' | 'upload' | 'url';

/** Defaults applied to every inserted image. */
export interface ImageInsertDefaults {
    readonly width?: number | string;
    readonly height?: number | string;
    readonly alignment: ImageAlignment;
}

/** A 1x1 transparent GIF used as the placeholder src while an image uploads. */
export const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const ALIGNMENT_STYLES: Readonly<Record<ImageAlignment, Readonly<Record<string, string>>>> = {
    inline: { display: 'inline', margin: '0' },
    left: { display: 'block', float: 'left', marginRight: '12px', marginBottom: '4px' },
    center: { display: 'block', marginLeft: 'auto', marginRight: 'auto' },
    right: { display: 'block', float: 'right', marginLeft: '12px', marginBottom: '4px' },
};

const ALIGNMENT_PROPERTIES = ['float', 'display', 'margin', 'margin-left', 'margin-right'] as const;

/** Applies the inline styles of an alignment; shared by the overlay and the insert path so both produce identical markup. */
export function applyImageAlignment(img: HTMLImageElement, align: ImageAlignment): void {
    for (const property of ALIGNMENT_PROPERTIES) img.style.removeProperty(property);
    Object.assign(img.style, ALIGNMENT_STYLES[align]);
}

/** A number is pixels; a string is passed through (`'50%'`, `'20rem'`). */
export function parseImageSize(value: number | string): string {
    return typeof value === 'number' ? `${value}px` : value;
}

export function createImageElement(doc: Document, src: string, alt: string, defaults: ImageInsertDefaults): HTMLImageElement {
    const img = doc.createElement('img');
    img.setAttribute('src', src);
    img.setAttribute('alt', alt || 'Image');
    if (defaults.width !== undefined) img.style.width = parseImageSize(defaults.width);
    if (defaults.height !== undefined) img.style.height = parseImageSize(defaults.height);
    img.dataset['align'] = defaults.alignment;
    applyImageAlignment(img, defaults.alignment);
    return img;
}

/** Inserts `img` at the selection inside `root` (appends when the selection is elsewhere) and puts the caret after it. */
export function placeImageAtSelection(doc: Document, root: HTMLElement, img: HTMLImageElement, selection: Selection | null = doc.getSelection()): void {
    if (!selection || selection.rangeCount === 0) {
        root.appendChild(img);
        return;
    }
    const range = selection.getRangeAt(0);
    if (root.contains(range.commonAncestorContainer)) {
        range.deleteContents();
        range.insertNode(img);
    } else {
        root.appendChild(img);
    }
    const after = doc.createRange();
    after.setStartAfter(img);
    after.collapse(true);
    selection.removeAllRanges();
    selection.addRange(after);
}

export function dataUrlToFile(dataUrl: string, filename: string): File {
    const [meta = '', base64 = ''] = dataUrl.split(',');
    const mime = /:([^;]{0,4096});/.exec(meta)?.[1] ?? 'image/png';
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (char) => char.codePointAt(0) ?? 0);
    return new File([bytes], filename, { type: mime });
}

export function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Could not read image file.'));
        reader.readAsDataURL(file);
    });
}
