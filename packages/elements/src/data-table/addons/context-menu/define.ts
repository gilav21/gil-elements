/** Defines `ge-context-menu` and registers the addon, so `addons="context-menu"` works on any table (one already on the page included). */
import '../../../context-menu/define.js';
import { registerDataTableAddon } from '../../data-table-addon-registry.js';
import { contextMenuAddon } from './context-menu.js';

registerDataTableAddon(contextMenuAddon);

export * from './index.js';
