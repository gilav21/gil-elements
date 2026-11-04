// shadcn-angular resizable.component.ts, sub/resizable-panel.component.ts and sub/resizable-handle.component.ts.
const GRIP = '<svg class="h-2.5 w-2.5 text-muted-foreground" viewBox="0 0 6 10" fill="currentColor"><circle cx="1" cy="2" r="0.8"/><circle cx="1" cy="5" r="0.8"/><circle cx="1" cy="8" r="0.8"/><circle cx="5" cy="2" r="0.8"/><circle cx="5" cy="5" r="0.8"/><circle cx="5" cy="8" r="0.8"/></svg>';
const HANDLE = 'relative flex items-center justify-center select-none shrink-0 focus-visible:ring-ring focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-none bg-border hover:bg-primary/30 active:bg-primary/50';

// tailwind-merge: the class input's h-[300px] replaces the built-in h-full.
const rGroup = (direction, boxClasses, inner) =>
    `<ui-resizable-panel-group class="contents"><div class="flex ${direction === 'vertical' ? `flex-col${boxClasses.includes('h-[') ? '' : ' h-full'}` : 'flex-row w-full'} ${boxClasses}" data-slot="resizable-panel-group" data-direction="${direction}">${inner}</div></ui-resizable-panel-group>`;
const rPanel = (size, content) =>
    `<ui-resizable-panel class="overflow-hidden min-h-0 min-w-0" style="flex-grow: 0; flex-shrink: 0; flex-basis: ${size}%;" data-slot="resizable-panel">${content}</ui-resizable-panel>`;
const rHandle = (direction, size, grip, now = 30, label = 'Resize Handle') => {
    const horizontal = direction === 'horizontal';
    const style = horizontal ? `width: ${size}px; min-width: ${size}px; touch-action: none;` : `height: ${size}px; min-height: ${size}px; touch-action: none;`;
    const gripBox = grip ? `<div class="bg-border z-10 flex items-center justify-center rounded-sm border ${horizontal ? 'h-4 w-3' : 'h-3 w-4'}">${horizontal ? GRIP : GRIP.replace('class="h-2.5', 'class="rotate-90 h-2.5')}</div>` : '';
    return `<ui-resizable-handle class="contents"><div class="${HANDLE} ${horizontal ? 'cursor-col-resize' : 'cursor-row-resize'}" style="${style}" data-slot="resizable-handle" tabindex="0" role="separator" aria-orientation="${horizontal ? 'vertical' : 'horizontal'}" aria-valuenow="${now}" aria-valuemin="10" aria-valuemax="90" aria-label="${label}">${gripBox}</div></ui-resizable-handle>`;
};

const rBody = (text, tint) => `<div class="flex h-full items-center justify-center ${tint ? 'bg-muted/30 ' : ''}p-6"><span class="font-semibold">${text}</span></div>`;
const eBody = (text, tint) => `<div style="display:flex;height:100%;align-items:center;justify-content:center;${tint ? 'background-color:color-mix(in oklab,var(--muted) 30%,transparent);' : ''}padding:1.5rem"><span style="font-weight:600">${text}</span></div>`;
const BOX = 'rounded-lg border';
const eBox = (extra) => `border:1px solid var(--border);border-radius:var(--radius);${extra}`;

