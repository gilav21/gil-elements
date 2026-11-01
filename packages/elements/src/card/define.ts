import { defineElement } from '@gilav21/elements-base';
import { GeCard } from './card.js';
import { GeCardContent } from './sub/card-content.js';
import { GeCardDescription } from './sub/card-description.js';
import { GeCardFooter } from './sub/card-footer.js';
import { GeCardHeader } from './sub/card-header.js';
import { GeCardTitle } from './sub/card-title.js';

defineElement('card', GeCard);
defineElement('card-header', GeCardHeader);
defineElement('card-title', GeCardTitle);
defineElement('card-description', GeCardDescription);
defineElement('card-content', GeCardContent);
defineElement('card-footer', GeCardFooter);
