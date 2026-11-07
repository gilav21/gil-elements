// shadcn-angular file-upload.component.html and .ts (classes), with ui-button and ui-progress inside.
import { ref as button } from '../lib/button-ref.mjs';
import { SAMPLE_IMAGE, SAMPLE_SIZE } from '../lib/sample-image.mjs';

const UPLOAD = '<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>';
const FILE = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>';
const X = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

const dropzone = ({ dragging = false, disabled = false } = {}) => {
    const cls = ['relative flex min-h-[100px] sm:min-h-[150px]', disabled ? 'cursor-not-allowed' : 'cursor-pointer', 'items-center justify-center rounded-lg border-2 border-dashed p-4 sm:p-6 transition-colors', 'hover:border-primary/50 hover:bg-accent/50'];
    if (dragging) cls.push('border-primary bg-accent');
    if (disabled) cls.push('opacity-50');
    return cls.join(' ');
};
// tailwind-merge by hand: p-1 replaces the size's padding, and the extra utilities replace the variant's hover colours and transition.
const REMOVE = 'shrink-0 rounded-full p-1 pointer-coarse:size-11 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors';
const merged = (html) =>
    html
        .replace(' hover:bg-muted hover:text-foreground', '')
        .replace(' transition-all', '')
        .replace(' py-2', '');
const removeButton = merged(button('outline', 'default', X, { extra: REMOVE })).replace(' rounded-lg', '');

const row = ({ name, size, image = false, status = 'pending', progress = 0, error = '' }) =>
    `<div class="flex items-center gap-3 p-2 rounded-md bg-muted/50">` +
    (image
        ? `<img src="${SAMPLE_IMAGE}" alt="" class="h-10 w-10 rounded object-cover shrink-0">`
        : `<div class="flex h-10 w-10 items-center justify-center rounded bg-muted shrink-0">${FILE}</div>`) +
    `<div class="flex-1 min-w-0"><p class="text-sm font-medium truncate">${name}</p><p class="text-xs text-muted-foreground">${size}</p>` +
    (status === 'uploading'
        ? `<ui-progress class="mt-1 h-1 block"><div class="relative h-2 w-full overflow-hidden rounded-full bg-primary/20" data-slot="progress"><progress class="sr-only" value="${progress}" max="100"></progress><div class="h-full bg-primary transition-all rounded-full" style="width:${progress}%" aria-hidden="true"></div></div></ui-progress>`
        : '') +
    (status === 'error' && error ? `<p class="text-xs text-destructive mt-1">${error}</p>` : '') +
    `</div>${removeButton}</div>`;

const empty = ({ caption = '', title = 'Drag & drop files here', hint = 'or click to browse' } = {}) =>
    `<div class="flex flex-col items-center gap-2 text-center">${UPLOAD}<div><p class="text-sm font-medium">${title}</p><p class="text-xs text-muted-foreground">${hint}</p></div>${caption ? `<p class="text-xs text-muted-foreground">${caption}</p>` : ''}</div>`;

const wrap = (inner, { dir = 'ltr', crop = '', ...dz } = {}) =>
    `<ui-file-upload class="block"><div class="w-full" data-slot="file-upload" dir="${dir}"><div role="presentation" class="${dropzone(dz)}"><input type="file" class="sr-only">${inner}</div>${crop}</div></ui-file-upload>`;

const list = (rows, more = 'Add more files') =>
    `<div class="w-full space-y-2">${rows.map(row).join('')}${merged(button('outline', 'default', more, { extra: 'w-full text-sm text-primary hover:underline' }))}</div>`;

const W = 'width:28rem;';
const el = (attrs = '', files = []) =>
    `<ge-file-upload ${attrs}${files.length ? ` data-image="${SAMPLE_IMAGE}" data-files='${JSON.stringify(files)}'` : ''}></ge-file-upload>`;
const spec = (rows) => rows.map(({ name, size, image, status, progress, error }) => ({ name, size: SIZES[size] ?? 0, image, progress: status === 'uploading' ? progress : status === 'complete' ? 100 : undefined, error: status === 'error' ? error : undefined }));
const SIZES = { '428 B': 0, '1.5 MB': 1572864, '240 KB': 245760, '10 KB': 10240, '3.2 MB': 3355443 };

const ROWS = [
    { name: 'report-q3.pdf', size: '1.5 MB' },
    { name: 'photo.png', size: '428 B', image: true },
    { name: 'dataset-with-a-really-long-name-that-has-to-be-cut-off-somewhere.csv', size: '3.2 MB', status: 'uploading', progress: 45 },
    { name: 'notes.txt', size: '10 KB', status: 'complete' },
    { name: 'broken.zip', size: '10 KB', status: 'error', error: 'Upload failed: network error' },
];

