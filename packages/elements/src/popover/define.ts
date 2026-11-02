import { defineElement } from '@gilav21/elements-base';
import { GePopover } from './popover.js';
import { GePopoverClose } from './sub/popover-close.js';
import { GePopoverContent } from './sub/popover-content.js';
import { GePopoverTrigger } from './sub/popover-trigger.js';

defineElement('popover', GePopover);
defineElement('popover-trigger', GePopoverTrigger);
defineElement('popover-content', GePopoverContent);
defineElement('popover-close', GePopoverClose);
export { GePopover, GePopoverClose, GePopoverContent, GePopoverTrigger };
