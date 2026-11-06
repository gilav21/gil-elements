import { defineElement } from '@gilav21/elements-base';
import { GeOrgChart } from './org-chart.js';

defineElement('org-chart', GeOrgChart);
export { GeOrgChart } from './org-chart.js';
export type { OrgLayoutDirection, OrgLineType, OrgNode, OrgNodePosition } from '../shared/chart/chart.types.js';
