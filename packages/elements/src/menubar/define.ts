import { defineElement } from '@gilav21/elements-base';
import { GeMenubar } from './menubar.js';
import { GeMenubarContent } from './sub/menubar-content.js';
import { GeMenubarItem } from './sub/menubar-item.js';
import { GeMenubarMenu } from './sub/menubar-menu.js';
import { GeMenubarSeparator } from './sub/menubar-separator.js';
import { GeMenubarShortcut } from './sub/menubar-shortcut.js';
import { GeMenubarSub } from './sub/menubar-sub.js';
import { GeMenubarSubContent } from './sub/menubar-sub-content.js';
import { GeMenubarSubTrigger } from './sub/menubar-sub-trigger.js';
import { GeMenubarTrigger } from './sub/menubar-trigger.js';

defineElement('menubar', GeMenubar);
defineElement('menubar-menu', GeMenubarMenu);
defineElement('menubar-trigger', GeMenubarTrigger);
defineElement('menubar-content', GeMenubarContent);
defineElement('menubar-item', GeMenubarItem);
defineElement('menubar-separator', GeMenubarSeparator);
defineElement('menubar-shortcut', GeMenubarShortcut);
defineElement('menubar-sub', GeMenubarSub);
defineElement('menubar-sub-trigger', GeMenubarSubTrigger);
defineElement('menubar-sub-content', GeMenubarSubContent);
export {
    GeMenubar, GeMenubarContent, GeMenubarItem, GeMenubarMenu, GeMenubarSeparator, GeMenubarShortcut,
    GeMenubarSub, GeMenubarSubContent, GeMenubarSubTrigger, GeMenubarTrigger,
};
