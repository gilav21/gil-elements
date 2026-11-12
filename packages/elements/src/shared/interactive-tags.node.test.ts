import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { INTERACTIVE_ROLES, INTERACTIVE_TAGS } from './interactive-tags.js';

const SRC = join(__dirname, '..');
const dirs = readdirSync(SRC).filter((name) => statSync(join(SRC, name)).isDirectory() && name !== 'shared');

/** Every `ge-` tag a `define.ts` registers. */
const defined = new Set<string>();
for (const dir of dirs) {
    let source = '';
    try {
        source = readFileSync(join(SRC, dir, 'define.ts'), 'utf8');
    } catch {
        continue;
    }
    for (const match of source.matchAll(/defineElement\('([^']+)'/g)) defined.add(`ge-${match[1]}`);
}

/** The directories whose source declares a form-associated element (`static readonly formAssociated = true`). */
const formAssociated = dirs.filter((dir) =>
    readdirSync(join(SRC, dir)).some((file) => file.endsWith('.ts') && !file.includes('.test.') && readFileSync(join(SRC, dir, file), 'utf8').includes('formAssociated = true')),
);

describe('the interactive tags of the library', () => {
    it('only name elements that a define.ts registers (no typo, no tag that does not exist)', () => {
        for (const tag of INTERACTIVE_TAGS) expect(defined.has(tag), tag).toBe(true);
    });

    it('include every form-associated element: a new one fails here until it is added to shared/interactive-tags.ts', () => {
        // directory -> the tags its form-associated classes are registered as (a directory's own tag, plus its siblings where they differ)
        const tagsOf: Record<string, string[]> = { 'date-picker': ['ge-date-picker', 'ge-date-range-picker'], 'input-group': ['ge-input-group-input'] };
        expect(formAssociated.length).toBeGreaterThan(20);
        for (const dir of formAssociated) {
            for (const tag of tagsOf[dir] ?? [`ge-${dir}`]) expect(INTERACTIVE_TAGS, `${dir}: ${tag}`).toContain(tag);
        }
    });

    it('lists the ARIA widget roles that are controls, keeping button and link', () => {
        for (const role of ['switch', 'checkbox', 'radio', 'combobox', 'slider', 'spinbutton', 'tab', 'menuitem', 'option', 'textbox', 'listbox', 'searchbox', 'button', 'link']) {
            expect(INTERACTIVE_ROLES).toContain(role);
        }
    });
});
