import { defineElement } from '@gilav21/elements-base';
import { GeBarChartDrilldown } from './bar-chart-drilldown.js';

defineElement('bar-chart-drilldown', GeBarChartDrilldown);
export { GeBarChartDrilldown } from './bar-chart-drilldown.js';
export type { ChartClickEvent, DrilldownDataPoint, DrilldownEvent, DrilldownSeries } from '../shared/chart/chart.types.js';
