import { defineElement } from '@gilav21/elements-base';
import { GeSheet } from './sheet.js';
import { GeSheetClose } from './sub/sheet-close.js';
import { GeSheetContent } from './sub/sheet-content.js';
import { GeSheetDescription } from './sub/sheet-description.js';
import { GeSheetFooter } from './sub/sheet-footer.js';
import { GeSheetHeader } from './sub/sheet-header.js';
import { GeSheetTitle } from './sub/sheet-title.js';
import { GeSheetTrigger } from './sub/sheet-trigger.js';

defineElement('sheet', GeSheet);
defineElement('sheet-trigger', GeSheetTrigger);
defineElement('sheet-content', GeSheetContent);
defineElement('sheet-header', GeSheetHeader);
defineElement('sheet-title', GeSheetTitle);
defineElement('sheet-description', GeSheetDescription);
defineElement('sheet-footer', GeSheetFooter);
defineElement('sheet-close', GeSheetClose);
export { GeSheet, GeSheetClose, GeSheetContent, GeSheetDescription, GeSheetFooter, GeSheetHeader, GeSheetTitle, GeSheetTrigger };
