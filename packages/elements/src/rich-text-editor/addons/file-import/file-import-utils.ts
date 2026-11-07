import { sniffImageMime } from '../../../file-viewer/parsers/image-validator.js';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
export const PDF_MIME = 'application/pdf';

/** Picker `accept` for the two document formats this addon parses itself. */
export const DOCUMENT_IMPORT_ACCEPT = '.pdf,.docx';

/**
 * Added to the picker while an addon owns image files. The addon never inserts an image itself,
 * and drops stay documents-only: the images addon already claims image drops and pastes, and the
 * first interceptor to claim a drop wins, so claiming them here would depend on registration order.
 */
export const IMAGE_IMPORT_ACCEPT = '.png,.jpg,.jpeg,.gif,.webp';

/** Bytes that identify every accepted format. */
export const HEADER_BYTES = 12;

export type DocumentImportKind = { readonly type: 'docx' } | { readonly type: 'pdf' };

export type ImportKind = DocumentImportKind | { readonly type: 'image'; readonly mime: string };

const startsWith = (bytes: Uint8Array, signature: readonly number[]): boolean =>
    bytes.length >= signature.length && signature.every((byte, index) => bytes[index] === byte);

/** A ZIP local-file header (`PK\x03\x04`): a DOCX. */
export const isZipHeader = (header: Uint8Array): boolean => startsWith(header, [0x50, 0x4b, 0x03, 0x04]);

/** `%PDF-`. */
export const isPdfHeader = (header: Uint8Array): boolean => startsWith(header, [0x25, 0x50, 0x44, 0x46, 0x2d]);

/** Identifies a picked file from its leading bytes, ignoring its spoofable `type`; null when unsupported. */
export function classifyImport(header: Uint8Array): ImportKind | null {
    if (isZipHeader(header)) return { type: 'docx' };
    if (isPdfHeader(header)) return { type: 'pdf' };
    const mime = sniffImageMime(header);
    return mime ? { type: 'image', mime } : null;
}

export function isSupportedDocumentFile(file: File): boolean {
    return file.type === PDF_MIME || file.type === DOCX_MIME || file.name.endsWith('.pdf') || file.name.endsWith('.docx');
}

/** FNV-1a, used to dedupe injected font stylesheets. */
export function simpleHash(text: string): string {
    let hash = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        hash ^= text.codePointAt(i) ?? 0;
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}

/** A drag with no inspectable items is optimistically accepted. */
export function dragHasSupportedDocument(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer?.items) return true;
    return Array.from(dataTransfer.items).some((item) => item.kind === 'file' && (item.type === PDF_MIME || item.type === DOCX_MIME));
}
