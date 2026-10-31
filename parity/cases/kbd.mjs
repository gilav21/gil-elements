// shadcn-angular kbd.component.ts
const CLASSES = 'inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] font-medium text-muted-foreground';
export default {
    name: 'kbd',
    items: ['K', 'Ctrl', '⌘'].map((key) => ({ id: key, ref: `<kbd class="${CLASSES}">${key}</kbd>`, el: `<ge-kbd>${key}</ge-kbd>` })),
};
