import { generateXlsx } from '../shared/xlsx.js';
import { onePagePdf } from './parsers/pdf-test-fixtures.js';

const encoder = new TextEncoder();

const CRC_TABLE = (() => {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        table[i] = c;
    }
    return table;
})();

function crc32(data: Uint8Array): number {
    let crc = 0xffffffff;
    for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
}

const u16 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff];
const u32 = (n: number): number[] => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];

/** A STORED (uncompressed) zip with correct CRCs: what a parser sees from a real Office file, without a compressor. */
export function storedZip(files: ReadonlyArray<{ name: string; content: string }>): Uint8Array {
    const local: number[] = [];
    const central: number[] = [];
    for (const file of files) {
        const name = encoder.encode(file.name);
        const data = encoder.encode(file.content);
        const crc = crc32(data);
        const offset = local.length;
        local.push(...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...name, ...data);
        central.push(...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...name);
    }
    const end = [...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(central.length), ...u32(local.length), ...u16(0)];
    return new Uint8Array([...local, ...central, ...end]);
}

const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';

/** A report-shaped DOCX: a heading, a paragraph with a bold run and a two-column table. */
export function sampleDocx(): Uint8Array {
    const run = (text: string, bold = false) => `<w:r>${bold ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${text}</w:t></w:r>`;
    const cell = (text: string) => `<w:tc><w:p>${run(text)}</w:p></w:tc>`;
    const body =
        `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run('Quarterly report')}</w:p>` +
        `<w:p>${run('Revenue grew ')}${run('12 percent', true)}${run(' over the last quarter.')}</w:p>` +
        `<w:tbl><w:tr>${cell('Region')}${cell('Revenue')}</w:tr><w:tr>${cell('North')}${cell('1,200')}</w:tr></w:tbl>`;
    return storedZip([{ name: 'word/document.xml', content: `<?xml version="1.0"?><w:document ${W}><w:body>${body}</w:body></w:document>` }]);
}

export function sampleXlsx(): Uint8Array {
    return generateXlsx(
        [
            ['Region', 'Revenue'],
            ['North', '1200'],
            ['South', '950'],
        ],
        { boldFirstRow: true },
    );
}

export function samplePdf(): Uint8Array {
    return new Uint8Array(onePagePdf('BT /F1 24 Tf 72 700 Td (Hello PDF) Tj ET', '/Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >>').build());
}

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="30"><rect width="40" height="30" fill="#2563eb"/></svg>';
export const sampleSvg = (): Uint8Array => encoder.encode(SVG);
export const sampleText = (): Uint8Array => encoder.encode('line one\nline two\n');

/** Two sheets, so the tab strip shows. Cells are inline strings, which the reader resolves like shared strings. */
export function twoSheetXlsx(): Uint8Array {
    const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    const sheet = (rows: string[][]) =>
        `<?xml version="1.0"?><worksheet><sheetData>${rows
            .map((row, r) => `<row r="${r + 1}">${row.map((v, c) => `<c r="${String.fromCodePoint(65 + c)}${r + 1}" t="inlineStr"><is><t>${v}</t></is></c>`).join('')}</row>`)
            .join('')}</sheetData></worksheet>`;
    return storedZip([
        { name: 'xl/workbook.xml', content: `<?xml version="1.0"?><workbook xmlns:r="${R}"><sheets><sheet name="Sales" sheetId="1" r:id="rId1"/><sheet name="Costs" sheetId="2" r:id="rId2"/></sheets></workbook>` },
        { name: 'xl/_rels/workbook.xml.rels', content: `<?xml version="1.0"?><Relationships><Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="${R}/worksheet" Target="worksheets/sheet2.xml"/></Relationships>` },
        { name: 'xl/worksheets/sheet1.xml', content: sheet([['Item', 'Total'], ['Licences', '40']]) },
        { name: 'xl/worksheets/sheet2.xml', content: sheet([['Vendor', 'Spend'], ['Hosting', '90']]) },
    ]);
}