const horizontal = {
    id: 'horizontal',
    ref: rGroup('horizontal', `min-h-[200px] max-w-md ${BOX}`, rPanel(30, rBody('Left (30%)', true)) + rHandle('horizontal', 2, false, 30) + rPanel(70, rBody('Right (70%)', false))),
    el: `<ge-resizable-panel-group style="${eBox('min-height:200px;max-width:28rem;')}"><ge-resizable-panel default-size="30">${eBody('Left (30%)', true)}</ge-resizable-panel><ge-resizable-handle handle-size="2"></ge-resizable-handle><ge-resizable-panel default-size="70">${eBody('Right (70%)', false)}</ge-resizable-panel></ge-resizable-panel-group>`,
};
const withGrip = {
    id: 'grip',
    ref: rGroup('horizontal', `min-h-[200px] max-w-md ${BOX}`, rPanel(30, rBody('Left', true)) + rHandle('horizontal', 8, true, 30) + rPanel(70, rBody('Right', false))),
    el: `<ge-resizable-panel-group style="${eBox('min-height:200px;max-width:28rem;')}"><ge-resizable-panel default-size="30" min-size="20" max-size="60">${eBody('Left', true)}</ge-resizable-panel><ge-resizable-handle handle-size="8" with-handle></ge-resizable-handle><ge-resizable-panel default-size="70" min-size="40" max-size="80">${eBody('Right', false)}</ge-resizable-panel></ge-resizable-panel-group>`,
};
const vertical = {
    id: 'vertical',
    ref: rGroup('vertical', `h-[300px] max-w-md ${BOX}`, rPanel(40, rBody('Top (40%)', true)) + rHandle('vertical', 2, false, 40) + rPanel(60, rBody('Bottom (60%)', false))),
    el: `<ge-resizable-panel-group direction="vertical" style="${eBox('height:300px;max-width:28rem;')}"><ge-resizable-panel default-size="40">${eBody('Top (40%)', true)}</ge-resizable-panel><ge-resizable-handle handle-size="2"></ge-resizable-handle><ge-resizable-panel default-size="60">${eBody('Bottom (60%)', false)}</ge-resizable-panel></ge-resizable-panel-group>`,
};
const verticalGrip = {
    id: 'vertical-grip',
    ref: rGroup('vertical', `h-[300px] max-w-md ${BOX}`, rPanel(40, rBody('Top', true)) + rHandle('vertical', 8, true, 40) + rPanel(60, rBody('Bottom', false))),
    el: `<ge-resizable-panel-group direction="vertical" style="${eBox('height:300px;max-width:28rem;')}"><ge-resizable-panel default-size="40">${eBody('Top', true)}</ge-resizable-panel><ge-resizable-handle handle-size="8" with-handle></ge-resizable-handle><ge-resizable-panel default-size="60">${eBody('Bottom', false)}</ge-resizable-panel></ge-resizable-panel-group>`,
};
const three = {
    id: 'three-panels',
    ref: rGroup('horizontal', `min-h-[120px] max-w-md ${BOX}`, rPanel(20, rBody('A', true)) + rHandle('horizontal', 4, false, 20) + rPanel(50, rBody('B', false)) + rHandle('horizontal', 4, false, 50) + rPanel(30, rBody('C', true))),
    el: `<ge-resizable-panel-group style="${eBox('min-height:120px;max-width:28rem;')}"><ge-resizable-panel default-size="20">${eBody('A', true)}</ge-resizable-panel><ge-resizable-handle></ge-resizable-handle><ge-resizable-panel default-size="50">${eBody('B', false)}</ge-resizable-panel><ge-resizable-handle></ge-resizable-handle><ge-resizable-panel default-size="30">${eBody('C', true)}</ge-resizable-panel></ge-resizable-panel-group>`,
};
const disabled = {
    id: 'disabled-handle',
    ref: rGroup('horizontal', `min-h-[120px] max-w-md ${BOX}`, rPanel(30, rBody('Left', true)) + rPanel(70, rBody('Right', false))),
    el: `<ge-resizable-panel-group style="${eBox('min-height:120px;max-width:28rem;')}"><ge-resizable-panel default-size="30">${eBody('Left', true)}</ge-resizable-panel><ge-resizable-handle disabled></ge-resizable-handle><ge-resizable-panel default-size="70">${eBody('Right', false)}</ge-resizable-panel></ge-resizable-panel-group>`,
};

export default {
    name: 'resizable',
    items: [
        horizontal,
        withGrip,
        vertical,
        verticalGrip,
        three,
        disabled,
        { id: 'rtl', ref: `<div dir="rtl">${horizontal.ref}</div>`, el: `<div dir="rtl">${horizontal.el}</div>` },
        { id: 'rtl-grip', ref: `<div dir="rtl">${withGrip.ref}</div>`, el: `<div dir="rtl">${withGrip.el}</div>` },
        { id: 'focus-handle', focus: { ref: '[role=separator]', el: '[role=separator]' }, ref: horizontal.ref, el: horizontal.el },
        { id: 'focus-grip', focus: { ref: '[role=separator]', el: '[role=separator]' }, ref: withGrip.ref, el: withGrip.el },
    ],
};
