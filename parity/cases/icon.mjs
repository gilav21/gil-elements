// shadcn-angular icon.component.html: the <svg> carries `ui-icon ui-icon-<name>`, the glyph markup, and the weight/size attributes.
const GLYPH = {
    check: '<path d="m4 12.5 5 5L20 6.5" />',
    plus: '<path d="M12 5v14" /><path d="M5 12h14" />',
    heart: '<path d="M12 20s-8-5-8-11a4.5 4.5 0 0 1 8-2.5A4.5 4.5 0 0 1 20 9c0 6-8 11-8 11z" />',
    'circle-check-solid': '<circle cx="12" cy="12" r="9" /><g fill="none" stroke-width="2" style="stroke:var(--background, #fff)"><path d="m8 12.500 2.700 2.700L16 9.500" /></g>',
    circle: '<circle cx="12" cy="12" r="9" />',
};
const ref = (name, { size = '24', fill = 'none', stroke = 'currentColor', width = '2', color = '', glyph = GLYPH[name] ?? '', cls = name } = {}) =>
    `<ui-icon><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" class="ui-icon ui-icon-${cls}" data-slot="icon"${color ? ` style="color: ${color};"` : ''}>${glyph}</svg></ui-icon>`;
const WRAP = 'display:inline-block;color:rgb(30, 64, 175);';
const row = (...icons) => `<div style="display:flex;gap:12px;align-items:center">${icons.join('')}</div>`;

export default {
    name: 'icon',
    items: [
        { id: 'default', wrap: WRAP, ref: ref('check'), el: '<ge-icon name="check"></ge-icon>' },
        {
            id: 'sizes',
            wrap: WRAP,
            ref: row(...[['xs', '12'], ['sm', '16'], ['md', '24'], ['lg', '32'], ['xl', '48']].map(([, px]) => ref('plus', { size: px }))),
            el: row(...['xs', 'sm', 'md', 'lg', 'xl'].map((s) => `<ge-icon name="plus" size="${s}"></ge-icon>`)),
        },
        { id: 'raw-size', wrap: WRAP, ref: ref('plus', { size: '2rem' }), el: '<ge-icon name="plus" size="2rem"></ge-icon>' },
        {
            id: 'weights',
            wrap: WRAP,
            ref: row(ref('plus', { size: '32', width: '1.5' }), ref('plus', { size: '32' }), ref('plus', { size: '32', width: '2.5' }), ref('plus', { size: '32', width: '4' })),
            el: row('<ge-icon name="plus" size="lg" weight="light"></ge-icon>', '<ge-icon name="plus" size="lg"></ge-icon>', '<ge-icon name="plus" size="lg" weight="thick"></ge-icon>', '<ge-icon name="plus" size="lg" stroke-width="4"></ge-icon>'),
        },
        {
            id: 'solid',
            wrap: WRAP,
            ref: row(ref('heart', { size: '32', fill: 'currentColor', stroke: 'none', width: '0' }), ref('circle-check', { size: '32', fill: 'currentColor', stroke: 'none', width: '0', glyph: GLYPH['circle-check-solid'] }), ref('plus', { size: '32' })),
            el: row('<ge-icon name="heart" size="lg" weight="solid"></ge-icon>', '<ge-icon name="circle-check" size="lg" weight="solid"></ge-icon>', '<ge-icon name="plus" size="lg" weight="solid"></ge-icon>'),
        },
        {
            id: 'colours',
            wrap: WRAP,
            ref: row(ref('heart', { size: '32', color: 'rgb(220, 38, 38)' }), ref('circle', { size: '32', fill: 'rgb(34, 197, 94)' })),
            el: row('<ge-icon name="heart" size="lg" color="rgb(220, 38, 38)"></ge-icon>', '<ge-icon name="circle" size="lg" fill-color="rgb(34, 197, 94)"></ge-icon>'),
        },
        { id: 'unknown', wrap: WRAP, ref: row(ref('nope', { glyph: '' }), ref('check')), el: row('<ge-icon name="nope"></ge-icon>', '<ge-icon name="check"></ge-icon>') },
    ],
};
