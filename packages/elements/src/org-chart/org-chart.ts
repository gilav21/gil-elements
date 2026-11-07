import { html, nothing, svg, unsafeCSS } from 'lit';
import { UiElement } from '@gilav21/elements-base';
import type { OrgLayoutDirection, OrgLineType, OrgNode, OrgNodePosition } from '../shared/chart/chart.types.js';
import { extent, getChartColor } from '../shared/chart/chart.utils.js';
import { readableForeground } from '../shared/color.js';
import css from './org-chart.css?inline';

/**
 * A hierarchy of cards joined by connectors. Give it a flat list linked by `parentId`: every node without a parent is a
 * root, laid out after the previous one, and a node whose parent leads to no root is dropped. A card is a button: it
 * takes focus, and Enter or Space activates it.
 *
 * @fires node-click - A card was activated; `detail` is `{ node, event }`, with `event` only for a real pointer click.
 * @fires node-hover - A card was entered (`detail` is the node) or left (`null`). Keyboard focus does not fire it.
 * @attr {string} layout - `vertical` (default) stacks generations top to bottom, `horizontal` runs them left to right.
 * @attr {number} node-width - Card width in px. Defaults to 180.
 * @attr {number} node-height - Card height in px. Long titles are not measured. Defaults to 80.
 * @attr {number} node-padding-x - Horizontal gap in px: between siblings when vertical, between generations when horizontal. Defaults to 40.
 * @attr {number} node-padding-y - Vertical gap in px: between generations when vertical, between siblings when horizontal. Defaults to 60.
 * @attr {boolean} hide-images - Leave out the avatar, which is otherwise the node's `image`, else its initials on its colour; the text then gets the full card width.
 * @attr {string} line-type - `curved` (default) or `straight` elbow connectors.
 * @attr {string} heading - A name put before the accessible summary.
 * @prop {OrgNode[]} data - `{ id, name, title?, description?, image?, color?, parentId? }`; a node without `color` takes its generation's palette colour.
 * @csspart base - The chart container.
 */
export class GeOrgChart extends UiElement {
    static override readonly styles = [UiElement.styles, unsafeCSS(css)];
    static override readonly properties = {
        data: { attribute: false },
        layout: {},
        nodeWidth: { type: Number, attribute: 'node-width' },
        nodeHeight: { type: Number, attribute: 'node-height' },
        nodePaddingX: { type: Number, attribute: 'node-padding-x' },
        nodePaddingY: { type: Number, attribute: 'node-padding-y' },
        hideImages: { type: Boolean, attribute: 'hide-images' },
        lineType: { attribute: 'line-type' },
        heading: {},
        hoveredId: { state: true },
    };

    declare data: OrgNode[];
    declare layout: OrgLayoutDirection;
    declare nodeWidth: number;
    declare nodeHeight: number;
    declare nodePaddingX: number;
    declare nodePaddingY: number;
    declare hideImages: boolean;
    declare lineType: OrgLineType;
    declare heading: string | undefined;
    declare hoveredId: string | null;

    constructor() {
        super();
        this.data = [];
        this.layout = 'vertical';
        this.nodeWidth = 180;
        this.nodeHeight = 80;
        this.nodePaddingX = 40;
        this.nodePaddingY = 60;
        this.hideImages = false;
        this.lineType = 'curved';
        this.hoveredId = null;
    }

    override connectedCallback(): void {
        super.connectedCallback();
        this.dataset.slot = 'org-chart-host';
    }

    /** Every parentless node's subtree, positioned and laid out end to end. */
    get trees(): OrgNodePosition[] {
        if (this.data.length === 0) return [];
        const { roots, children } = this.group(this.data);
        const vertical = this.layout === 'vertical';
        let offsetX = 0;
        let offsetY = 0;
        return roots.map((root) => {
            const tree = this.build(root, 0, children);
            this.place(tree, offsetX, offsetY);
            const reach = this.extentOf(tree);
            if (vertical) offsetX = reach.maxX + this.nodePaddingX;
            else offsetY = reach.maxY + this.nodePaddingY;
            return tree;
        });
    }

