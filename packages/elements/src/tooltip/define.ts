import { defineElement } from '@gilav21/elements-base';
import { GeTooltip } from './tooltip.js';
import { GeTooltipContent } from './sub/tooltip-content.js';
import { GeTooltipTrigger } from './sub/tooltip-trigger.js';

defineElement('tooltip', GeTooltip);
defineElement('tooltip-trigger', GeTooltipTrigger);
defineElement('tooltip-content', GeTooltipContent);
export { GeTooltip, GeTooltipContent, GeTooltipTrigger };
