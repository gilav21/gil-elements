// The chart helpers (scales, paths, colours) are the same code shadcn-angular runs; the reference markup of a chart is
// built from them, so the parity cases transpile the TypeScript once and import it.
import { transformWithOxc } from 'vite';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../../packages/elements/src/shared/', import.meta.url));
const out = fileURLToPath(new URL('../out/chart-libs/', import.meta.url));
mkdirSync(`${out}chart`, { recursive: true });
writeFileSync(`${out}package.json`, '{"type":"module"}');
const emit = async (from, to) => writeFileSync(to, (await transformWithOxc(readFileSync(from, 'utf8'), from, { lang: 'ts' })).code);
await emit(`${root}color.ts`, `${out}color.js`);
for (const file of readdirSync(`${root}chart`).filter((f) => f.endsWith('.ts') && !f.includes('test') && f !== 'chart-base.ts')) await emit(`${root}chart/${file}`, `${out}chart/${file.replace('.ts', '.js')}`);
const load = (name) => import(pathToFileURL(`${out}chart/${name}.js`).href);
export const utils = await load('chart.utils');
export const scale = await load('chart-scale');
export const path = await load('chart-path');
export const interaction = await load('chart-interaction');
export const polar = await load('chart-polar');
export const colorScale = await load('chart-color-scale');
export const histogram = await load('histogram-bins');
