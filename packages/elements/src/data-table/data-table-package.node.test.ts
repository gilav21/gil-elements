import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../../', import.meta.url);

/** A `sideEffects` glob as a regular expression: `**` any path, `*` any file name part. */
const globToRegex = (glob: string): RegExp => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\//g, '(?:.*/)?').replace(/\*/g, '[^/]*')}$`);

describe('package.json sideEffects', () => {
    it('lists every lazy entry of the data table (a bundler must keep what a lazy module defines as a side effect)', () => {
        const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8')) as { sideEffects: string[] };
        const vite = readFileSync(new URL('vite.config.ts', root), 'utf8');
        const entries = [...vite.matchAll(/'(data-table\/lazy\/[a-z-]+)':/g)].map((match) => `dist/${match[1]}.js`);
        expect(entries.length).toBeGreaterThanOrEqual(5);
        const patterns = pkg.sideEffects.map(globToRegex);
        for (const entry of entries) expect(patterns.some((pattern) => pattern.test(entry)), entry).toBe(true);
    });
});
