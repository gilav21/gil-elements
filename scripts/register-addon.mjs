// Registers an addon entry pair (index + define) in package.json exports and the vite entries, and creates empty define/index stubs.
// Safe to run again. Usage: node scripts/register-addon.mjs [--component <name>] [--base <dir>] <id> [<id> ...]
//   --component  the element the addons belong to: rich-text-editor (default) or data-table
//   --base       the folder under src/ the entries live in; default <component>/addons (e.g. --base data-table for data-table/range-chart)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
    const at = args.indexOf(name);
    if (at === -1) return fallback;
    const [value] = args.splice(at, 2).slice(1);
    if (!value) throw new Error(`${name} needs a value`);
    return value;
};
const component = option('--component', 'rich-text-editor');
const base = option('--base', `${component}/addons`);
const ids = args;
if (ids.length === 0) throw new Error('usage: register-addon.mjs [--component <name>] [--base <dir>] <id> [<id> ...]');
// The vite entry each component's new lines go after (an existing line of that component, kept in place).
const ANCHORS = {
    'rich-text-editor': /^ *'rich-text-editor\/locales\/pt': .*\r?\n/m,
    'data-table': /^ *'data-table\/lazy\/filter-builder': .*\r?\n/m,
};
const anchor = ANCHORS[component];
if (!anchor) throw new Error(`unknown component "${component}" (known: ${Object.keys(ANCHORS).join(', ')})`);

const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, 'utf8')));
const entry = (id, file) => ({
    types: `./dist/${base}/${id}/${file}.d.ts`,
    development: `./src/${base}/${id}/${file}.ts`,
    default: `./dist/${base}/${id}/${file}.js`,
});
const INDENT = ' '.repeat(16);

for (const id of ids) {
    mkdirSync(`packages/elements/src/${base}/${id}`, { recursive: true });
    for (const file of ['define', 'index']) {
        const path = `packages/elements/src/${base}/${id}/${file}.ts`;
        if (!existsSync(path)) writeFileSync(path, 'export {};\n');
    }
    edit('packages/elements/package.json', (s) => {
        const json = JSON.parse(s);
        json.exports[`./${base}/${id}`] ??= entry(id, 'index');
        json.exports[`./${base}/${id}/define`] ??= entry(id, 'define');
        return `${JSON.stringify(json, null, 2)}\n`;
    });
    edit('packages/elements/vite.config.ts', (s) => {
        const key = `'${base}/${id}/index'`;
        if (s.includes(key)) return s;
        if (!anchor.test(s)) throw new Error(`vite.config.ts: no anchor line for ${component}`);
        const eol = s.includes('\r\n') ? '\r\n' : '\n';
        const lines = ['index', 'define'].map((file) => `${INDENT}'${base}/${id}/${file}': 'src/${base}/${id}/${file}.ts',${eol}`);
        return s.replace(anchor, (line) => `${line}${lines.join('')}`);
    });
}
console.log(`registered ${ids.map((id) => `${base}/${id}`).join(', ')}; add size budgets after the first build`);
