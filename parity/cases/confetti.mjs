// shadcn-angular confetti.directive.ts: the host becomes position:relative and overflow:hidden and gets one absolutely
// positioned, click-through canvas (z-index 100 unless set) sized to the host's box. The particles are random, so the
// cases compare that box and canvas with no burst fired.
const canvas = (w, h, z = 100) => `<canvas width="${w}" height="${h}" style="position:absolute;top:0;left:0;pointer-events:none;z-index:${z}"></canvas>`;
const content = '<div style="display:flex;height:100%;align-items:center;justify-content:center;font-size:14px">Content</div>';
const BOX = 'width:300px;height:200px;border:1px dashed var(--border);border-radius:8px;';
export default {
    name: 'confetti',
    items: [
        { id: 'box', ref: `<div style="position:relative;overflow:hidden;${BOX}">${content}${canvas(302, 202)}</div>`, el: `<ge-confetti style="${BOX}">${content}</ge-confetti>` },
        { id: 'padded', ref: `<div style="position:relative;overflow:hidden;${BOX}padding:16px;box-sizing:border-box">${content}${canvas(300, 200)}</div>`, el: `<ge-confetti style="${BOX}padding:16px;box-sizing:border-box">${content}</ge-confetti>` },
        { id: 'empty', ref: `<div style="position:relative;overflow:hidden;${BOX}">${canvas(302, 202)}</div>`, el: `<ge-confetti style="${BOX}"></ge-confetti>` },
    ],
};
