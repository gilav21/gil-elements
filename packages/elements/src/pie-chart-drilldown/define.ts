import { defineElement } from '@gilav21/elements-base';
import { GePieChartDrilldown } from './pie-chart-drilldown.js';

defineElement('pie-chart-drilldown', GePieChartDrilldown);
export { GePieChartDrilldown } from './pie-chart-drilldown.js';
export type { ChartClickEvent, DrilldownDataPoint, DrilldownEvent, DrilldownSeries } from '../shared/chart/chart.types.js';
