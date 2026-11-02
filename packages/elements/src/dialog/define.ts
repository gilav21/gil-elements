import { defineElement } from '@gilav21/elements-base';
import { GeDialog } from './dialog.js';
import { GeDialogContent } from './sub/dialog-content.js';
import { GeDialogDescription } from './sub/dialog-description.js';
import { GeDialogFooter } from './sub/dialog-footer.js';
import { GeDialogHeader } from './sub/dialog-header.js';
import { GeDialogTitle } from './sub/dialog-title.js';
import { GeDialogTrigger } from './sub/dialog-trigger.js';

defineElement('dialog', GeDialog);
defineElement('dialog-trigger', GeDialogTrigger);
defineElement('dialog-content', GeDialogContent);
defineElement('dialog-header', GeDialogHeader);
defineElement('dialog-title', GeDialogTitle);
defineElement('dialog-description', GeDialogDescription);
defineElement('dialog-footer', GeDialogFooter);
export { GeDialog, GeDialogContent, GeDialogDescription, GeDialogFooter, GeDialogHeader, GeDialogTitle, GeDialogTrigger };
