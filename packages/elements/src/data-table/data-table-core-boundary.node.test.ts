import { readdirSync, readFileSync } from 'node:fs';
import { posix } from 'node:path';
import { describe, expect, it } from 'vitest';

const DIRECTORY = new URL('.', import.meta.url);
/** Every source of the folder, `lazy/` and `sub/` included (relative, forward slashes); the addons are what the rules keep out, not part of the core. */
const SOURCES = (readdirSync(DIRECTORY, { recursive: true }) as string[])
    .map((name) => name.replaceAll('\\', '/'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && !name.startsWith('addons/'));
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

/** Each import / re-export statement (and dynamic import) with whether it is type-only (`import type`, `export type`). */
function statementsOf(source: string): { specifier: string; typeOnly: boolean }[] {
    const statements = [...source.matchAll(/^\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?\sfrom\s*)?['"]([^'"]+)['"]/gm)].map((m) => ({ specifier: m[2] as string, typeOnly: m[1] !== undefined }));
    const dynamic = [...source.matchAll(/import\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => ({ specifier: m[1] as string, typeOnly: false }));
    return [...statements, ...dynamic];
}

/** The two core modules an addon may import for real; everything else of the core only as `import type`. */
const ADDON_CORE = new Set(['data-table-addon-kit.js', 'data-table-addon-registry.js']);

/**
 * What is wrong with the imports of the addon source `name` (a path relative to this folder, `addons/<id>/...`), one message each. An addon imports
 * its own folder, the kit and the addon registry, `shared/*`, another element's `define` or class file, lit and the base package, and the rest of the
 * core only as types: a value import of a core module would put the table's code (a shared chunk) on the addon's entry.
 */
function addonImportProblems(name: string, source: string): string[] {
    // The folder that is the addon's own: `addons/<id>/`, or a top-level addon-like entry such as `range-chart/`.
    const own = name.startsWith('addons/') ? `addons/${name.split('/')[1]}/` : `${name.split('/')[0]}/`;
    const problems: string[] = [];
    for (const { specifier, typeOnly } of statementsOf(source)) {
        if (!specifier.startsWith('.')) {
            if (!/^(lit|@gilav21\/elements-base)(\/|$)/.test(specifier)) problems.push(`${specifier}: a package`);
            continue;
        }
        const target = posix.normalize(posix.join(posix.dirname(name), specifier));
        if (target.startsWith(own)) continue;
        if (target.startsWith('addons/')) problems.push(`${specifier}: another addon`);
        else if (target.startsWith('../shared/')) continue;
        else if (target.startsWith('../')) {
            if (!/^\.\.\/([a-z-]+)\/(define|\1)\.js$/.test(target)) problems.push(`${specifier}: not an element's define or class file`);
        } else if (!typeOnly && !ADDON_CORE.has(target)) problems.push(`${specifier}: a core module (only the kit and the addon registry, or import type)`);
    }
    return problems;
}

/** Every addon source (relative to this folder), and the range chart's: it is an entry of its own that must not pull the core either. */
const ADDON_SOURCES = (readdirSync(DIRECTORY, { recursive: true }) as string[])
    .map((name) => name.replaceAll('\\', '/'))
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts') && (name.startsWith('addons/') || name.startsWith('range-chart/')));

describe('the addons', () => {
    it('finds their sources, the entry stubs of wave 7 included', () => {
        expect(ADDON_SOURCES).toEqual(expect.arrayContaining(['addons/pivot/pivot-utils.ts', 'addons/context-menu/index.ts', 'addons/export/define.ts', 'addons/pivot/define.ts', 'range-chart/index.ts', 'range-chart/define.ts']));
        // the range chart's own folder is `range-chart/`; a core module is still refused there
        expect(addonImportProblems('range-chart/range-chart.ts', `import './range-chart-data.js';\nimport '../../dialog/define.js';\nimport { x } from '../data-table.utils.js';`)).toEqual([
            '../data-table.utils.js: a core module (only the kit and the addon registry, or import type)',
        ]);
    });

    it.each(ADDON_SOURCES)('%s imports the core only through the kit, the addon registry and types, and no other addon', (name) => {
        expect(addonImportProblems(name, read(name))).toEqual([]);
    });

    it('the rule refuses a value import of a core module, another addon and a package, and allows the rest', () => {
        const source = [
            `import { defineAddon } from '../../data-table-addon-kit.js';`,
            `import { registerDataTableAddon } from '../../data-table-addon-registry.js';`,
            `import type { QueryService } from '../../data-table-providers.js';`,
            `export type { ColumnDef } from '../../data-table.types.js';`,
            `import { toCsv } from '../../../shared/csv.js';`,
            `import '../../../context-menu/define.js';`,
            `import { html } from 'lit';`,
            `import { helper } from './helper.js';`,
            `import { getCellValue } from '../../data-table.utils.js';`,
            `import {\n    computePivot,\n} from '../pivot/pivot-utils.js';`,
            `export * from '../../data-table-providers.js';`,
            `import { x } from 'some-package';`,
            `const lazy = () => import('../../data-table.js');`,
            `import { y } from '../../../context-menu/context-menu-content.js';`,
        ].join('\n');
        expect(addonImportProblems('addons/export/export.ts', source)).toEqual([
            '../../data-table.utils.js: a core module (only the kit and the addon registry, or import type)',
            '../pivot/pivot-utils.js: another addon',
            '../../data-table-providers.js: a core module (only the kit and the addon registry, or import type)',
            'some-package: a package',
            "../../../context-menu/context-menu-content.js: not an element's define or class file",
            '../../data-table.js: a core module (only the kit and the addon registry, or import type)',
        ]);
    });
});

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

    it('scans the subfolders too: the lazy parts and the sub-elements follow the same rules', () => {
        expect(SOURCES).toEqual(expect.arrayContaining(['lazy/range.ts', 'lazy/clipboard.ts', 'lazy/row-drag.ts', 'sub/data-table-pager.ts']));
        expect(SOURCES.some((name) => name.startsWith('addons/'))).toBe(false);
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

    it('keeps the cell-write pipeline free of any dictionary: the message of a rejection is a port the element fills', () => {
        expect(importsOf(read('data-table-cell-write.ts')).filter((specifier) => /locales/.test(specifier))).toEqual([]);
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
