// shadcn-angular separator.component.ts: 'block bg-border shrink-0' + 'h-[1px] w-full' | 'h-full w-[1px]'
export default {
    name: 'separator',
    items: [
        { id: 'horizontal', wrap: 'width:160px', ref: '<ui-separator role="separator" aria-orientation="horizontal" class="block bg-border shrink-0 h-[1px] w-full"></ui-separator>', el: '<ge-separator></ge-separator>' },
        { id: 'vertical', wrap: 'display:flex;height:32px', ref: '<ui-separator role="separator" aria-orientation="vertical" class="block bg-border shrink-0 h-full w-[1px]"></ui-separator>', el: '<ge-separator orientation="vertical"></ge-separator>' },
    ],
};
