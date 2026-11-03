import { defineElement } from '@gilav21/elements-base';
import { GeSelect } from './select.js';
import { GeSelectContent } from './sub/select-content.js';
import { GeSelectGroup } from './sub/select-group.js';
import { GeSelectItem } from './sub/select-item.js';
import { GeSelectLabel } from './sub/select-label.js';
import { GeSelectSeparator } from './sub/select-separator.js';
import { GeSelectTrigger } from './sub/select-trigger.js';
import { GeSelectValue } from './sub/select-value.js';

defineElement('select', GeSelect);
defineElement('select-trigger', GeSelectTrigger);
defineElement('select-value', GeSelectValue);
defineElement('select-content', GeSelectContent);
defineElement('select-item', GeSelectItem);
defineElement('select-group', GeSelectGroup);
defineElement('select-label', GeSelectLabel);
defineElement('select-separator', GeSelectSeparator);
