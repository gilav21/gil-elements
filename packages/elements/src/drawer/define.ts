import { defineElement } from '@gilav21/elements-base';
import { GeDrawer } from './drawer.js';
import { GeDrawerClose } from './sub/drawer-close.js';
import { GeDrawerContent } from './sub/drawer-content.js';
import { GeDrawerDescription } from './sub/drawer-description.js';
import { GeDrawerFooter } from './sub/drawer-footer.js';
import { GeDrawerHeader } from './sub/drawer-header.js';
import { GeDrawerTitle } from './sub/drawer-title.js';
import { GeDrawerTrigger } from './sub/drawer-trigger.js';

defineElement('drawer', GeDrawer);
defineElement('drawer-trigger', GeDrawerTrigger);
defineElement('drawer-content', GeDrawerContent);
defineElement('drawer-header', GeDrawerHeader);
defineElement('drawer-title', GeDrawerTitle);
defineElement('drawer-description', GeDrawerDescription);
defineElement('drawer-footer', GeDrawerFooter);
defineElement('drawer-close', GeDrawerClose);
