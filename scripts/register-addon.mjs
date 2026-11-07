// Registers a rich-text-editor addon in package.json exports and the vite entries, and creates empty define/index stubs.
// Safe to run again. Usage: node scripts/register-addon.mjs <id> [<id> ...]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ids = process.argv.slice(2);
if (ids.length === 0) throw new Error('usage: register-addon.mjs <id> [<id> ...]');
const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, 'utf8')));
const entry = (id, file) => ({
    types: `./dist/rich-text-editor/addons/${id}/${file}.d.ts`,
    development: `./src/rich-text-editor/addons/${id}/${file}.ts`,
    default: `./dist/rich-text-editor/addons/${id}/${file}.js`,
});
const INDENT = ' '.repeat(16);
const ANCHOR = /^ *'rich-text-editor\/locales\/pt': .*\r?\n/m;

for (const id of ids) {
    mkdirSync(`packages/elements/src/rich-text-editor/addons/${id}`, { recursive: true });
    for (const file of ['define', 'index']) {
        const path = `packages/elements/src/rich-text-editor/addons/${id}/${file}.ts`;
        if (!existsSync(path)) writeFileSync(path, 'export {};\n');
    }
    edit('packages/elements/package.json', (s) => {
        const json = JSON.parse(s);
        json.exports[`./rich-text-editor/addons/${id}`] ??= entry(id, 'index');
        json.exports[`./rich-text-editor/addons/${id}/define`] ??= entry(id, 'define');
        return `${JSON.stringify(json, null, 2)}\n`;
    });
    edit('packages/elements/vite.config.ts', (s) => {
        const key = `'rich-text-editor/addons/${id}/index'`;
        if (s.includes(key)) return s;
        const eol = s.includes('\r\n') ? '\r\n' : '\n';
        const lines = ['index', 'define'].map((file) => `${INDENT}'rich-text-editor/addons/${id}/${file}': 'src/rich-text-editor/addons/${id}/${file}.ts',${eol}`);
        return s.replace(ANCHOR, (anchor) => `${anchor}${lines.join('')}`);
    });
}
console.log(`registered ${ids.join(', ')}; add size budgets after the first build`);
