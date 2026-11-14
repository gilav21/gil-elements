/** Registers the pivot addon, so `addons="pivot"` on a `ge-data-table` turns it on. Imports no element. */
import { registerDataTableAddon } from '../../data-table-addon-registry.js';
import { pivotAddon } from './pivot.js';

registerDataTableAddon(pivotAddon);
