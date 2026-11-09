import { describe, expect, it } from 'vitest';
import { escapeCsvCell, toCsv, CSV_BOM } from './csv.js';
import { guardSpreadsheetFormula, restoreSpreadsheetText } from './formula-guard.js';

describe('guardSpreadsheetFormula', () => {
    it.each(['=1+1', '+SUM(A1)', '-cmd', '@x', '\tTab', '\rCR', '=HYPERLINK("x")'])('quotes %j', (cell) => {
        expect(guardSpreadsheetFormula(cell)).toBe(`'${cell}`);
    });
    it.each(['-12', '+3.5', '-1e3', '.5', '-.5', '5.', 'plain', '', "'x", '1-2'])('leaves %j alone', (cell) => {
        expect(guardSpreadsheetFormula(cell)).toBe(cell);
    });
    it('quotes a leading quote that sits before a trigger, so restore can undo exactly one', () => {
        expect(guardSpreadsheetFormula("'=x")).toBe("''=x");
        expect(guardSpreadsheetFormula("''=x")).toBe("'''=x");
    });
    it('treats a signed number behind a quote as a number', () => {
        expect(guardSpreadsheetFormula("'-12")).toBe("'-12");
    });
});

describe('restoreSpreadsheetText', () => {
    it('is the exact inverse for every string tried', () => {
        const samples = ['', 'a', '=x', "'=x", "''=x", "'a", "'", "''", '-12', "'-12", '\t=x', '@', "'@", '+', "'+1e", '--1'];
        for (const s of samples) expect(restoreSpreadsheetText(guardSpreadsheetFormula(s)), JSON.stringify(s)).toBe(s);
    });
    it('leaves an ordinary leading apostrophe alone', () => {
        expect(restoreSpreadsheetText("'plain")).toBe("'plain");
    });
});

describe('csv', () => {
    it('guards before quoting, so the guard quote sits inside the CSV quotes', () => {
        expect(escapeCsvCell('=a,b')).toBe('"\'=a,b"');
        expect(escapeCsvCell('-12')).toBe('-12');
    });
    it('quotes delimiters, quotes and line breaks, doubling inner quotes', () => {
        expect(escapeCsvCell('a,b')).toBe('"a,b"');
        expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
        expect(escapeCsvCell('a\nb')).toBe('"a\nb"');
        expect(escapeCsvCell('a\rb')).toBe('"a\rb"');
        expect(escapeCsvCell('plain')).toBe('plain');
    });
    it('joins rows with CRLF and no trailing newline', () => {
        expect(toCsv([['a', 'b'], ['1', '=2']])).toBe("a,b\r\n1,'=2");
        expect(toCsv([])).toBe('');
        expect(CSV_BOM).toBe('﻿');
    });
});
