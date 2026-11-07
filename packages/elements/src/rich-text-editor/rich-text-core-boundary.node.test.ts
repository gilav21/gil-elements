import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIRECTORY = new URL('.', import.meta.url);
const CORE = readdirSync(DIRECTORY).filter((name) => name.endsWith('.ts') && name !== 'rich-text-addon-kit.ts');

describe('the editor core', () => {
    it('finds its own sources', () => {
        expect(CORE).toContain('rich-text-editor.ts');
    });

    it.each(CORE)('%s imports nothing from an addon', (name) => {
        const source = readFileSync(new URL(name, DIRECTORY), 'utf8');
        expect(source).not.toMatch(/from\s+['"][^'"]*\/addons\//);
        expect(source).not.toMatch(/import\(\s*['"][^'"]*\/addons\//);
    });
});
