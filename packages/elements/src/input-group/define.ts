import { defineElement } from '@gilav21/elements-base';
import { GeInputGroup } from './input-group.js';
import { GeInputGroupAddon } from './sub/input-group-addon.js';
import { GeInputGroupInput } from './sub/input-group-input.js';
import { GeInputGroupText } from './sub/input-group-text.js';

defineElement('input-group', GeInputGroup);
defineElement('input-group-addon', GeInputGroupAddon);
defineElement('input-group-input', GeInputGroupInput);
defineElement('input-group-text', GeInputGroupText);
