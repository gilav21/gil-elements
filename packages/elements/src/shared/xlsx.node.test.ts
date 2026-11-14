/**
 * The xlsx writer without a DOM (wave 7 spec B.4): an independent STORE reader (so the writer is not checked only by our own zip reader),
 * the sheet and shared-string XML, the wave 7 corrections, and a tag balancer over every part. The parseXlsx round trips and the DOMParser
 * check are in xlsx.browser.test.ts (the file viewer's reader needs a DOM).
 */
import * as zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { dosDateTime, generateXlsx, sanitizeSheetName, XLSX_MAX_CELL_LENGTH, XLSX_MAX_COLUMNS, XLSX_MAX_ROWS, type XlsxCell } from './xlsx.js';

const decoder = new TextDecoder();

/** The reference CRC-32: Node's (>= 22.2), else a bitwise one written here, not the writer's table. */
function referenceCrc32(data: Uint8Array): number {
    const native = (zlib as { crc32?: (d: Uint8Array) => number }).crc32;
    if (native) return native(data) >>> 0;
    let crc = ~0;
    for (const byte of data) {
        crc ^= byte;
        for (let k = 0; k < 8; k++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    return ~crc >>> 0;
}

interface StoredEntry {
    name: string;
    method: number;
    compressed: number;
    size: number;
    crc: number;
    time: number;
    date: number;
    content: Uint8Array;
}

/** A minimal STORE reader: the end-of-central-directory record, the central directory, and each local header's bytes. */
function readStored(bytes: Uint8Array): StoredEntry[] {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    let eocd = bytes.length - 22;
    while (eocd >= 0 && view.getUint32(eocd, true) !== 0x06054b50) eocd--;
    if (eocd < 0) throw new Error('no end of central directory');
    const count = view.getUint16(eocd + 10, true);
    let pos = view.getUint32(eocd + 16, true);
    const entries: StoredEntry[] = [];
    for (let i = 0; i < count; i++) {
        if (view.getUint32(pos, true) !== 0x02014b50) throw new Error('bad central header');
        const nameLength = view.getUint16(pos + 28, true);
        const extra = view.getUint16(pos + 30, true);
        const comment = view.getUint16(pos + 32, true);
        const local = view.getUint32(pos + 42, true);
        const compressed = view.getUint32(pos + 20, true);
        if (view.getUint32(local, true) !== 0x04034b50) throw new Error('bad local header');
        const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        entries.push({
            name: decoder.decode(bytes.subarray(pos + 46, pos + 46 + nameLength)),
            method: view.getUint16(pos + 10, true),
            time: view.getUint16(pos + 12, true),
            date: view.getUint16(pos + 14, true),
            crc: view.getUint32(pos + 16, true),
            compressed,
            size: view.getUint32(pos + 24, true),
            content: bytes.subarray(start, start + compressed),
        });
        pos += 46 + nameLength + extra + comment;
    }
    return entries;
}

function parts(bytes: Uint8Array): Map<string, string> {
    return new Map(readStored(bytes).map((e) => [e.name, decoder.decode(e.content)]));
}

const sheetOf = (bytes: Uint8Array): string => parts(bytes).get('xl/worksheets/sheet1.xml') ?? '';
const stringsOf = (bytes: Uint8Array): string => parts(bytes).get('xl/sharedStrings.xml') ?? '';

/** Balances tags without a DOM: every open tag closed in order, attributes quoted, no stray `<` or `&` in text. Returns the problems. */
function xmlProblems(xml: string): string[] {
    const problems: string[] = [];
    const stack: string[] = [];
    const body = xml.replace(/^<\?xml[^?]*\?>/, '');
    const token = /<(\/?)([A-Za-z_][\w:.-]*)((?:\s+[\w:.-]+="[^"<]*")*)\s*(\/?)>|<|&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-fA-F]+);)/g;
    for (const m of body.matchAll(token)) {
        const [whole, closing, name, , selfClosing] = m;
        if (!name) {
            problems.push(`stray ${whole} at ${m.index}`);
            continue;
        }
        if (closing) {
            const open = stack.pop();
            if (open !== name) problems.push(`</${name}> closes <${open}>`);
        } else if (!selfClosing) stack.push(name);
    }
    if (stack.length > 0) problems.push(`unclosed ${stack.join(',')}`);
    return problems;
}

const HOSTILE: XlsxCell[][] = [
    ['<', '&', '"', "'", ']]>', '<![CDATA[x]]>', '&amp;', '\u{1F600}', 'עברית RTL'],
    ['ctl\u0000\u0001\u0008\u000B\u000C\u000E\u001F', 'lone \uD800', 'lone \uDC00', '￾￿', ' lead', 'trail ', 'a\nb', '\t', ''],
    [1, -0, 1e21, true, false, new Date(2024, 1, 29), new Date(2024, 1, 29, 6, 0), null, undefined],
];

describe('generateXlsx (node, independent reader)', () => {
    it('writes the seven parts as STORE entries whose sizes and CRC-32 match an independent check', () => {
        const entries = readStored(generateXlsx(HOSTILE));
        expect(entries.map((e) => e.name)).toEqual([
            '[Content_Types].xml',
            '_rels/.rels',
            'xl/workbook.xml',
            'xl/_rels/workbook.xml.rels',
            'xl/styles.xml',
            'xl/sharedStrings.xml',
            'xl/worksheets/sheet1.xml',
        ]);
        for (const e of entries) {
            expect(e.method, e.name).toBe(0);
            expect(e.size, e.name).toBe(e.compressed);
            expect(e.crc, e.name).toBe(referenceCrc32(e.content));
        }
    });

    it('stamps a valid DOS date and time on every entry (Angular writes 0, shown as 1980-00-00)', () => {
        const modified = new Date(2026, 10, 14, 13, 45, 31);
        for (const e of readStored(generateXlsx([['x']], { modified }))) {
            expect((e.date >> 9) + 1980).toBe(2026);
            expect((e.date >> 5) & 0xf).toBe(11);
            expect(e.date & 0x1f).toBe(14);
            expect(e.time >> 11).toBe(13);
            expect((e.time >> 5) & 0x3f).toBe(45);
            expect((e.time & 0x1f) * 2).toBe(30);
        }
        const now = readStored(generateXlsx([['x']]))[0] as StoredEntry;
        expect((now.date >> 5) & 0xf).toBeGreaterThan(0); // the default (now) is a real month
    });

    it('clamps the zip date into the DOS range', () => {
        expect(dosDateTime(new Date(1970, 0, 1))).toEqual({ date: (1 << 5) | 1, time: 0 });
        expect(dosDateTime(new Date(Number.NaN))).toEqual({ date: (1 << 5) | 1, time: 0 });
        expect(dosDateTime(new Date(2200, 0, 1)).date >> 9).toBe(127);
    });

    it('addresses cells by column letter and row, bolds the header, and counts shared-string references', () => {
        const wide = Array.from({ length: 28 }, (_, i) => `c${i}`);
        const bytes = generateXlsx([wide, wide, wide]);
        const sheet = sheetOf(bytes);
        expect(sheet).toContain('<c r="A1" t="s" s="1"><v>0</v></c>');
        expect(sheet).toContain('<c r="AB3" t="s"><v>27</v></c>');
        expect(stringsOf(bytes)).toContain('count="84" uniqueCount="28"');
    });

    it('strips XML-illegal characters (C0 controls, lone surrogates, U+FFFE/FFFF) and keeps tab, line feed and pairs', () => {
        const ss = stringsOf(generateXlsx(HOSTILE));
        expect(ss).toContain('<si><t>ctl</t></si>');
        expect(ss).toContain('<si><t xml:space="preserve">lone </t></si>');
        expect(ss).toContain('\u{1F600}');
        expect(ss).not.toMatch(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/);
        expect(ss).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
    });

    it('preserves leading and trailing whitespace and line breaks with xml:space="preserve", and only then', () => {
        const ss = stringsOf(generateXlsx([[' a', 'b ', 'c\nd', '\t', 'plain', 'in side']]));
        expect(ss).toContain('<si><t xml:space="preserve"> a</t></si>');
        expect(ss).toContain('<si><t xml:space="preserve">b </t></si>');
        expect(ss).toContain('<si><t xml:space="preserve">c\nd</t></si>');
        expect(ss).toContain('<si><t xml:space="preserve">\t</t></si>');
        expect(ss).toContain('<si><t>plain</t></si>');
        expect(ss).toContain('<si><t>in side</t></si>');
    });

    it('escapes a literal _xHHHH_ as Excel does, so it reads back unchanged (final review)', () => {
        // Excel's reading of shared-string text: `_xHHHH_` is the character U+HHHH (so `_x005F_` is a literal underscore).
        const excelText = (t: string): string => t.replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)));
        const ss = stringsOf(generateXlsx([['ID_x0041_7', 'a_x00e9_b_X0041_', 'plain_x41_']]));
        expect(ss).toContain('<si><t>ID_x005F_x0041_7</t></si>');
        const texts = [...ss.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => excelText(m[1] as string));
        expect(texts).toEqual(['ID_x0041_7', 'a_x00e9_b_X0041_', 'plain_x41_']);
    });

    it('cuts text to 32 767 characters without splitting a surrogate pair', () => {
        const long = 'x'.repeat(XLSX_MAX_CELL_LENGTH + 1);
        expect(stringsOf(generateXlsx([[long]]))).toContain(`<t>${'x'.repeat(XLSX_MAX_CELL_LENGTH)}</t>`);
        const pair = `${'x'.repeat(XLSX_MAX_CELL_LENGTH - 1)}\u{1F600}`;
        expect(stringsOf(generateXlsx([[pair]]))).toContain(`<t>${'x'.repeat(XLSX_MAX_CELL_LENGTH - 1)}</t>`);
    });

    it('refuses more rows or columns than Excel opens with a RangeError', () => {
        const tooTall = { length: XLSX_MAX_ROWS + 1, reduce: () => 1 } as unknown as XlsxCell[][];
        expect(() => generateXlsx(tooTall)).toThrow(RangeError);
        expect(() => generateXlsx([new Array<string>(XLSX_MAX_COLUMNS + 1).fill('')])).toThrow(RangeError);
        expect(() => generateXlsx([new Array<string>(XLSX_MAX_COLUMNS).fill('')])).not.toThrow();
    });

    it('writes typed cells: numbers, booleans and dates (date or date-time format), skipping null and undefined', () => {
        const sheet = sheetOf(generateXlsx([['h'], [1.5, -0, true, false, new Date(2024, 1, 29), new Date(2024, 1, 29, 6, 0), null, undefined, Number.POSITIVE_INFINITY]]));
        expect(sheet).toContain('<c r="A2" t="n"><v>1.5</v></c>');
        expect(sheet).toContain('<c r="B2" t="n"><v>0</v></c>');
        expect(sheet).toContain('<c r="C2" t="b"><v>1</v></c>');
        expect(sheet).toContain('<c r="D2" t="b"><v>0</v></c>');
        expect(sheet).toContain('<c r="E2" s="2"><v>45351</v></c>'); // 2024-02-29
        expect(sheet).toContain('<c r="F2" s="3"><v>45351.25</v></c>');
        expect(sheet).not.toContain('r="G2"');
        expect(sheet).not.toContain('r="H2"');
        expect(sheet).toContain('<c r="I2" t="s"><v>1</v></c>'); // Infinity as text
        expect(stringsOf(generateXlsx([[Number.POSITIVE_INFINITY]]))).toContain('<t>Infinity</t>');
    });

    it('writes a date before 1900-03-01 (Excel calendar bug) and an invalid date as text', () => {
        const ss = stringsOf(generateXlsx([[new Date(Date.UTC(1900, 0, 1)), new Date(Number.NaN)]]));
        expect(ss).toContain('<t>1900-01-01T00:00:00.000Z</t>');
        expect(ss).toContain('<t>Invalid Date</t>');
    });

    it('names the sheet, made valid for Excel', () => {
        const workbook = (name?: string): string => parts(generateXlsx([['x']], { sheetName: name })).get('xl/workbook.xml') ?? '';
        expect(workbook()).toContain('<sheet name="Sheet1"');
        expect(workbook('Q1 & "Q2"')).toContain('<sheet name="Q1 &amp; &quot;Q2&quot;"');
        expect(sanitizeSheetName('a[b]c:d*e?f/g\\h')).toBe('a_b_c_d_e_f_g_h');
        expect(sanitizeSheetName("'quoted'")).toBe('quoted');
        expect(sanitizeSheetName('x'.repeat(40))).toBe('x'.repeat(31));
        expect(sanitizeSheetName(`${'x'.repeat(30)}\u{1F600}`)).toBe('x'.repeat(30));
        expect(sanitizeSheetName('  ')).toBe('Sheet1');
        expect(sanitizeSheetName('\u0001')).toBe('Sheet1');
        expect(sanitizeSheetName(undefined)).toBe('Sheet1');
    });

    it('keeps every part well formed for hostile strings (tag balancer)', () => {
        for (const [name, xml] of parts(generateXlsx(HOSTILE, { sheetName: '<&>' }))) expect(xmlProblems(xml), name).toEqual([]);
        expect(xmlProblems('<a><b></a>')).not.toEqual([]); // the balancer itself catches a broken part
        expect(xmlProblems('<a>x & y</a>')).not.toEqual([]);
    });
});