// The crop panel, as the template renders it: the box is the whole image, or the largest centred box for the locked ratio.
const CROP_FRAME = 'relative mx-auto w-full max-w-[calc(100vw-3rem)] sm:max-w-[420px] select-none overflow-hidden rounded-md bg-muted';
const cropPanel = ({ aspect = null, remaining = 0, applying = false, title = 'Crop image', actions = ['Cancel', 'Skip', 'Apply'] } = {}) => {
    const { width: nw, height: nh } = SAMPLE_SIZE;
    let w = nw;
    let h = nh;
    if (aspect) {
        w = nw;
        h = w / aspect;
        if (h > nh) {
            h = nh;
            w = h * aspect;
        }
    }
    const box = `left:${(((nw - w) / 2) / nw) * 100}%;top:${(((nh - h) / 2) / nh) * 100}%;width:${(w / nw) * 100}%;height:${(h / nh) * 100}%`;
    return (
        `<section class="mt-3 rounded-lg border bg-background p-3 sm:p-4" data-slot="file-upload-crop" aria-label="${title}">` +
        `<div class="mb-2 flex flex-wrap items-center justify-between gap-2"><p class="text-sm font-medium truncate max-w-[180px] sm:max-w-[320px]">${title}</p>${remaining ? `<span class="text-xs text-muted-foreground">+${remaining}</span>` : ''}</div>` +
        `<div class="${CROP_FRAME}" data-slot="file-upload-crop-frame"><img src="${SAMPLE_IMAGE}" alt="" class="block w-full" draggable="false">` +
        `<div class="absolute cursor-move border-2 border-primary bg-primary/10 touch-none" data-slot="file-upload-crop-box" style="${box}">` +
        `<button type="button" class="absolute ltr:left-0 rtl:right-0 top-0 h-11 w-11 cursor-move rounded-none bg-transparent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"></button>` +
        `<button type="button" class="absolute -bottom-2 ltr:-right-2 rtl:-left-2 block h-5 w-5 cursor-nwse-resize rounded-full border-2 border-background bg-primary touch-none focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"></button>` +
        `</div></div>` +
        `<div class="mt-3 flex flex-wrap items-center justify-end gap-2">${button('ghost', 'default', actions[0])}${button('outline', 'default', actions[1])}${button('default', 'default', actions[2], { disabled: applying })}</div></section>`
    );
};
const IMAGE_FILE = [{ name: 'avatar.png', size: 0, image: true }];

const items = [
    { id: 'empty', wrap: W, ref: wrap(empty()), el: el() },
    { id: 'empty-max-size', wrap: W, ref: wrap(empty({ caption: 'Max size: 10 MB' })), el: el('max-size="10485760"') },
    { id: 'empty-disabled', wrap: W, ref: wrap(empty(), { disabled: true }), el: el('disabled') },
    { id: 'dragging', wrap: W, ref: wrap(empty(), { dragging: true }), el: `<ge-file-upload data-dragging></ge-file-upload>` },
    { id: 'files', wrap: W, ref: wrap(list(ROWS)), el: el('', spec(ROWS)) },
    { id: 'files-disabled', wrap: W, ref: wrap(list(ROWS.slice(0, 2)), { disabled: true }), el: el('disabled', spec(ROWS.slice(0, 2))) },
    { id: 'files-full', wrap: W, ref: wrap(list(ROWS.slice(0, 2)), { disabled: true }), el: el('max-files="2"', spec(ROWS.slice(0, 2))) },
    { id: 'files-narrow', wrap: 'width:20rem;', ref: wrap(list(ROWS.slice(1, 3))), el: el('', spec(ROWS.slice(1, 3))) },
    { id: 'crop', wrap: 'width:30rem;', ref: wrap(empty(), { crop: cropPanel() }), el: el('crop-images', IMAGE_FILE) },
    { id: 'crop-square', wrap: 'width:30rem;', ref: wrap(empty(), { crop: cropPanel({ aspect: 1 }) }), el: el('crop-images crop-aspect="1"', IMAGE_FILE) },
    { id: 'crop-wide', wrap: 'width:30rem;', ref: wrap(empty(), { crop: cropPanel({ aspect: 2 }) }), el: el('crop-images crop-aspect="2"', IMAGE_FILE) },
    { id: 'crop-remaining', wrap: 'width:30rem;', ref: wrap(empty(), { crop: cropPanel({ remaining: 2 }) }), el: el('crop-images', [...IMAGE_FILE, ...IMAGE_FILE, ...IMAGE_FILE]) },
    {
        id: 'rtl',
        wrap: `${W}direction:rtl;`,
        ref: wrap(empty({ title: 'גרור ושחרר קבצים כאן', hint: 'או לחץ לעיון', caption: 'גודל מרבי: 10 MB' }), { dir: 'rtl' }),
        el: el('locale="he" max-size="10485760"'),
    },
];
export default { name: 'file-upload', items };
