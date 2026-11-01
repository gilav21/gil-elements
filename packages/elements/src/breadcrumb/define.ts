import { defineElement } from '@gilav21/elements-base';
import '../skeleton/define.js';
import { GeBreadcrumb } from './breadcrumb.js';
import { GeBreadcrumbEllipsis } from './sub/breadcrumb-ellipsis.js';
import { GeBreadcrumbItem } from './sub/breadcrumb-item.js';
import { GeBreadcrumbLink } from './sub/breadcrumb-link.js';
import { GeBreadcrumbList } from './sub/breadcrumb-list.js';
import { GeBreadcrumbPage } from './sub/breadcrumb-page.js';
import { GeBreadcrumbSeparator } from './sub/breadcrumb-separator.js';

defineElement('breadcrumb', GeBreadcrumb);
defineElement('breadcrumb-list', GeBreadcrumbList);
defineElement('breadcrumb-item', GeBreadcrumbItem);
defineElement('breadcrumb-link', GeBreadcrumbLink);
defineElement('breadcrumb-page', GeBreadcrumbPage);
defineElement('breadcrumb-separator', GeBreadcrumbSeparator);
defineElement('breadcrumb-ellipsis', GeBreadcrumbEllipsis);
export { GeBreadcrumb, GeBreadcrumbEllipsis, GeBreadcrumbItem, GeBreadcrumbLink, GeBreadcrumbList, GeBreadcrumbPage, GeBreadcrumbSeparator };
