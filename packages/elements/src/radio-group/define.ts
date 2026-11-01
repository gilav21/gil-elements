import { defineElement } from '@gilav21/elements-base';
import { GeRadioGroup } from './radio-group.js';
import { GeRadioGroupItem } from './sub/radio-group-item.js';

defineElement('radio-group', GeRadioGroup);
defineElement('radio-group-item', GeRadioGroupItem);
export { GeRadioGroup, GeRadioGroupItem };
