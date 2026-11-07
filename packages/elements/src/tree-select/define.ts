import { defineElement } from '@gilav21/elements-base';
import '../popover/define.js';
import '../tree/define.js';
import { GeTreeSelect } from './tree-select.js';
import { GeTreeSelectContent, GeTreeSelectTrigger } from './sub/tree-select-parts.js';

defineElement('tree-select', GeTreeSelect);
defineElement('tree-select-trigger', GeTreeSelectTrigger);
defineElement('tree-select-content', GeTreeSelectContent);