    private group(nodes: OrgNode[]) {
        const children = new Map<string, OrgNode[]>();
        for (const node of nodes) if (!children.has(node.id)) children.set(node.id, []);
        const roots: OrgNode[] = [];
        for (const node of nodes) {
            if (node.parentId === null || node.parentId === undefined) {
                roots.push(node);
            } else {
                const siblings = children.get(node.parentId) ?? [];
                siblings.push(node);
                children.set(node.parentId, siblings);
            }
        }
        return { roots, children };
    }

    private build(node: OrgNode, level: number, children: Map<string, OrgNode[]>): OrgNodePosition {
        return { node, x: 0, y: 0, width: this.nodeWidth, height: this.nodeHeight, level, children: (children.get(node.id) ?? []).map((child) => this.build(child, level + 1, children)) };
    }

    private extentOf(root: OrgNodePosition): { maxX: number; maxY: number } {
        let maxX = root.x + root.width;
        let maxY = root.y + root.height;
        for (const child of root.children) {
            const reach = this.extentOf(child);
            maxX = Math.max(maxX, reach.maxX);
            maxY = Math.max(maxY, reach.maxY);
        }
        return { maxX, maxY };
    }

    private place(root: OrgNodePosition, originX: number, originY: number): void {
        const vertical = this.layout === 'vertical';
        const gap = vertical ? this.nodePaddingX : this.nodePaddingY;
        const across = (node: OrgNodePosition): number => {
            if (node.children.length === 0) return vertical ? this.nodeWidth : this.nodeHeight;
            return node.children.reduce((sum, c) => sum + across(c), 0) + (node.children.length - 1) * gap;
        };
        const position = (node: OrgNodePosition, startX: number, startY: number): void => {
            const size = across(node);
            if (vertical) {
                node.x = startX + (size - this.nodeWidth) / 2;
                node.y = startY;
                let childX = startX;
                for (const child of node.children) {
                    position(child, childX, startY + this.nodeHeight + this.nodePaddingY);
                    childX += across(child) + this.nodePaddingX;
                }
            } else {
                node.x = startX;
                node.y = startY + (size - this.nodeHeight) / 2;
                let childY = startY;
                for (const child of node.children) {
                    position(child, startX + this.nodeWidth + this.nodePaddingX, childY);
                    childY += across(child) + this.nodePaddingY;
                }
            }
        };
        position(root, originX, originY);
    }

    private connectors(roots: OrgNodePosition[]) {
        const vertical = this.layout === 'vertical';
        const curved = this.lineType === 'curved';
        const lines: { id: string; path: string }[] = [];
        const walk = (node: OrgNodePosition): void => {
            for (const child of node.children) {
                let path: string;
                if (vertical) {
                    const startX = node.x + node.width / 2;
                    const startY = node.y + node.height;
                    const endX = child.x + child.width / 2;
                    const endY = child.y;
                    const midY = (startY + endY) / 2;
                    path = curved ? `M ${startX} ${startY} C ${startX} ${midY}, ${endX} ${midY}, ${endX} ${endY}` : `M ${startX} ${startY} L ${startX} ${midY} L ${endX} ${midY} L ${endX} ${endY}`;
                } else {
                    const startX = node.x + node.width;
                    const startY = node.y + node.height / 2;
                    const endX = child.x;
                    const endY = child.y + child.height / 2;
                    const midX = (startX + endX) / 2;
                    path = curved ? `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}` : `M ${startX} ${startY} L ${midX} ${startY} L ${midX} ${endY} L ${endX} ${endY}`;
                }
                lines.push({ id: `${node.node.id}-${child.node.id}`, path });
                walk(child);
            }
        };
        roots.forEach(walk);
        return lines;
    }

