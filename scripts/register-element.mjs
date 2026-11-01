// Registers a new element folder in every place that lists elements. Usage: node scripts/register-element.mjs <name> <ClassName>
import { readFileSync, writeFileSync } from 'node:fs';
const [name, cls] = process.argv.slice(2);
if (!name || !cls) throw new Error('usage: register-element.mjs <name> <ClassName>');
const edit = (file, fn) => writeFileSync(file, fn(readFileSync(file, 'utf8')));

edit('packages/elements/package.json', (s) => {
    const json = JSON.parse(s);
    json.exports[`./${name}`] = { types: `./dist/${name}/index.d.ts`, development: `./src/${name}/index.ts`, default: `./dist/${name}/index.js` };
    json.exports[`./${name}/define`] = { types: `./dist/${name}/define.d.ts`, development: `./src/${name}/define.ts`, default: `./dist/${name}/define.js` };
    return `${JSON.stringify(json, null, 2)}\n`;
});
edit('packages/elements/vite.config.ts', (s) => s.replace("            },\n            formats: ['es'],", `                '${name}/index': 'src/${name}/index.ts',\n                '${name}/define': 'src/${name}/define.ts',\n            },\n            formats: ['es'],`));
edit('packages/elements/src/index.ts', (s) => `${s.trimEnd()}\nexport * from './${name}/index.js';\n`);
edit('parity/entry.ts', (s) => `${s.trimEnd()}\nimport '../packages/elements/src/${name}/define.js';\n`);
edit('apps/demo/src/main.ts', (s) => s.replace("import '@gilav21/elements/page-header/define';", `import '@gilav21/elements/${name}/define';\nimport '@gilav21/elements/page-header/define';`));
console.log(`registered ${name} (${cls}); add size budgets after the first build`);
