// The xlsx writer (a STORE-only zip, no dependency), from shadcn-angular lib/parsers/xlsx.ts; typed for noUncheckedIndexedAccess. Used by the
// data-table export addon and the file-viewer test fixtures. Beyond Angular (wave 7 spec B.2): XML-illegal characters are stripped, `<t>` keeps
// leading/trailing whitespace, Excel's size limits are honoured, `count` counts references, the zip entries carry a real date, the sheet can be
// named, and numbers, booleans and dates can be written as typed cells.
const encoder = new TextEncoder();

/**
 * One cell. A string is a shared string (text, as Angular writes every cell). A finite number is a numeric cell, a boolean a boolean cell, a
 * valid `Date` a date serial with a date format (a date before 1900-03-01, where Excel's calendar is off by a day, is written as ISO text).
 * `null` / `undefined` leave the cell out; a non-finite number or an invalid date is written as its text.
 */
export type XlsxCell = string | number | boolean | Date | null | undefined;

export interface XlsxOptions {
  /** Bold the first row (the header). Default true. */
  boldFirstRow?: boolean;
  /** The sheet's tab name, made valid for Excel (see `sanitizeSheetName`). Default `Sheet1`. */
  sheetName?: string;
  /** The date stamped on the zip entries. Default now. */
  modified?: Date;
}

/** Excel's limits: longer text is cut, a bigger grid is refused (Excel would not open the file). */
export const XLSX_MAX_CELL_LENGTH = 32_767;
export const XLSX_MAX_ROWS = 1_048_576;
export const XLSX_MAX_COLUMNS = 16_384;

function makeCrc32Table(): Uint32Array {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    t[i] = c;
  }
  return t;
}

const CRC32_TABLE = makeCrc32Table();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (CRC32_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Characters XML 1.0 forbids (C0 controls but tab / LF / CR, lone surrogates, U+FFFE / U+FFFF): Excel calls the file corrupt otherwise. */
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

function stripXmlIllegal(s: string): string {
  return s.replace(XML_ILLEGAL, '');
}

function escapeXml(s: string): string {
  return s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;');
}

/** Cut to Excel's cell limit without splitting a surrogate pair. */
function clampCellText(s: string): string {
  if (s.length <= XLSX_MAX_CELL_LENGTH) return s;
  const end = /[\uD800-\uDBFF]/.test(s.charAt(XLSX_MAX_CELL_LENGTH - 1)) ? XLSX_MAX_CELL_LENGTH - 1 : XLSX_MAX_CELL_LENGTH;
  return s.slice(0, end);
}

/**
 * A tab name Excel accepts: XML-illegal characters dropped, `[ ] : * ? / \` replaced with `_`, no leading or trailing apostrophe, at most 31
 * characters (a surrogate pair is not split); `Sheet1` when nothing is left.
 */
export function sanitizeSheetName(name: string | undefined): string {
  let s = stripXmlIllegal(name ?? '').replace(/[[\]:*?/\\]/g, '_').replace(/^'+|'+$/g, '');
  if (s.length > 31) s = s.slice(0, /[\uD800-\uDBFF]/.test(s.charAt(30)) ? 30 : 31).replace(/'+$/, '');
  return s.trim() === '' ? 'Sheet1' : s;
}

function columnLetter(col: number): string {
  let s = '';
  let c = col;
  while (c >= 0) {
    s = String.fromCodePoint(65 + (c % 26)) + s;
    c = Math.floor(c / 26) - 1;
  }
  return s;
}

function contentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`;
}

function relsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml(sheetName: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets>
</workbook>`;
}

function workbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`;
}

/** Cell styles: 0 plain, 1 bold, 2 date (built-in format 14), 3 date and time (built-in format 22). */
const STYLE_BOLD = 1;
const STYLE_DATE = 2;
const STYLE_DATE_TIME = 3;

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><name val="Calibri"/></font>
</fonts>
<fills count="2">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
</fills>
<borders count="1">
<border><left/><right/><top/><bottom/><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="4">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
<xf numFmtId="22" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
</cellXfs>
</styleSheet>`;
}

/** `xml:space="preserve"` when the text starts or ends with whitespace or holds a line break: Excel trims it otherwise. */
function textElement(s: string): string {
  const space = /^\s|\s$|[\r\n]/.test(s) ? ' xml:space="preserve"' : '';
  // Excel reads `_xHHHH_` in text as the character U+HHHH; a literal one keeps its underscore escaped (`_x005F_`), as Excel writes it.
  return `<t${space}>${escapeXml(s.replace(/_(x[0-9A-Fa-f]{4}_)/g, '_x005F_$1'))}</t>`;
}

