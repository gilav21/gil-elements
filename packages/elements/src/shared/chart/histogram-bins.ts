import { niceDomain } from './chart-scale.js';
import { extent } from './chart.utils.js';

/** One bar of a histogram: a half-open value interval and how many samples fell in it. */
export interface HistogramBin {
    /** Inclusive lower edge. */
    start: number;
    /** Upper edge. Exclusive for every bin except the last, which includes it. */
    end: number;
    count: number;
}

export interface HistogramBinOptions {
    /** How many equal-width bins to spread over the nice-rounded domain; ignored unless a finite number `>= 1`. */
    binCount?: number;
    /** Explicit ascending boundaries (`n` edges give `n - 1` bins); wins over `binCount`. */
    binEdges?: number[];
}

/** Sturges' rule: `ceil(log2(n)) + 1` bins for a sample of `n`, at least one. */
export function sturgesBinCount(sampleSize: number): number {
    if (sampleSize <= 1) return 1;
    return Math.max(1, Math.ceil(Math.log2(sampleSize)) + 1);
}

const finiteValues = (values: readonly number[]): number[] => values.filter((v) => Number.isFinite(v));

function resolveBinCount(binCount: number | undefined, sampleSize: number): number {
    if (binCount !== undefined && Number.isFinite(binCount) && binCount >= 1) return Math.floor(binCount);
    return sturgesBinCount(sampleSize);
}

function usableEdges(binEdges: number[] | undefined): number[] | undefined {
    if (!binEdges) return undefined;
    const finite = finiteValues(binEdges);
    if (finite.length < 2) return undefined;
    const sorted = [...finite].sort((a, b) => a - b);
    const highest = sorted.at(-1) ?? sorted[0]!;
    return highest > sorted[0]! ? sorted : undefined;
}

/**
 * Ascending bin boundaries for a sample: `binCount + 1` edges spread evenly over the domain `niceDomain` rounds outward
 * from the sample's extent. Empty when no finite sample is left; a zero-variance sample still gets a positive span.
 */
export function computeBinEdges(values: readonly number[], binCount?: number): number[] {
    const range = extent(values);
    if (!range) return [];
    const count = resolveBinCount(binCount, finiteValues(values).length);
    const [lo, hi] = niceDomain(range[0], range[1], count);
    const width = (hi - lo) / count;
    // The last edge is `hi` itself: `lo + count * width` can land an ulp below it and drop the maximum from the last bin.
    return Array.from({ length: count + 1 }, (...[, i]) => (i === count ? hi : lo + i * width));
}

function binIndexOf(value: number, edges: number[]): number {
    const last = edges.length - 2;
    if (value < edges[0]! || value > edges[last + 1]!) return -1;
    if (value === edges[last + 1]) return last;
    let low = 0;
    let high = last;
    while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        if (edges[mid]! <= value) low = mid;
        else high = mid - 1;
    }
    return low;
}

/**
 * Bins a raw sample into contiguous bins. `binEdges` wins when it holds two or more distinct finite edges; otherwise
 * `binCount` (or Sturges' rule) spreads equal-width bins over the nice-rounded domain. Non-finite samples and samples
 * outside the edges are dropped.
 */
export function computeBins(values: readonly number[], options: HistogramBinOptions = {}): HistogramBin[] {
    const edges = usableEdges(options.binEdges) ?? computeBinEdges(values, options.binCount);
    if (edges.length < 2) return [];
    const counts = new Array<number>(edges.length - 1).fill(0);
    for (const value of finiteValues(values)) {
        const index = binIndexOf(value, edges);
        if (index >= 0) counts[index]!++;
    }
    return counts.map((count, i) => ({ start: edges[i]!, end: edges[i + 1]!, count }));
}
