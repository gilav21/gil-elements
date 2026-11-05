import { defineElement } from '@gilav21/elements-base';
import { GeDock } from './dock.js';
import { GeDockIcon } from './sub/dock-icon.js';
import { GeDockItem } from './sub/dock-item.js';
import { GeDockLabel } from './sub/dock-label.js';

defineElement('dock', GeDock);
defineElement('dock-item', GeDockItem);
defineElement('dock-icon', GeDockIcon);
defineElement('dock-label', GeDockLabel);
