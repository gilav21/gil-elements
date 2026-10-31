// Gzipped size of every built entry, checked against size-budget.json (bytes).
// A budget is a ceiling set a little above the measured size, so growth is a decision.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join, relative } from 'node:path';

const root = new URL('../packages/elements/dist', import.meta.url).pathname;
const budget = JSON.parse(readFileSync(new URL('../size-budget.json', import.meta.url), 'utf8'));

function* walk(dir) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) yield* walk(path);
        else if (path.endsWith('.js')) yield path;
    }
}

let failed = false;
for (const file of walk(root)) {
    const key = relative(root, file);
    const gz = gzipSync(readFileSync(file), { level: 9 }).length;
    const limit = budget[key];
    const status = limit === undefined ? 'no budget' : gz <= limit ? 'ok' : 'OVER';
    if (status !== 'ok') failed = true;
    console.log(`${key.padEnd(24)} ${String(gz).padStart(6)} B gzip   budget ${limit ?? '-'}   ${status}`);
}
process.exit(failed ? 1 : 0);