    private flatten(roots: OrgNodePosition[]): OrgNodePosition[] {
        const out: OrgNodePosition[] = [];
        const visit = (node: OrgNodePosition): void => {
            out.push(node);
            node.children.forEach(visit);
        };
        roots.forEach(visit);
        return out;
    }

    private colorOf(pos: OrgNodePosition): string {
        return pos.node.color || getChartColor(pos.level);
    }

    private static initials(name: string): string {
        return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
    }

    private label(node: OrgNode): string {
        return node.title ? `${node.name}, ${node.title}` : node.name;
    }

    private readonly onLeave = () => {
        this.hoveredId = null;
        this.dispatchEvent(new CustomEvent<null>('node-hover', { detail: null, bubbles: true, composed: true }));
    };

    private onEnter(node: OrgNode): void {
        this.hoveredId = node.id;
        this.dispatchEvent(new CustomEvent<OrgNode>('node-hover', { detail: node, bubbles: true, composed: true }));
    }

    // A button's native click covers pointer, Enter and Space alike, so the keys need no handlers of their own (they would
    // report every keyboard activation twice). A keyboard-made click has `detail === 0`, which is how it is told from a
    // pointer click.
    private onClick(event: MouseEvent, node: OrgNode): void {
        this.dispatchEvent(new CustomEvent('node-click', { detail: { node, event: event.detail > 0 ? event : undefined }, bubbles: true, composed: true }));
    }

    private avatar(pos: OrgNodePosition) {
        if (this.hideImages) return nothing;
        if (pos.node.image) return html`<img class="avatar" src=${pos.node.image} alt=${pos.node.name} />`;
        return html`<div class="avatar initials" style=${`background-color:${this.colorOf(pos)};color:${readableForeground(this.colorOf(pos))}`}>${GeOrgChart.initials(pos.node.name)}</div>`;
    }

    private card(pos: OrgNodePosition) {
        const node = pos.node;
        const hover = this.hoveredId;
        return svg`<foreignObject x=${pos.x} y=${pos.y} width=${pos.width} height=${pos.height}>
            <button type="button" class="card" data-slot="org-node" data-dim=${hover !== null && hover !== node.id ? '' : nothing} style=${`border-left-color:${this.colorOf(pos)}`} aria-label=${this.label(node)}
                @mouseenter=${() => this.onEnter(node)} @mouseleave=${this.onLeave} @click=${(event: MouseEvent) => this.onClick(event, node)}>
                <div class="head">
                    ${this.avatar(pos)}
                    <div class="text">
                        <div class="name">${node.name}</div>
                        ${node.title ? html`<div class="title">${node.title}</div>` : nothing}
                    </div>
                </div>
                ${node.description ? html`<div class="description">${node.description}</div>` : nothing}
            </button>
        </foreignObject>`;
    }

    protected override render() {
        const roots = this.trees;
        const flat = this.flatten(roots);
        const width = flat.length === 0 ? 400 : (extent(flat.map((n) => n.x + n.width))?.[1] ?? 0) + 20;
        const height = flat.length === 0 ? 300 : (extent(flat.map((n) => n.y + n.height))?.[1] ?? 0) + 20;
        const summary = `Organization chart with ${flat.length} members`;
        return html`<div part="base" class="base" data-slot="org-chart">
            <svg viewBox=${`0 0 ${width} ${height}`} width="100%" height="auto" style=${`max-width:${width}px;aspect-ratio:${width} / ${height}`} role="group" aria-label=${this.heading ? `${this.heading}: ${summary}` : summary}>
                <g>${this.connectors(roots).map((c) => svg`<path class="line" d=${c.path} fill="none" stroke="currentColor" stroke-width="2" />`)}</g>
                <g>${flat.map((pos) => this.card(pos))}</g>
            </svg>
        </div>`;
    }
}
