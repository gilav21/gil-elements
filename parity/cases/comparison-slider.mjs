// shadcn-angular comparison-slider.component.html: a `relative w-full overflow-hidden select-none aspect-video touch-none` root, the after image under a
// clip box holding the before image (an inner box as wide as the root), a divider (line, handle, line) and optional corner captions.
const svg = (a, b) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180" viewBox="0 0 320 180"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs><rect width="320" height="180" fill="url(#g)"/><circle cx="90" cy="60" r="34" fill="white" fill-opacity=".7"/><rect x="170" y="100" width="110" height="50" fill="black" fill-opacity=".35"/></svg>`)}`;
const BEFORE = svg('#f97316', '#be123c');
const AFTER = svg('#06b6d4', '#4f46e5');
const CHEVRON = (d) => `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
const H = CHEVRON('m15 18-6-6 6-6') + CHEVRON('m9 18 6-6-6-6');
const V = CHEVRON('m18 15-6-6-6 6') + CHEVRON('m6 9 6 6 6-6');
const LABEL = 'absolute top-2 text-xs bg-black/60 text-white rounded px-2 py-1 max-w-[120px] sm:max-w-[200px] truncate pointer-events-none z-20';
const HANDLE = 'pointer-events-auto z-20 flex items-center justify-center rounded-full bg-white shadow-md cursor-grab active:cursor-grabbing shrink-0 w-10 h-10 border-2 border-white/80 touch-none';
const ref = ({ position = 50, vertical = false, dir = 'ltr', before = '', after = '', width = 400, aspect = 'aspect-video', height = 225 } = {}) => {
    const clip = vertical ? `absolute overflow-hidden inset-x-0 top-0` : `absolute overflow-hidden inset-y-0 left-0`;
    const clipStyle = vertical ? `height:${position}%;overflow:hidden` : `width:${position}%;overflow:hidden`;
    const inner = vertical ? `style="height:${height}px" class="absolute top-0 left-0 w-full"` : `style="width:${width}px" class="absolute top-0 left-0 h-full"`;
    const divider = vertical ? 'absolute z-10 flex items-center justify-center pointer-events-none flex-row -translate-y-1/2 inset-x-0 h-1' : 'absolute z-10 flex items-center justify-center pointer-events-none flex-col -translate-x-1/2 inset-y-0 w-1';
    const dividerStyle = vertical ? `top:${position}%` : `left:${position}%`;
    const line = `<div class="bg-white/90 shadow flex-1 ${vertical ? 'h-0.5' : 'w-0.5'}"></div>`;
    return `<ui-comparison-slider class="contents"><div class="relative w-full overflow-hidden select-none ${aspect} touch-none" dir="${dir}" data-slot="comparison-slider">
<img src="${AFTER}" alt="After" class="absolute inset-0 w-full h-full object-cover block" draggable="false">
<div class="${clip}" style="${clipStyle}"><div ${inner}><img src="${BEFORE}" alt="Before" class="absolute top-0 left-0 object-cover block w-full h-full" draggable="false"></div></div>
<div class="${divider}" style="${dividerStyle}">${line}<input type="range" class="sr-only" min="0" max="100" value="${position}"><div class="${HANDLE} ${vertical ? 'flex-col' : 'flex-row'} gap-0.5" aria-hidden="true">${vertical ? V : H}</div>${line}</div>
${before ? `<span class="${LABEL} left-2">${before}</span>` : ''}${after ? `<span class="${LABEL} right-2">${after}</span>` : ''}
</div></ui-comparison-slider>`;
};
const el = ({ position = 50, attrs = '', style = '' } = {}) => `<ge-comparison-slider before-src="${BEFORE}" after-src="${AFTER}" before-alt="Before" after-alt="After" position="${position}" ${attrs} style="${style}"></ge-comparison-slider>`;
// The harness pads each case by 12px a side, so a 400px box needs a 424px wrapper.
const W = 'width:424px;';
export default {
    name: 'comparison-slider',
    items: [
        { id: 'middle', wrap: W, ref: ref(), el: el() },
        { id: 'quarter', wrap: W, ref: ref({ position: 25 }), el: el({ position: 25 }) },
        { id: 'far-right', wrap: W, ref: ref({ position: 92 }), el: el({ position: 92 }) },
        { id: 'at-start', wrap: W, ref: ref({ position: 0 }), el: el({ position: 0 }) },
        { id: 'vertical', wrap: W, ref: ref({ position: 40, vertical: true }), el: el({ position: 40, attrs: 'orientation="vertical"' }) },
        { id: 'captions', wrap: W, ref: ref({ before: 'Original', after: 'Edited' }), el: el({ attrs: 'before-label="Original" after-label="Edited"' }) },
        { id: 'long-caption', wrap: 'width:324px;', ref: ref({ width: 300, height: 168.75, before: 'A very long caption that needs cutting off', after: 'Edited' }), el: el({ attrs: 'before-label="A very long caption that needs cutting off" after-label="Edited"' }) },
        { id: 'square', wrap: W, ref: ref({ aspect: 'aspect-square', height: 400 }), el: el({ style: 'aspect-ratio:1/1' }) },
        { id: 'rtl-locale', wrap: W, ref: ref({ dir: 'rtl', position: 35 }), el: el({ position: 35, attrs: 'locale="he"' }) },
    ],
};
