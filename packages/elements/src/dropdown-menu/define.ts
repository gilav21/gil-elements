import { defineElement } from '@gilav21/elements-base';
import { GeDropdownMenu } from './dropdown-menu.js';
import { GeDropdownMenuContent } from './sub/dropdown-menu-content.js';
import { GeDropdownMenuItem } from './sub/dropdown-menu-item.js';
import { GeDropdownMenuLabel } from './sub/dropdown-menu-label.js';
import { GeDropdownMenuSeparator } from './sub/dropdown-menu-separator.js';
import { GeDropdownMenuSub } from './sub/dropdown-menu-sub.js';
import { GeDropdownMenuSubContent } from './sub/dropdown-menu-sub-content.js';
import { GeDropdownMenuSubTrigger } from './sub/dropdown-menu-sub-trigger.js';
import { GeDropdownMenuTrigger } from './sub/dropdown-menu-trigger.js';

defineElement('dropdown-menu', GeDropdownMenu);
defineElement('dropdown-menu-trigger', GeDropdownMenuTrigger);
defineElement('dropdown-menu-content', GeDropdownMenuContent);
defineElement('dropdown-menu-item', GeDropdownMenuItem);
defineElement('dropdown-menu-label', GeDropdownMenuLabel);
defineElement('dropdown-menu-separator', GeDropdownMenuSeparator);
defineElement('dropdown-menu-sub', GeDropdownMenuSub);
defineElement('dropdown-menu-sub-trigger', GeDropdownMenuSubTrigger);
defineElement('dropdown-menu-sub-content', GeDropdownMenuSubContent);
export {
    GeDropdownMenu, GeDropdownMenuContent, GeDropdownMenuItem, GeDropdownMenuLabel, GeDropdownMenuSeparator,
    GeDropdownMenuSub, GeDropdownMenuSubContent, GeDropdownMenuSubTrigger, GeDropdownMenuTrigger,
};
