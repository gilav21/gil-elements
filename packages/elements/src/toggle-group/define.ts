import { defineElement } from '@gilav21/elements-base';
import { GeToggleGroup } from './toggle-group.js';
import { GeToggleGroupItem } from './sub/toggle-group-item.js';

defineElement('toggle-group', GeToggleGroup);
defineElement('toggle-group-item', GeToggleGroupItem);
export { GeToggleGroup, GeToggleGroupItem };
