/** One widget. Coordinates are 1-based CSS grid lines, not zero-based indices. Any other property you add travels with it. */
export interface DashboardItem {
    id: string;
    x: number;
    y: number;
    cols: number;
    rows: number;
    /** Plain text shown when the grid has no `renderItem`. */
    content: unknown;
}

export type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

export interface Rect {
    x: number;
    y: number;
    cols: number;
    rows: number;
}

export interface ResizeStart extends Rect {
    colStep: number;
    rowStep: number;
}

export function isOverlapping(a: Rect, b: Rect): boolean {
    const x1 = Math.max(a.x, b.x);
    const y1 = Math.max(a.y, b.y);
    const x2 = Math.min(a.x + a.cols, b.x + b.cols);
    const y2 = Math.min(a.y + a.rows, b.y + b.rows);
    return x1 < x2 && y1 < y2;
}

/**
 * What is left of `loser` once `winner` has taken its cells: the largest of the (up to four) strips of `loser` outside
 * `winner`, `loser` itself when they do not overlap, or `null` when nothing is left.
 */
export function shrinkItem<T extends Rect>(winner: Rect, loser: T): T | null {
    if (!isOverlapping(winner, loser)) return loser;
    const candidates: T[] = [];
    if (loser.y < winner.y) candidates.push({ ...loser, rows: winner.y - loser.y });
    const winnerBottom = winner.y + winner.rows;
    if (loser.y + loser.rows > winnerBottom) candidates.push({ ...loser, y: winnerBottom, rows: loser.y + loser.rows - winnerBottom });
    if (loser.x < winner.x) candidates.push({ ...loser, cols: winner.x - loser.x });
    const winnerRight = winner.x + winner.cols;
    if (loser.x + loser.cols > winnerRight) candidates.push({ ...loser, x: winnerRight, cols: loser.x + loser.cols - winnerRight });
    if (candidates.length === 0) return null;
    return candidates.reduce((best, next) => (best.cols * best.rows > next.cols * next.rows ? best : next), candidates[0] as T);
}

/** Every item but `winner` (by id) shrunk away from it, or dropped when nothing is left. */
export function resolveOverlaps<T extends Rect & { id: string }>(items: readonly T[], winner: T): T[] {
    const result: T[] = [];
    for (const item of items) {
        if (item.id === winner.id) {
            result.push(item);
            continue;
        }
        const shrunk = shrinkItem(winner, item);
        if (shrunk) result.push(shrunk);
    }
    return result;
}

/** Whether two widgets share an edge: they touch along a side and overlap on the other axis. A shared corner is not adjacency. */
export function areAdjacent(a: Rect, b: Rect): boolean {
    const aX2 = a.x + a.cols;
    const aY2 = a.y + a.rows;
    const bX2 = b.x + b.cols;
    const bY2 = b.y + b.rows;
    const horizontalTouch = (aX2 === b.x || bX2 === a.x) && a.y < bY2 && aY2 > b.y;
    const verticalTouch = (aY2 === b.y || bY2 === a.y) && a.x < bX2 && aX2 > b.x;
    return horizontalTouch || verticalTouch;
}

/** Whether the widgets form one edge-connected group. */
export function isConnected(items: readonly (Rect & { id: string })[]): boolean {
    const first = items[0];
    if (!first) return false;
    const visited = new Set([first.id]);
    const queue = [first];
    for (let current = queue.shift(); current; current = queue.shift()) {
        for (const other of items) {
            if (visited.has(other.id) || !areAdjacent(current, other)) continue;
            visited.add(other.id);
            queue.push(other);
        }
    }
    return visited.size === items.length;
}

/** The bounding box of the widgets, as one rectangle. */
export function boundingBox(items: readonly Rect[]): Rect {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const item of items) {
        minX = Math.min(minX, item.x);
        minY = Math.min(minY, item.y);
        maxX = Math.max(maxX, item.x + item.cols - 1);
        maxY = Math.max(maxY, item.y + item.rows - 1);
    }
    return { x: minX, y: minY, cols: maxX - minX + 1, rows: maxY - minY + 1 };
}

const RTL_FLIP: Readonly<Record<ResizeDirection, ResizeDirection>> = { nw: 'ne', ne: 'nw', sw: 'se', se: 'sw', w: 'e', e: 'w', n: 'n', s: 's' };

/** The mirror image of a resize direction, for a right-to-left grid. */
export function flipForRtl(direction: ResizeDirection): ResizeDirection {
    return RTL_FLIP[direction];
}

/** The rectangle a grip drag produces after moving `deltaX`, `deltaY` pixels, snapped to whole cells and never below 1x1. */
export function resizeRect(direction: ResizeDirection, deltaX: number, deltaY: number, start: ResizeStart): Rect {
    const colsDiff = Math.round(deltaX / start.colStep);
    const rowsDiff = Math.round(deltaY / start.rowStep);
    const east = direction.includes('e');
    const west = direction.includes('w');
    const south = direction.includes('s');
    const north = direction.includes('n');
    let { x, y, cols, rows } = start;
    if (east) cols = Math.max(1, start.cols + colsDiff);
    if (west) {
        cols = Math.max(1, start.cols - colsDiff);
        x = start.x + (start.cols - cols);
    }
    if (south) rows = Math.max(1, start.rows + rowsDiff);
    if (north) {
        rows = Math.max(1, start.rows - rowsDiff);
        y = start.y + (start.rows - rows);
    }
    return { x, y, cols, rows };
}

/** A CSS length in pixels: `rem` against the root font size, `em` against `emBase`, `%` against `reference`; no unit means pixels. */
export function toPixels(value: string, reference: number, emBase: number, remBase: number): number {
    const amount = Number.parseFloat(value);
    if (!value || Number.isNaN(amount)) return 0;
    if (value.endsWith('rem')) return amount * remBase;
    if (value.endsWith('em')) return amount * emBase;
    if (value.endsWith('%')) return (amount / 100) * reference;
    return amount;
}

/** A bare number or numeric string is pixels; anything else is a CSS length already. */
export function asLength(value: string | number): string {
    if (typeof value === 'number') return `${value}px`;
    return Number.isFinite(Number(value)) && value.trim() !== '' ? `${value}px` : value;
}
