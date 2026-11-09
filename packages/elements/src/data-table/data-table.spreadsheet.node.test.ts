import { describe, expect, it } from 'vitest';
import { cssString, guardSpreadsheetFormula, restoreSpreadsheetText, toClipboardText } from './data-table.spreadsheet.js';

describe('spreadsheet re-exports', () => {
    it('guard and restore are the shared ones', () => {
        expect(guardSpreadsheetFormula('=SUM(A1)')).toBe("'=SUM(A1)");
        expect(restoreSpreadsheetText("'=SUM(A1)")).toBe('=SUM(A1)');
    });
});

describe('toClipboardText', () => {
    it('writes TSV, guards formulas, keeps plain numbers numeric', () => {
        expect(toClipboardText([['=total', '-12'], ['a', '@user']])).toBe("'=total\t-12\na\t'@user");
    });
    it('is empty for an empty grid', () => {
        expect(toClipboardText([])).toBe('');
    });
    it('round-trips through the guard for the cases a copied range holds', () => {
        const cells = ['=total', '- item', '@user', '-12', "'plain apostrophe text", "'=x"];
        const copied = toClipboardText([cells]).split('\t');
        expect(copied.map(restoreSpreadsheetText)).toEqual(cells);
        expect(copied[5]).toBe("''=x");
    });
});

describe('cssString', () => {
    it('quotes and escapes quotes, backslashes and line breaks only', () => {
        expect(cssString('plain')).toBe('"plain"');
        expect(cssString('C:\\exports\\"Q1"')).toBe('"C:\\\\exports\\\\\\"Q1\\""');
        expect(cssString('a\nb')).toBe('"a\\a b"');
        expect(cssString('a\rb\fc')).toBe('"a\\d b\\c c"');
    });
});
