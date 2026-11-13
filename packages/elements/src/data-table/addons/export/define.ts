/** Registers the export addon, so `addons="export"` on a `ge-data-table` turns it on. Imports no element. */
import { registerDataTableAddon } from '../../data-table-addon-registry.js';
import { exportAddon } from './export.js';

registerDataTableAddon(exportAddon);
