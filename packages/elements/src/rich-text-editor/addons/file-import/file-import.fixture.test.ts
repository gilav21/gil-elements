const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c;
    }
    return table;
})();

const crc32 = (data: Uint8Array): number => {
    let crc = 0xffffffff;
    for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
};
const u16 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

/** A minimal stored-entry ZIP, enough to build a real .docx in code. */
export function makeZip(files: ReadonlyArray<{ name: string; content: string }>): Uint8Array<ArrayBuffer> {
    const encoder = new TextEncoder();
    const entries = files.map((f) => ({ name: encoder.encode(f.name), data: encoder.encode(f.content) }));
    const local: number[] = [];
    const central: number[] = [];
    const offsets: number[] = [];
    for (const { name, data } of entries) {
        offsets.push(local.length);
        local.push(
            ...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
            ...u32(crc32(data)), ...u32(data.length), ...u32(data.length),
            ...u16(name.length), ...u16(0), ...name, ...data,
        );
    }
    entries.forEach(({ name, data }, i) => {
        central.push(
            ...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
            ...u32(crc32(data)), ...u32(data.length), ...u32(data.length),
            ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0),
            ...u32(offsets[i] ?? 0), ...name,
        );
    });
    const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(entries.length), ...u16(entries.length), ...u32(central.length), ...u32(local.length), ...u16(0)];
    return new Uint8Array([...local, ...central, ...end]);
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const R = 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function docxFile(text = 'Imported DOCX text', runProperties = ''): File {
    const documentXml = `<?xml version="1.0"?><w:document ${W}><w:body><w:p><w:r>${runProperties}<w:t>${text}</w:t></w:r></w:p></w:body></w:document>`;
    return new File([makeZip([{ name: 'word/document.xml', content: documentXml }])], 'in.docx', { type: DOCX_MIME });
}

export function emptyDocxFile(): File {
    const documentXml = `<?xml version="1.0"?><w:document ${W}><w:body></w:body></w:document>`;
    return new File([makeZip([{ name: 'word/document.xml', content: documentXml }])], 'empty.docx');
}

/** Run colour, shading and font carry an attribute breakout and the hyperlink targets `javascript:`. */
export function hostileDocxFile(): File {
    const breakout = 'x&quot; onmouseover=&quot;alert(1)';
    const documentXml = `<?xml version="1.0"?><w:document ${W} ${R}><w:body><w:p>`
        + `<w:r><w:rPr><w:color w:val="${breakout}"/><w:shd w:fill="${breakout}"/><w:rFonts w:ascii="${breakout}"/></w:rPr><w:t>hostile run</w:t></w:r>`
        + '<w:hyperlink r:id="rId1"><w:r><w:t>script link</w:t></w:r></w:hyperlink></w:p></w:body></w:document>';
    const rels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        + '<Relationship Id="rId1" Type="x" Target="javascript:alert(1)"/></Relationships>';
    return new File([makeZip([
        { name: 'word/document.xml', content: documentXml },
        { name: 'word/_rels/document.xml.rels', content: rels },
    ])], 'hostile.docx');
}

export function pngFile(name = 'photo.png'): File {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52]);
    return new File([bytes], name, { type: 'image/png' });
}

/** A one-page PDF around a content stream. */
export function pdfBytesWithStream(stream: string): Uint8Array<ArrayBuffer> {
    const objects = [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
        `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    ];
    let body = '%PDF-1.4\n';
    const offsets: number[] = [];
    objects.forEach((content, i) => {
        offsets.push(body.length);
        body += `${i + 1} 0 obj\n${content}\nendobj\n`;
    });
    let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets) xref += `${String(offset).padStart(10, '0')} 00000 n \n`;
    const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${body.length}\n%%EOF`;
    return new TextEncoder().encode(body + xref + trailer);
}

export function pdfFile(text = 'Imported PDF text'): File {
    return new File([pdfBytesWithStream(`BT /F1 12 Tf 100 700 Td (${text}) Tj ET`)], 'in.pdf', { type: 'application/pdf' });
}