function sharedStringsXml(strings: readonly string[], references: number): string {
  const items = strings.map(s => `<si>${textElement(s)}</si>`).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${references}" uniqueCount="${strings.length}">${items}</sst>`;
}

/** Excel's 1900 calendar: 1900-03-01 is serial 61; earlier dates are off by Excel's phantom 1900-02-29. */
const FIRST_SAFE_DATE = Date.UTC(1900, 2, 1);

/** The local wall-clock time of `date` as an Excel serial (days since 1899-12-30), or null when Excel cannot show it right. */
function dateSerial(date: Date): number | null {
  const wall = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
  if (!Number.isFinite(wall) || wall < FIRST_SAFE_DATE) return null;
  return wall / 86_400_000 + 25_569;
}

/** Collects the shared strings: each distinct text once, in first-use order, and how many cells reference one. */
class SharedStrings {
  readonly list: string[] = [];
  references = 0;
  private readonly index = new Map<string, number>();

  ref(s: string): number {
    this.references++;
    let i = this.index.get(s);
    if (i === undefined) {
      i = this.list.length;
      this.index.set(s, i);
      this.list.push(s);
    }
    return i;
  }
}

function textCell(ref: string, value: string, style: string, strings: SharedStrings): string {
  return `<c r="${ref}" t="s"${style}><v>${strings.ref(clampCellText(stripXmlIllegal(value)))}</v></c>`;
}

function cellXml(ref: string, value: XlsxCell, bold: boolean, strings: SharedStrings): string {
  const style = bold ? ` s="${STYLE_BOLD}"` : '';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? `<c r="${ref}" t="n"${style}><v>${Object.is(value, -0) ? 0 : value}</v></c>` : textCell(ref, String(value), style, strings);
  }
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"${style}><v>${value ? 1 : 0}</v></c>`;
  if (value instanceof Date) {
    const serial = dateSerial(value);
    if (serial === null) return textCell(ref, Number.isNaN(value.getTime()) ? String(value) : value.toISOString(), style, strings);
    return `<c r="${ref}" s="${serial % 1 === 0 ? STYLE_DATE : STYLE_DATE_TIME}"><v>${serial}</v></c>`;
  }
  return textCell(ref, String(value), style, strings);
}

