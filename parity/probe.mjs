// Diagnostic, not a gate: which button structures paint a label like a native <button> does when the label's
// origin is fractional? Run on CI, where the parity check disagrees with a local run.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const BASE = 'font:500 14px/1.4286 system-ui,sans-serif;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;box-sizing:border-box;border:1px solid transparent;border-radius:8px;background:#222;color:#fff;padding:0 16px;margin:0;';
const variants = {
    'native button': (h) => `<button style="${BASE}height:${h}px">Save changes</button>`,
    'div flex container': (h) => `<div style="${BASE}height:${h}px">Save changes</div>`,
    'button + span wrapper': (h) => `<button style="${BASE}height:${h}px"><span>Save changes</span></button>`,
    'button + display:contents span': (h) => `<button style="${BASE}height:${h}px"><span style="display:contents">Save changes</span></button>`,
    'button display:flex': (h) => `<button style="${BASE.replace('display:inline-flex', 'display:flex')}height:${h}px;width:max-content">Save changes</button>`,
    'shadow button + slot': (h) =>
        `<div data-host style="display:contents" data-h="${h}">Save changes</div>`,
};
const browser = await chromium.launch();
console.log('chromium', browser.version());
for (const h of [36, 27, 31.5]) {
    const shots = {};
    for (const [name, make] of Object.entries(variants)) {
        const page = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 400, height: 200 } });
        await page.setContent(`<body style="margin:0;padding:12px;background:#fff"><div id="t" style="display:block;width:max-content">${make(h)}</div></body>`);
        await page.evaluate((height) => {
            const host = document.querySelector('[data-host]');
            if (!host) return;
            const root = host.attachShadow({ mode: 'open' });
            root.innerHTML = `<button style="font:500 14px/1.4286 system-ui,sans-serif;display:inline-flex;align-items:center;justify-content:center;white-space:nowrap;box-sizing:border-box;border:1px solid transparent;border-radius:8px;background:#222;color:#fff;padding:0 16px;margin:0;height:${height}px"><slot></slot></button>`;
        }, h);
        shots[name] = PNG.sync.read(await page.locator('#t').screenshot());
        await page.close();
    }
    const ref = shots['native button'];
    for (const [name, shot] of Object.entries(shots)) {
        const same = shot.width === ref.width && shot.height === ref.height;
        const diff = same ? pixelmatch(ref.data, shot.data, undefined, ref.width, ref.height, { threshold: 0.02 }) : 'SIZE';
        console.log(`height ${h}  ${name.padEnd(34)} ${diff} px differ from native button`);
    }
}
await browser.close();
