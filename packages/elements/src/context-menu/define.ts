import { defineElement } from '@gilav21/elements-base';
import { GeContextMenu } from './context-menu.js';
import { GeContextMenuContent } from './sub/context-menu-content.js';
import { GeContextMenuItem } from './sub/context-menu-item.js';
import { GeContextMenuLabel } from './sub/context-menu-label.js';
import { GeContextMenuSeparator } from './sub/context-menu-separator.js';
import { GeContextMenuShortcut } from './sub/context-menu-shortcut.js';
import { GeContextMenuSub } from './sub/context-menu-sub.js';
import { GeContextMenuSubContent } from './sub/context-menu-sub-content.js';
import { GeContextMenuSubTrigger } from './sub/context-menu-sub-trigger.js';
import { GeContextMenuTrigger } from './sub/context-menu-trigger.js';

defineElement('context-menu', GeContextMenu);
defineElement('context-menu-trigger', GeContextMenuTrigger);
defineElement('context-menu-content', GeContextMenuContent);
defineElement('context-menu-item', GeContextMenuItem);
defineElement('context-menu-label', GeContextMenuLabel);
defineElement('context-menu-separator', GeContextMenuSeparator);
defineElement('context-menu-shortcut', GeContextMenuShortcut);
defineElement('context-menu-sub', GeContextMenuSub);
defineElement('context-menu-sub-trigger', GeContextMenuSubTrigger);
defineElement('context-menu-sub-content', GeContextMenuSubContent);
export {
    GeContextMenu, GeContextMenuContent, GeContextMenuItem, GeContextMenuLabel, GeContextMenuSeparator, GeContextMenuShortcut,
    GeContextMenuSub, GeContextMenuSubContent, GeContextMenuSubTrigger, GeContextMenuTrigger,
};