function worksheetXml(data: readonly (readonly XlsxCell[])[], strings: SharedStrings, boldFirstRow: boolean): string {
  const rows: string[] = [];
  for (const [r, row] of data.entries()) {
    const cells: string[] = [];
    for (const [c, value] of row.entries()) {
      if (value === null || value === undefined) continue;
      cells.push(cellXml(columnLetter(c) + (r + 1), value, boldFirstRow && r === 0, strings));
    }
    rows.push(`<row r="${r + 1}">${cells.join('')}</row>`);
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetData>${rows.join('')}</sheetData>
</worksheet>`;
}

function writeU16(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
}

function writeU32(buf: Uint8Array, offset: number, val: number): void {
  buf[offset] = val & 0xff;
  buf[offset + 1] = (val >> 8) & 0xff;
  buf[offset + 2] = (val >> 16) & 0xff;
  buf[offset + 3] = (val >> 24) & 0xff;
}

/** The MS-DOS date and time of a zip header (local time, 2-second steps, 1980..2107; clamped into that range). Angular writes 0 (1980-00-00). */
export function dosDateTime(date: Date): { date: number; time: number } {
  const first = new Date(1980, 0, 1);
  const last = new Date(2107, 11, 31, 23, 59, 58);
  let d = date;
  if (Number.isNaN(date.getTime()) || date < first) d = first;
  else if (date > last) d = last;
  return {
    date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
  };
}

type ZipEntry = { path: Uint8Array; content: Uint8Array; crc: number; offset: number };
type DosStamp = { date: number; time: number };

function writeLocalFileHeader(buf: Uint8Array, e: ZipEntry, stamp: DosStamp, pos: number): number {
  writeU32(buf, pos, 0x04034b50); pos += 4;
  writeU16(buf, pos, 20); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  writeU16(buf, pos, stamp.time); pos += 2;
  writeU16(buf, pos, stamp.date); pos += 2;
  writeU32(buf, pos, e.crc); pos += 4;
  writeU32(buf, pos, e.content.length); pos += 4;
  writeU32(buf, pos, e.content.length); pos += 4;
  writeU16(buf, pos, e.path.length); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  buf.set(e.path, pos); pos += e.path.length;
  buf.set(e.content, pos); pos += e.content.length;
  return pos;
}

function writeCentralDirHeader(buf: Uint8Array, e: ZipEntry, stamp: DosStamp, pos: number): number {
  writeU32(buf, pos, 0x02014b50); pos += 4;
  writeU16(buf, pos, 20); pos += 2;
  writeU16(buf, pos, 20); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  writeU16(buf, pos, stamp.time); pos += 2;
  writeU16(buf, pos, stamp.date); pos += 2;
  writeU32(buf, pos, e.crc); pos += 4;
  writeU32(buf, pos, e.content.length); pos += 4;
  writeU32(buf, pos, e.content.length); pos += 4;
  writeU16(buf, pos, e.path.length); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  writeU32(buf, pos, 0); pos += 4;
  writeU32(buf, pos, e.offset); pos += 4;
  buf.set(e.path, pos); pos += e.path.length;
  return pos;
}

function createZip(files: { path: string; content: Uint8Array }[], modified: Date): Uint8Array<ArrayBuffer> {
  const stamp = dosDateTime(modified);
  const entries: ZipEntry[] = [];

  let totalSize = 0;
  for (const f of files) {
    const pathBytes = encoder.encode(f.path);
    totalSize += 30 + pathBytes.length + f.content.length;
    entries.push({ path: pathBytes, content: f.content, crc: crc32(f.content), offset: 0 });
  }

  const centralDirSize = entries.reduce((sum, e) => sum + 46 + e.path.length, 0);
  const buf = new Uint8Array(totalSize + centralDirSize + 22);
  let pos = 0;

  for (const e of entries) {
    e.offset = pos;
    pos = writeLocalFileHeader(buf, e, stamp, pos);
  }

  const centralDirOffset = pos;
  for (const e of entries) {
    pos = writeCentralDirHeader(buf, e, stamp, pos);
  }

  writeU32(buf, pos, 0x06054b50); pos += 4;
  writeU16(buf, pos, 0); pos += 2;
  writeU16(buf, pos, 0); pos += 2;
  writeU16(buf, pos, entries.length); pos += 2;
  writeU16(buf, pos, entries.length); pos += 2;
  writeU32(buf, pos, centralDirSize); pos += 4;
  writeU32(buf, pos, centralDirOffset); pos += 4;
  writeU16(buf, pos, 0);

  return buf;
}

/**
 * A one-sheet workbook of `data` (rows of cells). Throws a `RangeError` for more than 1 048 576 rows or 16 384 columns, which Excel refuses;
 * text longer than 32 767 characters is cut.
 */
export function generateXlsx(data: readonly (readonly XlsxCell[])[], options?: XlsxOptions): Uint8Array<ArrayBuffer> {
  if (data.length > XLSX_MAX_ROWS) throw new RangeError(`generateXlsx: ${data.length} rows exceed Excel's limit of ${XLSX_MAX_ROWS}`);
  const widest = data.reduce((max, row) => Math.max(max, row.length), 0);
  if (widest > XLSX_MAX_COLUMNS) throw new RangeError(`generateXlsx: ${widest} columns exceed Excel's limit of ${XLSX_MAX_COLUMNS}`);
  const boldFirstRow = options?.boldFirstRow !== false;

  const strings = new SharedStrings();
  const sheet = worksheetXml(data, strings, boldFirstRow); // first: it fills the shared strings

  const files = [
    { path: '[Content_Types].xml', content: encoder.encode(contentTypesXml()) },
    { path: '_rels/.rels', content: encoder.encode(relsXml()) },
    { path: 'xl/workbook.xml', content: encoder.encode(workbookXml(sanitizeSheetName(options?.sheetName))) },
    { path: 'xl/_rels/workbook.xml.rels', content: encoder.encode(workbookRelsXml()) },
    { path: 'xl/styles.xml', content: encoder.encode(stylesXml()) },
    { path: 'xl/sharedStrings.xml', content: encoder.encode(sharedStringsXml(strings.list, strings.references)) },
    { path: 'xl/worksheets/sheet1.xml', content: encoder.encode(sheet) },
  ];

  return createZip(files, options?.modified ?? new Date());
}
