import { defineElement } from '@gilav21/elements-base';
import { GeSortable } from './sortable.js';
import { GeSortableItem } from './sub/sortable-item.js';
import { GeSortableGhost, GeSortableHandle, GeSortablePlaceholder } from './sub/sortable-parts.js';

defineElement('sortable', GeSortable);
defineElement('sortable-item', GeSortableItem);
defineElement('sortable-handle', GeSortableHandle);
defineElement('sortable-ghost', GeSortableGhost);
defineElement('sortable-placeholder', GeSortablePlaceholder);
