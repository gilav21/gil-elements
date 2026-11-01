import { defineElement } from '@gilav21/elements-base';
import '../skeleton/define.js';
import { GeAccordion } from './accordion.js';
import { GeAccordionContent } from './sub/accordion-content.js';
import { GeAccordionItem } from './sub/accordion-item.js';
import { GeAccordionTrigger } from './sub/accordion-trigger.js';

defineElement('accordion', GeAccordion);
defineElement('accordion-item', GeAccordionItem);
defineElement('accordion-trigger', GeAccordionTrigger);
defineElement('accordion-content', GeAccordionContent);
export { GeAccordion, GeAccordionContent, GeAccordionItem, GeAccordionTrigger };
