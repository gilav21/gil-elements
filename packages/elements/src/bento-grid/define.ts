import { defineElement } from '@gilav21/elements-base';
import '../context-menu/define.js';
import { GeBentoGrid } from './bento-grid.js';
import { GeBentoGridItem } from './sub/bento-grid-item.js';

defineElement('bento-grid', GeBentoGrid);
defineElement('bento-grid-item', GeBentoGridItem);
