import { defineElement } from '@gilav21/elements-base';
import { GeSpeedDial } from './speed-dial.js';
import { GeSpeedDialContextTrigger } from './sub/speed-dial-context-trigger.js';
import { GeSpeedDialItem } from './sub/speed-dial-item.js';
import { GeSpeedDialMask } from './sub/speed-dial-mask.js';
import { GeSpeedDialMenu } from './sub/speed-dial-menu.js';
import { GeSpeedDialTrigger } from './sub/speed-dial-trigger.js';

defineElement('speed-dial', GeSpeedDial);
defineElement('speed-dial-trigger', GeSpeedDialTrigger);
defineElement('speed-dial-menu', GeSpeedDialMenu);
defineElement('speed-dial-item', GeSpeedDialItem);
defineElement('speed-dial-mask', GeSpeedDialMask);
defineElement('speed-dial-context-trigger', GeSpeedDialContextTrigger);
