import { defineElement } from '@gilav21/elements-base';
import { GeHoverCard } from './hover-card.js';
import { GeHoverCardContent } from './sub/hover-card-content.js';
import { GeHoverCardTrigger } from './sub/hover-card-trigger.js';

defineElement('hover-card', GeHoverCard);
defineElement('hover-card-trigger', GeHoverCardTrigger);
defineElement('hover-card-content', GeHoverCardContent);
export { GeHoverCard, GeHoverCardContent, GeHoverCardTrigger };
