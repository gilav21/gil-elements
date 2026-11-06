// shadcn-angular copy-to.directive.ts puts a click handler on the host itself, so the host is the clicked element.
// The "Copied" label is a fixed badge above the host, outside its box, so these cases compare the wrapped element's layout.
const B = 'padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--background);color:var(--foreground);font:inherit;font-size:14px;';
const TEXT = '<span style="display:inline-block;width:204px;box-sizing:border-box;padding:2px 6px;border-radius:4px;background:var(--muted);font-size:13px">';
export default {
    name: 'copy-to',
    items: [
        { id: 'button', ref: `<button style="${B}">Copy key</button>`, el: `<ge-copy-to value="sk-123"><button style="${B}">Copy key</button></ge-copy-to>` },
        { id: 'swatch', ref: '<div style="width:40px;height:40px;border-radius:6px;background:#ef4444"></div>', el: '<ge-copy-to value="#ef4444"><div style="width:40px;height:40px;border-radius:6px;background:#ef4444"></div></ge-copy-to>' },
        { id: 'text', ref: `${TEXT}npm i @gilav21/elements</span>`, el: `<ge-copy-to value="npm i @gilav21/elements">${TEXT}npm i @gilav21/elements</span></ge-copy-to>` },
    ],
};
