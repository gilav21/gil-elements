import { defineElement } from '@gilav21/elements-base';
import { GeNavigationMenu } from './navigation-menu.js';
import { GeNavigationMenuContent } from './sub/navigation-menu-content.js';
import { GeNavigationMenuIndicator } from './sub/navigation-menu-indicator.js';
import { GeNavigationMenuItem } from './sub/navigation-menu-item.js';
import { GeNavigationMenuLink } from './sub/navigation-menu-link.js';
import { GeNavigationMenuList } from './sub/navigation-menu-list.js';
import { GeNavigationMenuTrigger } from './sub/navigation-menu-trigger.js';

defineElement('navigation-menu', GeNavigationMenu);
defineElement('navigation-menu-list', GeNavigationMenuList);
defineElement('navigation-menu-item', GeNavigationMenuItem);
defineElement('navigation-menu-trigger', GeNavigationMenuTrigger);
defineElement('navigation-menu-content', GeNavigationMenuContent);
defineElement('navigation-menu-link', GeNavigationMenuLink);
defineElement('navigation-menu-indicator', GeNavigationMenuIndicator);
