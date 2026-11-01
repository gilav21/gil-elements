import { defineElement } from '@gilav21/elements-base';
import { GeCollapsible } from './collapsible.js';
import { GeCollapsibleContent } from './sub/collapsible-content.js';
import { GeCollapsibleTrigger } from './sub/collapsible-trigger.js';

defineElement('collapsible', GeCollapsible);
defineElement('collapsible-trigger', GeCollapsibleTrigger);
defineElement('collapsible-content', GeCollapsibleContent);
export { GeCollapsible, GeCollapsibleContent, GeCollapsibleTrigger };
