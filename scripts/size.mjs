// Gzipped cost of every built entry point, checked against size-budget.json (bytes).
// An entry's cost is the entry plus the chunks it imports statically (what `import 'x/define'` loads); lazy import() chunks are not counted.
// A budget is a ceiling a little above the measured cost, so growth is a decision: `node scripts/size.mjs --update` rewrites the file, review the diff.
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../packages/elements/dist', import.meta.url));
const budgetFile = fileURLToPath(new URL('../size-budget.json', import.meta.url));
const update = process.argv.includes('--update');
// `from './x.js'` (import/export) and a bare `import './x.js'`; dynamic `import('./x.js')` has a parenthesis and does not match.
const STATIC_IMPORT = /\b(?:from|import)\s*["'](\.[^"']+)["']/g;

const gzipSize = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const withHeadroom = (bytes) => Math.ceil((bytes * 1.05) / 10) * 10;

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) yield* walk(path);
        else if (path.endsWith('.js')) yield path;
    }
}

function loadedBy(file, seen = new Set()) {
    if (seen.has(file)) return seen;
    seen.add(file);
    for (const match of readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) loadedBy(resolve(dirname(file), match[1]), seen);
    return seen;
}

const costs = {};
for (const file of walk(root)) {
    const key = relative(root, file).replaceAll('\\', '/');
    if (!key.startsWith('chunks/')) costs[key] = [...loadedBy(file)].reduce((sum, f) => sum + gzipSize(f), 0);
}

if (update) {
    const next = Object.fromEntries(Object.entries(costs).map(([key, bytes]) => [key, withHeadroom(bytes)]));
    writeFileSync(budgetFile, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`size-budget.json rewritten: ${Object.keys(next).length} entry points`);
    process.exit(0);
}

const budget = JSON.parse(readFileSync(budgetFile, 'utf8'));
const problems = [];
for (const [key, bytes] of Object.entries(costs)) {
    if (budget[key] === undefined) problems.push(`${key.padEnd(44)} ${String(bytes).padStart(7)} B   no budget`);
    else if (bytes > budget[key]) problems.push(`${key.padEnd(44)} ${String(bytes).padStart(7)} B   OVER ${budget[key]}`);
}
for (const key of Object.keys(budget)) if (!(key in costs)) console.warn(`stale budget (no such entry): ${key}`);
console.log(`${Object.keys(costs).length - problems.length}/${Object.keys(costs).length} entry points within budget`);
if (problems.length > 0) console.log(`${problems.join('\n')}\n(run \`node scripts/size.mjs --update\` if the growth is intended)`);
process.exit(problems.length > 0 ? 1 : 0);
