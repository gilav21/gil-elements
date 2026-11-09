import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const DIRECTORY = new URL('.', import.meta.url);
const SOURCES = readdirSync(DIRECTORY).filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'));
/** The addon kit is the one core module that is about addons; it still imports none of them. */
const CORE = SOURCES.filter((name) => name !== 'data-table-addon-kit.ts');
/** A controller implementation; `data-table-controllers.ts` is the contract and assembler, not one. */
const isController = (name: string): boolean => /controller/.test(name) && name !== 'data-table-controllers.ts';
const read = (name: string): string => readFileSync(new URL(name, DIRECTORY), 'utf8');

/** The module specifiers a source imports, statically or dynamically. */
function importsOf(source: string): string[] {
    const specifiers = [...source.matchAll(/(?:from|import\s*\()\s*['"]([^'"]+)['"]/g)];
    return specifiers.map((m) => m[1] as string);
}

describe('importsOf', () => {
    it('finds static, side-effect-free type and dynamic imports', () => {
        const source = `import a from './a.js';\nimport type { B } from "./b.js";\nexport { c } from './c.js';\nconst d = await import('./d.js');`;
        expect(importsOf(source)).toEqual(['./a.js', './b.js', './c.js', './d.js']);
    });
});

describe('the table core', () => {
    it('finds its own sources', () => {
        expect(CORE).toContain('data-table-host.ts');
        expect(SOURCES).toContain('data-table-addon-kit.ts');
    });

    it.each(SOURCES)('%s imports nothing from an addon', (name) => {
        for (const specifier of importsOf(read(name))) expect(specifier).not.toMatch(/(^|\/)addons\//);
    });

    it.each(SOURCES.filter(isController))('%s imports no other controller', (name) => {
        for (const specifier of importsOf(read(name))) {
            const file = specifier.split('/').pop() ?? '';
            if (!/controller/.test(file) || file === 'data-table-controllers.js') continue;
            expect(`${name} -> ${specifier}`).toBe('imports only itself');
        }
    });

    it('does not let a controller reach the assembler either', () => {
        for (const name of SOURCES.filter(isController)) {
            expect(importsOf(read(name))).not.toContain('./data-table-controllers.js');
        }
    });

    it.each(['data-table-model.ts', 'data-table-cell-write.ts', 'data-table-registry.ts', 'data-table-events.ts', 'data-table-providers.ts'])(
        '%s is plain TypeScript: no DOM globals, no lit',
        (name) => {
            const source = read(name);
            expect(source).not.toMatch(/\b(document|window|navigator|customElements)\b\s*[.[]/);
            expect(importsOf(source)).not.toContain('lit');
        },
    );
});
