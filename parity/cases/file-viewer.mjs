// shadcn-angular file-viewer.component.html: the toolbar and the xlsx, unsupported and error states.
// Text is left out (font-mono resolves to different fonts on the two pages); docx/pdf/pptx are covered by tests.
export const isolated = true;

const BTN = 'inline-flex items-center justify-center h-7 w-7 pointer-coarse:size-11 rounded hover:bg-muted disabled:opacity-50';
const svg = (inner, size = 16, sw = 2, cls = '') => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${cls ? ` class="${cls}"` : ''}>${inner}</svg>`;
const DOWNLOAD = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>';
const ZOOM_OUT = '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="8" x2="14" y1="11" y2="11"/>';
const ZOOM_IN = '<circle cx="11" cy="11" r="8"/><line x1="21" x2="16.65" y1="21" y2="16.65"/><line x1="11" x2="11" y1="8" y2="14"/><line x1="8" x2="14" y1="11" y2="11"/>';
const XLSX = 'UEsDBBQAAAAAAAAAAACQjH8xNwMAADcDAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbDw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFR5cGVzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L2NvbnRlbnQtdHlwZXMiPgo8RGVmYXVsdCBFeHRlbnNpb249InJlbHMiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtcGFja2FnZS5yZWxhdGlvbnNoaXBzK3htbCIvPgo8RGVmYXVsdCBFeHRlbnNpb249InhtbCIgQ29udGVudFR5cGU9ImFwcGxpY2F0aW9uL3htbCIvPgo8T3ZlcnJpZGUgUGFydE5hbWU9Ii94bC93b3JrYm9vay54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zaGVldC5tYWluK3htbCIvPgo8T3ZlcnJpZGUgUGFydE5hbWU9Ii94bC93b3Jrc2hlZXRzL3NoZWV0MS54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC53b3Jrc2hlZXQreG1sIi8+CjxPdmVycmlkZSBQYXJ0TmFtZT0iL3hsL3N0eWxlcy54bWwiIENvbnRlbnRUeXBlPSJhcHBsaWNhdGlvbi92bmQub3BlbnhtbGZvcm1hdHMtb2ZmaWNlZG9jdW1lbnQuc3ByZWFkc2hlZXRtbC5zdHlsZXMreG1sIi8+CjxPdmVycmlkZSBQYXJ0TmFtZT0iL3hsL3NoYXJlZFN0cmluZ3MueG1sIiBDb250ZW50VHlwZT0iYXBwbGljYXRpb24vdm5kLm9wZW54bWxmb3JtYXRzLW9mZmljZWRvY3VtZW50LnNwcmVhZHNoZWV0bWwuc2hhcmVkU3RyaW5ncyt4bWwiLz4KPC9UeXBlcz5QSwMEFAAAAAAAAAAAAH5vwIUqAQAAKgEAAAsAAABfcmVscy8ucmVsczw/eG1sIHZlcnNpb249IjEuMCIgZW5jb2Rpbmc9IlVURi04IiBzdGFuZGFsb25lPSJ5ZXMiPz4KPFJlbGF0aW9uc2hpcHMgeG1sbnM9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9wYWNrYWdlLzIwMDYvcmVsYXRpb25zaGlwcyI+CjxSZWxhdGlvbnNoaXAgSWQ9InJJZDEiIFR5cGU9Imh0dHA6Ly9zY2hlbWFzLm9wZW54bWxmb3JtYXRzLm9yZy9vZmZpY2VEb2N1bWVudC8yMDA2L3JlbGF0aW9uc2hpcHMvb2ZmaWNlRG9jdW1lbnQiIFRhcmdldD0ieGwvd29ya2Jvb2sueG1sIi8+CjwvUmVsYXRpb25zaGlwcz5QSwMEFAAAAAAAAAAAAHT5apYeAQAAHgEAAA8AAAB4bC93b3JrYm9vay54bWw8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+Cjx3b3JrYm9vayB4bWxucz0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL3NwcmVhZHNoZWV0bWwvMjAwNi9tYWluIiB4bWxuczpyPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzIj4KPHNoZWV0cz48c2hlZXQgbmFtZT0iU2hlZXQxIiBzaGVldElkPSIxIiByOmlkPSJySWQxIi8+PC9zaGVldHM+Cjwvd29ya2Jvb2s+UEsDBBQAAAAAAAAAAAC0m/EWOQIAADkCAAAaAAAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHM8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+CjxSZWxhdGlvbnNoaXBzIHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvcGFja2FnZS8yMDA2L3JlbGF0aW9uc2hpcHMiPgo8UmVsYXRpb25zaGlwIElkPSJySWQxIiBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL3dvcmtzaGVldCIgVGFyZ2V0PSJ3b3Jrc2hlZXRzL3NoZWV0MS54bWwiLz4KPFJlbGF0aW9uc2hpcCBJZD0icklkMiIgVHlwZT0iaHR0cDovL3NjaGVtYXMub3BlbnhtbGZvcm1hdHMub3JnL29mZmljZURvY3VtZW50LzIwMDYvcmVsYXRpb25zaGlwcy9zdHlsZXMiIFRhcmdldD0ic3R5bGVzLnhtbCIvPgo8UmVsYXRpb25zaGlwIElkPSJySWQzIiBUeXBlPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvb2ZmaWNlRG9jdW1lbnQvMjAwNi9yZWxhdGlvbnNoaXBzL3NoYXJlZFN0cmluZ3MiIFRhcmdldD0ic2hhcmVkU3RyaW5ncy54bWwiLz4KPC9SZWxhdGlvbnNoaXBzPlBLAwQUAAAAAAAAAAAAHLnG8PMCAADzAgAADQAAAHhsL3N0eWxlcy54bWw8P3htbCB2ZXJzaW9uPSIxLjAiIGVuY29kaW5nPSJVVEYtOCIgc3RhbmRhbG9uZT0ieWVzIj8+CjxzdHlsZVNoZWV0IHhtbG5zPSJodHRwOi8vc2NoZW1hcy5vcGVueG1sZm9ybWF0cy5vcmcvc3ByZWFkc2hlZXRtbC8yMDA2L21haW4iPgo8Zm9udHMgY291bnQ9IjIiPgo8Zm9udD48c3ogdmFsPSIxMSIvPjxuYW1lIHZhbD0iQ2FsaWJyaSIvPjwvZm9udD4KPGZvbnQ+PGIvPjxzeiB2YWw9IjExIi8+PG5hbWUgdmFsPSJDYWxpYnJpIi8+PC9mb250Pgo8L2ZvbnRzPgo8ZmlsbHMgY291bnQ9IjIiPgo8ZmlsbD48cGF0dGVybkZpbGwgcGF0dGVyblR5cGU9Im5vbmUiLz48L2ZpbGw+CjxmaWxsPjxwYXR0ZXJuRmlsbCBwYXR0ZXJuVHlwZT0iZ3JheTEyNSIvPjwvZmlsbD4KPC9maWxscz4KPGJvcmRlcnMgY291bnQ9IjEiPgo8Ym9yZGVyPjxsZWZ0Lz48cmlnaHQvPjx0b3AvPjxib3R0b20vPjxkaWFnb25hbC8+PC9ib3JkZXI+CjwvYm9yZGVycz4KPGNlbGxTdHlsZVhm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';

const toolbar = ({ name, type = '', zoom = false, download = false }) =>
    `<div data-slot="file-viewer-toolbar" class="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2 text-sm"><div class="flex items-center gap-2 min-w-0"><span class="truncate font-medium">${name}</span>${type ? `<span class="text-muted-foreground text-xs uppercase">${type}</span>` : ''}</div><div class="flex items-center gap-1 shrink-0">${
        zoom
            ? `<button class="${BTN}" aria-label="Zoom out">${svg(ZOOM_OUT)}</button><span class="text-xs text-muted-foreground tabular-nums min-w-[40px] text-center">100%</span><button class="${BTN}" aria-label="Zoom in">${svg(ZOOM_IN)}</button>`
            : ''
    }${download ? `<a href="#" class="${BTN}" title="Download">${svg(DOWNLOAD)}</a>` : ''}</div></div>`;

const frame = (toolbarHtml, content) =>
    `<ui-file-viewer><div class="flex flex-col border rounded-lg overflow-hidden bg-background" data-slot="file-viewer" style="height: 300px;">${toolbarHtml}<div class="flex-1 overflow-auto relative" tabindex="0" data-slot="file-viewer-content">${content}</div></div></ui-file-viewer>`;

const th = (text) => `<th class="border border-border px-2 py-1.5 text-left font-medium text-xs whitespace-nowrap">${text}</th>`;
const td = (text) => `<td class="border border-border px-2 py-1 text-xs whitespace-nowrap">${text}</td>`;
const sheet = `<div class="flex flex-col h-full"><div class="flex-1 overflow-auto"><table class="w-full border-collapse text-sm"><thead class="sticky top-0 bg-muted z-10"><tr>${['Region', 'Revenue', 'Units'].map(th).join('')}</tr></thead><tbody>${[['North', '1200', '14'], ['South', '950', '9'], ['East', '1430', '21']].map((row) => `<tr class="hover:bg-muted/50">${row.map(td).join('')}</tr>`).join('')}</tbody></table></div></div>`;

const notice = (icon, message, link) =>
    `<div class="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">${icon}${message}${link}</div>`;
const FILE_ICON = svg('<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>', 40, 1.5, 'text-muted-foreground');
const ERROR_ICON = svg('<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>', 40, 1.5, 'text-muted-foreground');
const LINK = 'inline-flex items-center gap-1.5 text-sm text-primary hover:underline';

const props = (extra) => `height="300px" ${extra}`;

export default {
    name: 'file-viewer',
    items: [
        { id: 'empty', ref: frame(toolbar({ name: 'File' }), ''), el: `<ge-file-viewer ${props('')}></ge-file-viewer>` },
        {
            id: 'xlsx',
            ref: frame(toolbar({ name: 'sales.xlsx', type: 'xlsx', download: true }), sheet),
            el: `<ge-file-viewer ${props('')} data-file='${JSON.stringify({ name: 'sales.xlsx', base64: XLSX })}'></ge-file-viewer>`,
        },
        {
            id: 'unsupported',
            ref: frame(
                toolbar({ name: 'blob.bin', download: true }),
                notice(FILE_ICON, '<p class="text-sm text-muted-foreground">Preview not available for this file type.</p>', `<a href="#" class="${LINK}">Download file</a>`),
            ),
            el: `<ge-file-viewer ${props('')} data-file='${JSON.stringify({ name: 'blob.bin', base64: 'AQIDBAUGBwgAAAE=' })}'></ge-file-viewer>`,
        },
        {
            id: 'error',
            ref: frame(
                toolbar({ name: 'broken.docx', type: 'docx', zoom: true, download: true }),
                notice(ERROR_ICON, '<p class="text-sm text-muted-foreground max-w-xs">Data too small to be a ZIP file</p>', `<a href="#" class="${LINK}">${svg(DOWNLOAD, 14)}Download file</a>`),
            ),
            el: `<ge-file-viewer ${props('type="docx"')} data-file='${JSON.stringify({ name: 'broken.docx', base64: btoa('not a zip') })}'></ge-file-viewer>`,
        },
    ],
};
