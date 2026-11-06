import { defineElement } from '@gilav21/elements-base';
import '../chart-tooltip/define.js';
import { GeHistogram } from './histogram.js';

defineElement('histogram', GeHistogram);
export { GeHistogram } from './histogram.js';
export { computeBins, computeBinEdges, sturgesBinCount } from '../shared/chart/histogram-bins.js';
export type { ChartClickEvent } from '../shared/chart/chart.types.js';
export type { HistogramBin, HistogramBinOptions } from '../shared/chart/histogram-bins.js';
