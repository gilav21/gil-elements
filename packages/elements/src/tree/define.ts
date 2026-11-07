import { defineElement } from '@gilav21/elements-base';
import { GeTree } from './tree.js';
import { GeTreeIcon } from './sub/tree-icon.js';
import { GeTreeItem } from './sub/tree-item.js';
import { GeTreeLabel } from './sub/tree-label.js';

defineElement('tree', GeTree);
defineElement('tree-item', GeTreeItem);
defineElement('tree-label', GeTreeLabel);
defineElement('tree-icon', GeTreeIcon);
