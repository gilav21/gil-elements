import { defineElement } from '@gilav21/elements-base';
import '../skeleton/define.js';
import { GeCardAccordion } from './card-accordion.js';
import { GeCardAccordionActions } from './sub/card-accordion-actions.js';
import { GeCardAccordionContent } from './sub/card-accordion-content.js';
import { GeCardAccordionItem } from './sub/card-accordion-item.js';
import { GeCardAccordionTrigger } from './sub/card-accordion-trigger.js';

defineElement('card-accordion', GeCardAccordion);
defineElement('card-accordion-item', GeCardAccordionItem);
defineElement('card-accordion-trigger', GeCardAccordionTrigger);
defineElement('card-accordion-actions', GeCardAccordionActions);
defineElement('card-accordion-content', GeCardAccordionContent);
export { GeCardAccordion, GeCardAccordionActions, GeCardAccordionContent, GeCardAccordionItem, GeCardAccordionTrigger };
