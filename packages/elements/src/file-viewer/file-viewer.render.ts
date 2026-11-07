// @ts-nocheck - DOCX, DOC and PPT/PPTX markup builders moved from shadcn-angular's file-viewer, which type-checks them without noUncheckedIndexedAccess.
import { cssColor, cssFontFamily, imageDataUrl, safeLinkHref } from './parsers/markup-safety.js';
import type {
    PptxTextFrame, PptxTextRun, PptxBullet,
    PptxShapeElement, PptxConnectorElement, PptxTableElement,
    PptxParagraph, PptxGradientFill, PptxPatternFill, PptxEffects,
    PptxUnderlineStyle, PptxTabStop,
} from './parsers/pptx-parser.js';

/*
 * DOCX, DOC and PPT/PPTX files are rendered by building markup from parsed document values and setting it as the
 * viewer's HTML. Every document-controlled value is made safe (`parsers/markup-safety`), for the context it lands in,
 * before it reaches the markup. The markup keeps shadcn-angular's Tailwind class names, which file-viewer.css defines.
 */

const TWIPS_PER_PT = 20;

/** A border shorthand; an unusable document colour falls back to `currentColor`. */
function cssBorder(side: string, size: number, color: string): string {
    const safeColor = cssColor(color);
    return safeColor ? `border-${side}:${size}pt solid ${safeColor}` : `border-${side}:${size}pt solid`;
}

const HEADING_CLASSES: Record<number, string> = {
    1: 'text-4xl font-bold mt-6 mb-3',
    2: 'text-3xl font-bold mt-5 mb-3',
    3: 'text-2xl font-bold mt-4 mb-2',
    4: 'text-xl font-bold mt-4 mb-2',
    5: 'text-lg font-bold mt-3 mb-2',
    6: 'text-base font-bold mt-3 mb-2',
};

function detectDocumentRtl(elements: ReadonlyArray<{ type: string }>): boolean {
    let rtlCount = 0;
    let totalCount = 0;
    for (const el of elements) {
        if (el.type === 'paragraph') {
            const para = el as { type: string; rtl?: boolean };
            totalCount++;
            if (para.rtl) rtlCount++;
        }
    }
    return totalCount > 0 && rtlCount > totalCount / 2;
}

function renderDocxToHtml(elements: ReadonlyArray<unknown>): string {
    const parts: string[] = [];
    for (const el of elements) {
        const element = el as { type: string };
        if (element.type === 'paragraph') {
            parts.push(renderDocxParagraph(el));
        } else if (element.type === 'table') {
            parts.push(renderDocxTable(el));
        } else if (element.type === 'image') {
            parts.push(renderDocxImage(el));
        }
    }
    return parts.join('\n');
}

function renderDocxParagraph(el: unknown): string {
    const para = el as {
        runs: ReadonlyArray<{
            text: string;
            href?: string;
            breakType?: string;
            isInserted?: boolean;
            isDeleted?: boolean;
            anchorId?: string;
            style: {
                bold?: boolean; italic?: boolean; underline?: boolean;
                strikethrough?: boolean; doubleStrikethrough?: boolean;
                caps?: boolean; smallCaps?: boolean;
                fontSize?: number; color?: string; fontFamily?: string;
                highlight?: string; backgroundColor?: string;
                vertAlign?: string; rtl?: boolean;
                charSpacing?: number; hidden?: boolean;
            };
        }>;
        style: string;
        listLevel?: number; listType?: string;
        rtl?: boolean; alignment?: string;
        spacingBefore?: number; spacingAfter?: number; lineSpacing?: number;
        indentLeft?: number; indentRight?: number; indentHanging?: number;
        indentFirstLine?: number;
        shading?: string;
        borders?: {
            top?: { style: string; color: string; size: number };
            bottom?: { style: string; color: string; size: number };
            left?: { style: string; color: string; size: number };
            right?: { style: string; color: string; size: number };
        };
    };

    const content = para.runs.map(run => buildRunHtml(run)).join('');
    if (!content.trim()) {
        const hasPageBreak = para.runs.some(r => r.breakType === 'page');
        if (hasPageBreak) return '<hr class="my-8 border-t-2 border-dashed border-muted-foreground/30" />';
        return '';
    }

    const attrs = buildParagraphAttrs(para);
    const tag = getParagraphTag(para);

    return `<${tag.tag} ${attrs}>${tag.prefix}${content}${tag.suffix}</${tag.tag}>`;
}

function buildRunHtml(run: {
    text: string;
    href?: string;
    breakType?: string;
    isInserted?: boolean;
    isDeleted?: boolean;
    anchorId?: string;
    style: {
        bold?: boolean; italic?: boolean; underline?: boolean;
        strikethrough?: boolean; doubleStrikethrough?: boolean;
        caps?: boolean; smallCaps?: boolean;
        fontSize?: number; color?: string; fontFamily?: string;
        highlight?: string; backgroundColor?: string;
        vertAlign?: string; rtl?: boolean;
        charSpacing?: number; hidden?: boolean;
    };
}): string {
    if (run.style.hidden) return '';
    if (run.breakType === 'page') return '<hr class="my-8 border-t-2 border-dashed border-muted-foreground/30" />';
    if (run.anchorId) return `<a id="${escapeHtml(run.anchorId)}"></a>`;

    let text = wrapRunInlineFormatting(escapeHtml(run.text), run);

    const styles = buildRunStyles(run.style);
    const dirAttr = run.style.rtl ? ' dir="rtl"' : '';
    if (styles || dirAttr) {
        text = `<span${dirAttr}${styleAttr(styles)}>${text}</span>`;
    }

    const href = run.href ? safeLinkHref(run.href) : undefined;
    if (href) {
        text = `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    }

    return text;
}

function wrapRunInlineFormatting(text: string, run: {
    isInserted?: boolean; isDeleted?: boolean;
    style: {
        bold?: boolean; italic?: boolean; underline?: boolean;
        strikethrough?: boolean; doubleStrikethrough?: boolean;
        vertAlign?: string;
    };
}): string {
    if (run.style.bold) text = `<strong>${text}</strong>`;
    if (run.style.italic) text = `<em>${text}</em>`;
    if (run.style.underline) text = `<u>${text}</u>`;
    if (run.style.strikethrough || run.style.doubleStrikethrough) text = `<s>${text}</s>`;
    if (run.style.vertAlign === 'superscript') text = `<sup>${text}</sup>`;
    if (run.style.vertAlign === 'subscript') text = `<sub>${text}</sub>`;
    if (run.isInserted) text = `<ins class="bg-green-100 dark:bg-green-900/30">${text}</ins>`;
    if (run.isDeleted) text = `<del class="bg-red-100 dark:bg-red-900/30 text-muted-foreground">${text}</del>`;
    return text;
}

function buildRunStyles(style: {
    fontSize?: number; color?: string; fontFamily?: string;
    highlight?: string; backgroundColor?: string;
    doubleStrikethrough?: boolean; caps?: boolean; smallCaps?: boolean;
    charSpacing?: number;
}): string {
    const parts: string[] = [];
    const color = cssColor(style.color);
    if (color) parts.push(`color:${color}`);
    if (style.fontSize) parts.push(`font-size:${style.fontSize}pt`);
    if (style.fontFamily) parts.push(`font-family:${cssFontFamily(style.fontFamily)},sans-serif`);
    const background = cssColor(style.highlight) ?? cssColor(style.backgroundColor);
    if (background) parts.push(`background-color:${background}`);
    if (style.doubleStrikethrough) parts.push('text-decoration-style:double');
    if (style.caps) parts.push('text-transform:uppercase');
    if (style.smallCaps) parts.push('font-variant:small-caps');
    if (style.charSpacing) parts.push(`letter-spacing:${style.charSpacing}pt`);
    return parts.join(';');
}

function buildParagraphAttrs(para: {
    rtl?: boolean; alignment?: string;
    spacingBefore?: number; spacingAfter?: number; lineSpacing?: number;
    indentLeft?: number; indentRight?: number; indentHanging?: number;
    indentFirstLine?: number; listLevel?: number;
    shading?: string;
    borders?: {
        top?: { style: string; color: string; size: number };
        bottom?: { style: string; color: string; size: number };
        left?: { style: string; color: string; size: number };
        right?: { style: string; color: string; size: number };
    };
}): string {
    const attrs: string[] = [];
    if (para.rtl) attrs.push('dir="rtl"');

    const styles = buildParagraphStyles(para);
    if (styles) attrs.push(styleAttr(styles).trimStart());

    return attrs.join(' ');
}

function buildParagraphStyles(para: {
    alignment?: string; spacingBefore?: number; spacingAfter?: number;
    lineSpacing?: number; indentLeft?: number; indentRight?: number;
    indentHanging?: number; indentFirstLine?: number; listLevel?: number;
    shading?: string;
    borders?: {
        top?: { style: string; color: string; size: number };
        bottom?: { style: string; color: string; size: number };
        left?: { style: string; color: string; size: number };
        right?: { style: string; color: string; size: number };
    };
}): string {
    const parts: string[] = [];
    if (para.alignment) parts.push(`text-align:${mapDocxAlignment(para.alignment)}`);
    if (para.spacingBefore) parts.push(`margin-top:${para.spacingBefore}pt`);
    if (para.spacingAfter) parts.push(`margin-bottom:${para.spacingAfter}pt`);
    if (para.lineSpacing && para.lineSpacing > 0) parts.push(`line-height:${para.lineSpacing}`);
    if (para.indentLeft) parts.push(`margin-left:${para.indentLeft}pt`);
    if (para.indentRight) parts.push(`margin-right:${para.indentRight}pt`);
    if (para.indentHanging) parts.push(`text-indent:-${para.indentHanging}pt`);
    if (para.indentFirstLine) parts.push(`text-indent:${para.indentFirstLine}pt`);
    if (para.listLevel !== undefined) parts.push(`margin-left:${(para.listLevel) * 24}px`);
    const shading = cssColor(para.shading);
    if (shading) parts.push(`background-color:${shading};padding:4px 8px`);
    if (para.borders) {
        appendBorderStyles(parts, para.borders);
    }
    return parts.join(';');
}

function appendBorderStyles(parts: string[], borders: {
    top?: { style: string; color: string; size: number };
    bottom?: { style: string; color: string; size: number };
    left?: { style: string; color: string; size: number };
    right?: { style: string; color: string; size: number };
}): void {
    if (borders.top) parts.push(cssBorder('top', borders.top.size, borders.top.color));
    if (borders.bottom) parts.push(cssBorder('bottom', borders.bottom.size, borders.bottom.color));
    if (borders.left) parts.push(cssBorder('left', borders.left.size, borders.left.color));
    if (borders.right) parts.push(cssBorder('right', borders.right.size, borders.right.color));
    if (borders.top || borders.bottom || borders.left || borders.right) {
        parts.push('padding:4px 8px');
    }
}

function getParagraphTag(para: {
    style: string; listType?: string; listLevel?: number;
}): { tag: string; prefix: string; suffix: string } {
    const headingMatch = /Heading(\d)/.exec(para.style);
    if (headingMatch) {
        const level = Number.parseInt(headingMatch[1], 10);
        if (level >= 1 && level <= 6) {
            const cls = HEADING_CLASSES[level] ?? 'font-bold mt-4 mb-2';
            return { tag: `h${level} class="${cls}"`, prefix: '', suffix: '' };
        }
    }
    if (para.listType) {
        return { tag: 'li', prefix: '', suffix: '' };
    }
    return { tag: 'p class="mb-3 leading-relaxed"', prefix: '', suffix: '' };
}

function mapDocxAlignment(alignment: string): string {
    switch (alignment) {
        case 'right': return 'right';
        case 'center': return 'center';
        case 'justify': return 'justify';
        default: return 'left';
    }
}

function renderDocxTable(el: unknown): string {
    const table = el as {
        rows: ReadonlyArray<{
            cells: ReadonlyArray<{
                elements: ReadonlyArray<{ type: string }>;
                colSpan: number;
                rowSpan: number;
                cellStyle?: {
                    backgroundColor?: string; verticalAlign?: string;
                    width?: number; widthUnit?: string;
                    borders?: {
                        top?: { size: number; color: string };
                        bottom?: { size: number; color: string };
                        left?: { size: number; color: string };
                        right?: { size: number; color: string };
                    };
                    paddings?: {
                        top?: number; bottom?: number; left?: number; right?: number;
                    };
                };
            }>;
            rowStyle?: { height?: number; isHeader?: boolean };
        }>;
        tableStyle?: {
            width?: number; widthUnit?: string;
        };
    };

    const tableWidth = buildTableWidth(table.tableStyle);
    let html = `<table class="w-full border-collapse my-4 text-sm"${tableWidth}>`;

    let inThead = false;
    for (const row of table.rows) {
        const isHeader = row.rowStyle?.isHeader ?? false;
        if (isHeader && !inThead) { html += '<thead>'; inThead = true; }
        if (!isHeader && inThead) { html += '</thead><tbody>'; inThead = false; }

        const rowHeight = row.rowStyle?.height ? ` style="height:${row.rowStyle.height}pt"` : '';
        html += `<tr${rowHeight}>`;
        for (const cell of row.cells) {
            if (cell.rowSpan === 0) continue;
            html += renderDocxTableCell(cell, isHeader);
        }
        html += '</tr>';
    }

    if (inThead) html += '</thead>';
    html += '</table>';
    return html;
}

function buildTableWidth(tableStyle?: { width?: number; widthUnit?: string }): string {
    if (!tableStyle?.width) return '';
    if (tableStyle.widthUnit === 'pct') return ` style="width:${tableStyle.width / 50}%"`;
    return ` style="width:${tableStyle.width / TWIPS_PER_PT}pt"`;
}

function renderDocxTableCell(cell: {
    elements: ReadonlyArray<{ type: string }>;
    colSpan: number;
    rowSpan: number;
    cellStyle?: {
        backgroundColor?: string; verticalAlign?: string;
        width?: number; widthUnit?: string;
        borders?: {
            top?: { size: number; color: string };
            bottom?: { size: number; color: string };
            left?: { size: number; color: string };
            right?: { size: number; color: string };
        };
        paddings?: {
            top?: number; bottom?: number; left?: number; right?: number;
        };
    };
}, isHeader: boolean): string {
    const tag = isHeader ? 'th' : 'td';
    const content = renderDocxCellContent(cell.elements);
    const colspan = cell.colSpan > 1 ? ` colspan="${cell.colSpan}"` : '';
    const rowspan = cell.rowSpan > 1 ? ` rowspan="${cell.rowSpan}"` : '';
    const cellStyles = buildCellStyles(cell.cellStyle);

    return `<${tag} class="border border-border px-2 py-1"${colspan}${rowspan}${cellStyles}>${content}</${tag}>`;
}

function renderDocxCellContent(elements: ReadonlyArray<{ type: string }>): string {
    const parts: string[] = [];
    for (const el of elements) {
        if (el.type === 'paragraph') {
            const paraHtml = renderDocxParagraph(el);
            if (paraHtml) parts.push(paraHtml);
        } else if (el.type === 'table') {
            parts.push(renderDocxTable(el));
        }
    }
    return parts.join('');
}

function buildCellStyles(cellStyle?: {
    backgroundColor?: string; verticalAlign?: string;
    width?: number; widthUnit?: string;
    borders?: {
        top?: { size: number; color: string };
        bottom?: { size: number; color: string };
        left?: { size: number; color: string };
        right?: { size: number; color: string };
    };
    paddings?: {
        top?: number; bottom?: number; left?: number; right?: number;
    };
}): string {
    if (!cellStyle) return '';
    const parts: string[] = [];
    const background = cssColor(cellStyle.backgroundColor);
    if (background) parts.push(`background-color:${background}`);
    if (cellStyle.verticalAlign) parts.push(`vertical-align:${mapVerticalAlign(cellStyle.verticalAlign)}`);
    appendCellWidth(cellStyle, parts);
    appendCellBorders(cellStyle.borders, parts);
    appendCellPaddings(cellStyle.paddings, parts);
    return styleAttr(parts.join(';'));
}

function appendCellWidth(cellStyle: { width?: number; widthUnit?: string }, parts: string[]): void {
    if (!cellStyle.width) return;
    if (cellStyle.widthUnit === 'pct') {
        parts.push(`width:${cellStyle.width / 50}%`);
    } else {
        parts.push(`width:${cellStyle.width / TWIPS_PER_PT}pt`);
    }
}

function appendCellBorders(borders: {
    top?: { size: number; color: string }; bottom?: { size: number; color: string };
    left?: { size: number; color: string }; right?: { size: number; color: string };
} | undefined, parts: string[]): void {
    if (!borders) return;
    if (borders.top) parts.push(cssBorder('top', borders.top.size, borders.top.color));
    if (borders.bottom) parts.push(cssBorder('bottom', borders.bottom.size, borders.bottom.color));
    if (borders.left) parts.push(cssBorder('left', borders.left.size, borders.left.color));
    if (borders.right) parts.push(cssBorder('right', borders.right.size, borders.right.color));
}

function appendCellPaddings(paddings: {
    top?: number; bottom?: number; left?: number; right?: number;
} | undefined, parts: string[]): void {
    if (!paddings) return;
    if (paddings.top) parts.push(`padding-top:${paddings.top}pt`);
    if (paddings.bottom) parts.push(`padding-bottom:${paddings.bottom}pt`);
    if (paddings.left) parts.push(`padding-left:${paddings.left}pt`);
    if (paddings.right) parts.push(`padding-right:${paddings.right}pt`);
}

function mapVerticalAlign(val: string): string {
    if (val === 'middle') return 'middle';
    if (val === 'bottom') return 'bottom';
    return 'top';
}

function renderDocxImage(el: unknown): string {
    const img = el as { dataUrl: string; width: number; height: number; altText: string };
    const src = imageDataUrl(img.dataUrl);
    if (!src) return '';
    return `<img src="${src}" width="${img.width}" height="${img.height}" alt="${escapeHtml(img.altText)}" class="my-2 max-w-full" />`;
}

function renderDocxFootnotes(
    footnotes: ReadonlyArray<{ id: string; paragraphs: ReadonlyArray<unknown> }>,
    endnotes: ReadonlyArray<{ id: string; paragraphs: ReadonlyArray<unknown> }>,
): string {
    const allNotes = [...footnotes, ...endnotes];
    if (allNotes.length === 0) return '';

    let html = '<hr class="my-6 border-t border-border" />';
    html += '<section class="text-xs text-muted-foreground space-y-1">';
    for (const note of allNotes) {
        const content = note.paragraphs.map(p => renderDocxParagraph(p)).join('');
        html += `<div><sup>${escapeHtml(note.id)}</sup> ${content}</div>`;
    }
    html += '</section>';
    return html;
}

function renderDocxComments(
    comments: ReadonlyArray<{ id: string; author: string; date: string; paragraphs: ReadonlyArray<unknown> }>,
): string {
    if (comments.length === 0) return '';

    let html = '<hr class="my-6 border-t border-border" />';
    html += '<section class="text-xs text-muted-foreground space-y-2">';
    html += '<h4 class="font-semibold text-sm text-foreground">Comments</h4>';
    for (const comment of comments) {
        const content = comment.paragraphs.map(p => renderDocxParagraph(p)).join('');
        const authorHtml = comment.author ? `<strong>${escapeHtml(comment.author)}</strong>` : '';
        html += `<div class="border-l-2 border-muted pl-2"><sup>*${escapeHtml(comment.id)}</sup> ${authorHtml} ${content}</div>`;
    }
    html += '</section>';
    return html;
}

function renderDocxHeadersFooters(
    sections: ReadonlyArray<ReadonlyArray<unknown>>,
    type: 'header' | 'footer',
): string {
    if (sections.length === 0) return '';

    const first = sections[0];
    if (!first || first.length === 0) return '';

    const borderClass = type === 'header' ? 'border-b mb-4 pb-2' : 'border-t mt-4 pt-2';
    let html = `<section class="text-xs text-muted-foreground ${borderClass} border-border">`;
    html += renderDocxToHtml(first);
    html += '</section>';
    return html;
}

function renderSlideToHtml(slide: {
    elements: ReadonlyArray<{ type: string; x: number; y: number; width: number; height: number }>;
    backgroundColor?: string;
    backgroundImage?: string;
}): string {
    const bgStyles = ['position:relative', 'width:100%', 'height:100%'];
    bgStyles.push(`background-color:${cssColor(slide.backgroundColor) ?? '#fff'}`);
    const backgroundImage = imageDataUrl(slide.backgroundImage);
    if (backgroundImage) {
        bgStyles.push(`background-image:url(${backgroundImage})`, 'background-size:cover', 'background-position:center');
    }
    let html = `<div${styleAttr(bgStyles.join(';'))}>`;
    for (const el of slide.elements) {
        html += renderSlideElement(el);
    }
    html += '</div>';
    return html;
}

function renderSlideElement(el: { type: string; x: number; y: number; width: number; height: number }): string {
    if (el.type === 'text') {
        return renderSlideTextFrame(el as unknown as PptxTextFrame);
    }
    if (el.type === 'image') {
        const img = el as unknown as { dataUrl: string; x: number; y: number; width: number; height: number };
        const src = imageDataUrl(img.dataUrl);
        if (!src) return '';
        return `<img src="${src}" style="position:absolute;left:${img.x}px;top:${img.y}px;width:${img.width}px;height:${img.height}px;object-fit:contain;z-index:2" />`;
    }
    if (el.type === 'table') {
        return renderSlideTable(el as unknown as PptxTableElement);
    }
    if (el.type === 'shape') {
        return renderSlideShape(el as unknown as PptxShapeElement);
    }
    if (el.type === 'connector') {
        return renderSlideConnector(el as unknown as PptxConnectorElement);
    }
    return '';
}

function renderSlideTextFrame(tf: PptxTextFrame): string {
    let content = '';
    let autoNumCounter = 0;
    for (const para of tf.paragraphs) {
        if (para.bullet?.type === 'autoNum') {
            autoNumCounter++;
        } else {
            autoNumCounter = 0;
        }
        content += renderSlideParagraph(para, autoNumCounter);
    }
    const styles = buildTextFrameStyles(tf);
    if (tf.fontScale && tf.fontScale < 1) {
        const invScale = Math.round(100 / tf.fontScale);
        const innerStyle = `transform:scale(${tf.fontScale});transform-origin:top left;width:${invScale}%`;
        return `<div${styleAttr(styles.join(';'))}><div style="${innerStyle}">${content}</div></div>`;
    }
    return `<div${styleAttr(styles.join(';'))}>${content}</div>`;
}

function renderSlideParagraph(para: PptxParagraph, autoNumCounter: number): string {
    let content = '';
    if (para.bullet && para.bullet.type !== 'none') {
        content += renderBulletPrefix(para.bullet, autoNumCounter);
    }
    for (const run of para.runs) {
        // Handle tab characters in run text
        if (run.text.includes('\t')) {
            const tabRendered = renderTabContent(run.text, para.tabs, para.defaultTabSize);
            const runWithReplacedText = { ...run, text: '' };
            const runHtml = renderSlideRun(runWithReplacedText);
            // Insert tab-rendered content into the span
            content += runHtml.replace('></span>', `>${tabRendered}</span>`).replace(/^$/, tabRendered);
        } else {
            content += renderSlideRun(run);
        }
    }
    if (!content) content = '<br/>';
    const styles = buildSlideParagraphStyles(para);
    const dirAttr = para.rtl ? ' dir="rtl"' : '';
    return `<div${styleAttr(styles.join(';'))}${dirAttr}>${content}</div>`;
}

function renderSlideRun(run: PptxTextRun): string {
    let text = wrapSlideRunFormatting(escapeHtml(run.text), run);

    const styles: string[] = [];
    if (run.fontSize) styles.push(`font-size:${run.fontSize}pt`);
    if (run.fontFamily) styles.push(`font-family:${cssFontFamily(run.fontFamily)},sans-serif`);

    applyRunFillStyles(run, styles);
    applyRunDecorationStyles(run, styles);
    applyRunTextEffects(run, styles);
    applySlideRunUnderline(run, styles);
    applySlideRunHyperlinkDefaults(run, styles);

    if (run.isHyperlink && !run.underline && !run.underlineStyle) {
        text = `<u>${text}</u>`;
    }

    const attrs: string[] = [];
    if (styles.length > 0) attrs.push(styleAttr(styles.join(';')).trimStart());
    if (run.hoverTooltip) attrs.push(`title="${escapeHtml(run.hoverTooltip)}"`);

    if (attrs.length > 0) text = `<span ${attrs.join(' ')}>${text}</span>`;
    return text;
}

function wrapSlideRunFormatting(text: string, run: PptxTextRun): string {
    if (run.bold) text = `<strong>${text}</strong>`;
    if (run.italic) text = `<em>${text}</em>`;
    if (run.strikethrough) text = `<s>${text}</s>`;
    if (run.baseline && run.baseline > 0) text = `<sup>${text}</sup>`;
    if (run.baseline && run.baseline < 0) text = `<sub>${text}</sub>`;
    if (run.underline && !run.underlineStyle) text = `<u>${text}</u>`;
    return text;
}

function applySlideRunUnderline(run: PptxTextRun, styles: string[]): void {
    if (run.underlineStyle) {
        styles.push(...buildUnderlineCss(run.underlineStyle));
    }
}

function applySlideRunHyperlinkDefaults(run: PptxTextRun, styles: string[]): void {
    if (run.isHyperlink && !run.color && !run.gradientFill && !run.noFill) {
        styles.push('color:#0563C1');
    }
}

function applyRunFillStyles(run: PptxTextRun, styles: string[]): void {
    if (run.noFill) {
        styles.push('color:transparent');
        return;
    }
    if (run.gradientFill) {
        styles.push(`background:${buildGradientCss(run.gradientFill)}`, '-webkit-background-clip:text', 'background-clip:text', 'color:transparent');
        return;
    }
    const imageFill = imageDataUrl(run.imageFill);
    if (imageFill) {
        styles.push(`background-image:url(${imageFill})`, 'background-size:cover', '-webkit-background-clip:text', 'background-clip:text', 'color:transparent');
        return;
    }
    if (run.patternFill) {
        styles.push(buildPatternCss(run.patternFill), '-webkit-background-clip:text', 'background-clip:text', 'color:transparent');
        return;
    }
    const color = cssColor(run.color);
    if (color) styles.push(`color:${color}`);
}

function applyRunDecorationStyles(run: PptxTextRun, styles: string[]): void {
    if (run.cap === 'all') styles.push('text-transform:uppercase');
    if (run.cap === 'small') styles.push('font-variant:small-caps');
    if (run.spc != null) styles.push(`letter-spacing:${run.spc}pt`);
    const highlight = cssColor(run.highlight);
    if (highlight) styles.push(`background-color:${highlight}`);
}

function applyRunTextEffects(run: PptxTextRun, styles: string[]): void {
    if (run.textOutline) {
        styles.push(`-webkit-text-stroke-width:${run.textOutline.width}pt`);
        const outlineColor = cssColor(run.textOutline.color);
        if (outlineColor) styles.push(`-webkit-text-stroke-color:${outlineColor}`);
        styles.push('paint-order:stroke fill');
    }
    if (run.effects) styles.push(...buildEffectsCss(run.effects, 'text'));
}

function renderBulletPrefix(bullet: PptxBullet, autoNumCounter: number): string {
    // Image bullet
    const bulletImage = imageDataUrl(bullet.imageDataUrl);
    if (bulletImage) {
        return `<img src="${bulletImage}" style="height:1em;vertical-align:middle;margin-right:0.25em;display:inline-block" />`;
    }

    let text = '';
    if (bullet.type === 'char') {
        text = bullet.char ?? '•';
    } else if (bullet.type === 'autoNum') {
        const startAt = bullet.startAt ?? 1;
        text = formatAutoNumber(bullet.autoNumScheme ?? 'arabicPeriod', autoNumCounter, startAt);
    }

    const styles: string[] = ['display:inline-block', 'min-width:1.5em', 'margin-right:0.25em'];
    const color = cssColor(bullet.color);
    if (color) styles.push(`color:${color}`);
    if (bullet.fontFamily) styles.push(`font-family:${cssFontFamily(bullet.fontFamily)},sans-serif`);
    if (bullet.sizePoints) styles.push(`font-size:${bullet.sizePoints}pt`);

    return `<span${styleAttr(styles.join(';'))}>${escapeHtml(text)}</span>`;
}

function formatAutoNumber(scheme: string, counter: number, startAt: number): string {
    const n = counter - 1 + startAt;
    switch (scheme) {
        case 'arabicPeriod': return `${n}.`;
        case 'arabicParenR': return `${n})`;
        case 'romanUcPeriod': return `${toRoman(n)}.`;
        case 'romanLcPeriod': return `${toRoman(n).toLowerCase()}.`;
        case 'alphaUcPeriod': return `${toAlpha(n)}.`;
        case 'alphaLcPeriod': return `${toAlpha(n).toLowerCase()}.`;
        default: return `${n}.`;
    }
}

function toRoman(n: number): string {
    const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
    const syms = ['M', 'CM', 'D', 'CD', 'C', 'XC', 'L', 'XL', 'X', 'IX', 'V', 'IV', 'I'];
    let result = '';
    let remaining = n;
    for (let i = 0; i < vals.length; i++) {
        while (remaining >= vals[i]) {
            result += syms[i];
            remaining -= vals[i];
        }
    }
    return result;
}

function toAlpha(n: number): string {
    if (n <= 0) return '';
    let result = '';
    let remaining = n;
    while (remaining > 0) {
        remaining--;
        result = String.fromCodePoint(65 + (remaining % 26)) + result;
        remaining = Math.floor(remaining / 26);
    }
    return result;
}

function buildTextFrameStyles(tf: {
    readonly x: number; readonly y: number; readonly width: number; readonly height: number;
    readonly fillColor?: string; readonly borderColor?: string;
    readonly borderWidth?: number; readonly rotation?: number;
}): string[] {
    const styles = [
        'position:absolute',
        `left:${tf.x}px`, `top:${tf.y}px`,
        `width:${tf.width}px`,
        'padding:4px', 'box-sizing:border-box',
        'z-index:4',
    ];
    const fillColor = cssColor(tf.fillColor);
    if (fillColor) styles.push(`background-color:${fillColor}`);
    const borderColor = cssColor(tf.borderColor);
    if (borderColor) styles.push(`border:${tf.borderWidth ?? 1}px solid ${borderColor}`);
    if (tf.rotation) styles.push(`transform:rotate(${tf.rotation}deg)`);
    return styles;
}

function buildSlideParagraphStyles(para: PptxParagraph): string[] {
    const styles: string[] = ['margin:0'];
    if (para.alignment) styles.push(`text-align:${mapSlideAlignment(para.alignment)}`);
    if (para.spacingBefore) styles.push(`margin-top:${para.spacingBefore}pt`);
    if (para.spacingAfter) styles.push(`margin-bottom:${para.spacingAfter}pt`);
    if (para.lineSpacing) styles.push(`line-height:${para.lineSpacing}`);
    if (para.marginLeft) styles.push(`margin-left:${para.marginLeft}px`);
    if (para.indent) styles.push(`text-indent:${para.indent}px`);
    if (para.level) styles.push(`padding-left:${para.level * 24}px`);
    if (para.fontAlign) {
        const vaMap: Record<string, string> = { auto: 'baseline', t: 'top', ctr: 'middle', base: 'baseline', b: 'bottom' };
        styles.push(`vertical-align:${vaMap[para.fontAlign] ?? 'baseline'}`);
    }
    return styles;
}

function renderSlideShape(shape: PptxShapeElement): string {
    const styles: string[] = [
        'position:absolute',
        `left:${shape.x}px`, `top:${shape.y}px`,
        `width:${shape.width}px`, `height:${shape.height}px`,
        'z-index:1',
    ];

    applyShapeFillStyles(shape, styles);

    const borderColor = cssColor(shape.borderColor);
    if (borderColor) {
        const borderStyle = mapDashStyleToCss(shape.dashStyle);
        styles.push(`border:${shape.borderWidth ?? 1}px ${borderStyle} ${borderColor}`);
    }
    if (shape.rotation) styles.push(`transform:rotate(${shape.rotation}deg)`);

    const borderRadius = getShapeBorderRadius(shape.shapeType);
    if (borderRadius) styles.push(`border-radius:${borderRadius}`);

    const clipPath = getShapeClipPath(shape.shapeType);
    if (clipPath) styles.push(`clip-path:${clipPath}`);

    if (shape.effects) styles.push(...buildEffectsCss(shape.effects, 'shape'));

    return `<div${styleAttr(styles.join(';'))}></div>`;
}

function applyShapeFillStyles(shape: PptxShapeElement, styles: string[]): void {
    const imageFill = imageDataUrl(shape.imageFill);
    const fillColor = cssColor(shape.fillColor);
    if (shape.gradientFill) {
        styles.push(`background:${buildGradientCss(shape.gradientFill)}`);
    } else if (imageFill) {
        styles.push(`background-image:url(${imageFill})`, 'background-size:cover');
    } else if (shape.patternFill) {
        styles.push(buildPatternCss(shape.patternFill));
    } else if (fillColor) {
        styles.push(`background-color:${fillColor}`);
    }
}

function getShapeBorderRadius(shapeType: string): string {
    switch (shapeType) {
        case 'roundRect': return '8px';
        case 'ellipse': return '50%';
        default: return '';
    }
}

function getShapeClipPath(shapeType: string): string {
    switch (shapeType) {
        case 'rightArrow':
        case 'notchedRightArrow':
            return 'polygon(0 20%, 70% 20%, 70% 0, 100% 50%, 70% 100%, 70% 80%, 0 80%)';
        case 'leftArrow':
            return 'polygon(30% 0, 30% 20%, 100% 20%, 100% 80%, 30% 80%, 30% 100%, 0 50%)';
        case 'upArrow':
            return 'polygon(50% 0, 100% 30%, 80% 30%, 80% 100%, 20% 100%, 20% 30%, 0 30%)';
        case 'downArrow':
            return 'polygon(20% 0, 80% 0, 80% 70%, 100% 70%, 50% 100%, 0 70%, 20% 70%)';
        case 'leftRightArrow':
            return 'polygon(0 50%, 15% 20%, 15% 35%, 85% 35%, 85% 20%, 100% 50%, 85% 80%, 85% 65%, 15% 65%, 15% 80%)';
        case 'upDownArrow':
            return 'polygon(50% 0, 80% 15%, 65% 15%, 65% 85%, 80% 85%, 50% 100%, 20% 85%, 35% 85%, 35% 15%, 20% 15%)';
        case 'chevron':
            return 'polygon(0 0, 80% 0, 100% 50%, 80% 100%, 0 100%, 20% 50%)';
        case 'homePlate':
            return 'polygon(0 0, 85% 0, 100% 50%, 85% 100%, 0 100%)';
        default:
            return '';
    }
}

function mapDashStyleToCss(dashStyle?: string): string {
    if (!dashStyle) return 'solid';
    switch (dashStyle) {
        case 'dot':
        case 'sysDot': return 'dotted';
        case 'dash':
        case 'sysDash':
        case 'lgDash':
        case 'dashDot':
        case 'lgDashDot':
        case 'sysDashDot':
        case 'lgDashDotDot':
        case 'sysDashDotDot': return 'dashed';
        default: return 'solid';
    }
}

function renderSlideConnector(conn: PptxConnectorElement): string {
    const color = cssColor(conn.color) ?? '#000';
    const lw = conn.lineWidth ?? 1;
    const pad = lw + 2;
    const w = Math.max(conn.width, 0);
    const h = Math.max(conn.height, 0);
    const svgW = w + pad * 2;
    const svgH = h + pad * 2;

    const dashAttr = getConnectorDashAttr(conn.dashStyle);
    const markerDefs = getConnectorMarkerDefs(conn, color);
    const markerAttrs = getConnectorMarkerAttrs(conn);

    const pathD = buildConnectorPath(conn.connectorType, w, h, conn.flipH, conn.flipV, pad);

    const rotateStyle = conn.rotation ? `transform:rotate(${conn.rotation}deg);transform-origin:center;` : '';
    return `<svg style="position:absolute;left:${conn.x - pad}px;top:${conn.y - pad}px;width:${svgW}px;height:${svgH}px;${rotateStyle}pointer-events:none;z-index:1">${markerDefs}<path d="${pathD}" stroke="${color}" stroke-width="${lw}" fill="none"${dashAttr}${markerAttrs}/></svg>`;
}

function flipPoint(x: number, y: number, w: number, h: number, fH?: boolean, fV?: boolean): [number, number] {
    return [fH ? w - x : x, fV ? h - y : y];
}

function buildConnectorPath(
    connType: string | undefined, w: number, h: number, flipH?: boolean, flipV?: boolean, pad = 0,
): string {
    if (connType?.startsWith('bentConnector')) {
        return buildBentConnectorPath(connType, w, h, flipH, flipV, pad);
    }
    if (connType?.startsWith('curvedConnector')) {
        return buildCurvedConnectorPath(w, h, flipH, flipV, pad);
    }
    // Straight line: start at (0,0), end at (w,h) in logical space, then flip + offset by pad
    const [x1, y1] = flipPoint(0, 0, w, h, flipH, flipV);
    const [x2, y2] = flipPoint(w, h, w, h, flipH, flipV);
    return `M${x1 + pad},${y1 + pad} L${x2 + pad},${y2 + pad}`;
}

function buildBentConnectorPath(
    connType: string, w: number, h: number, flipH?: boolean, flipV?: boolean, pad = 0,
): string {
    const midX = w / 2;
    const fp = (x: number, y: number): [number, number] => {
        const [fx, fy] = flipPoint(x, y, w, h, flipH, flipV);
        return [fx + pad, fy + pad];
    };

    if (connType === 'bentConnector2') {
        const [x0, y0] = fp(0, 0);
        const [x1, y1] = fp(w, 0);
        const [x2, y2] = fp(w, h);
        return `M${x0},${y0} L${x1},${y1} L${x2},${y2}`;
    }

    // bentConnector3+: Z-shape horizontal-first
    const [x0, y0] = fp(0, 0);
    const [x1, y1] = fp(midX, 0);
    const [x2, y2] = fp(midX, h);
    const [x3, y3] = fp(w, h);
    return `M${x0},${y0} L${x1},${y1} L${x2},${y2} L${x3},${y3}`;
}

function buildCurvedConnectorPath(
    w: number, h: number, flipH?: boolean, flipV?: boolean, pad = 0,
): string {
    const fp = (x: number, y: number): [number, number] => {
        const [fx, fy] = flipPoint(x, y, w, h, flipH, flipV);
        return [fx + pad, fy + pad];
    };
    const [x0, y0] = fp(0, 0);
    const [cx1, cy1] = fp(w / 2, 0);
    const [cx2, cy2] = fp(w / 2, h);
    const [x1, y1] = fp(w, h);
    return `M${x0},${y0} C${cx1},${cy1} ${cx2},${cy2} ${x1},${y1}`;
}

function getConnectorDashAttr(dashStyle?: string): string {
    if (!dashStyle) return '';
    switch (dashStyle) {
        case 'dot':
        case 'sysDot': return ' stroke-dasharray="2,4"';
        case 'dash':
        case 'sysDash': return ' stroke-dasharray="8,4"';
        case 'lgDash': return ' stroke-dasharray="12,4"';
        case 'dashDot':
        case 'sysDashDot': return ' stroke-dasharray="8,4,2,4"';
        case 'lgDashDot': return ' stroke-dasharray="12,4,2,4"';
        case 'lgDashDotDot':
        case 'sysDashDotDot': return ' stroke-dasharray="12,4,2,4,2,4"';
        default: return '';
    }
}

function getConnectorMarkerDefs(conn: PptxConnectorElement, color: string): string {
    if (!conn.headEnd && !conn.tailEnd) return '';
    let defs = '<defs>';
    if (conn.tailEnd) {
        defs += `<marker id="arrow-end" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto"><polygon points="0 0, 10 3.5, 0 7" fill="${color}"/></marker>`;
    }
    if (conn.headEnd) {
        defs += `<marker id="arrow-start" markerWidth="10" markerHeight="7" refX="0" refY="3.5" orient="auto"><polygon points="10 0, 0 3.5, 10 7" fill="${color}"/></marker>`;
    }
    defs += '</defs>';
    return defs;
}

function getConnectorMarkerAttrs(conn: PptxConnectorElement): string {
    let attrs = '';
    if (conn.tailEnd) attrs += ' marker-end="url(#arrow-end)"';
    if (conn.headEnd) attrs += ' marker-start="url(#arrow-start)"';
    return attrs;
}

function renderSlideTable(table: PptxTableElement): string {
    let html = `<div style="position:absolute;left:${table.x}px;top:${table.y}px;width:${table.width}px;height:${table.height}px;overflow:hidden;z-index:3">`;
    html += '<table style="width:100%;border-collapse:collapse;font-size:12px;">';

    if (table.columnWidths) {
        html += '<colgroup>';
        for (const w of table.columnWidths) {
            html += `<col style="width:${w}px">`;
        }
        html += '</colgroup>';
    }

    for (const row of table.rows) {
        html += '<tr>';
        for (const cell of row) {
            const text = escapeHtml(cell.text);
            const content = cell.bold ? `<strong>${text}</strong>` : text;
            const cellStyles: string[] = ['border:1px solid #ccc', 'padding:2px 4px'];
            const fillColor = cssColor(cell.fillColor);
            if (fillColor) cellStyles.push(`background:${fillColor}`);
            const color = cssColor(cell.color);
            if (color) cellStyles.push(`color:${color}`);
            html += `<td${styleAttr(cellStyles.join(';'))}>${content}</td>`;
        }
        html += '</tr>';
    }
    html += '</table></div>';
    return html;
}

function buildGradientCss(grad: PptxGradientFill): string {
    const stopStr = grad.stops.map(s => `${cssColor(s.color) ?? 'transparent'} ${s.position}%`).join(', ');
    if (grad.type === 'linear') {
        return `linear-gradient(${grad.angle ?? 0}deg, ${stopStr})`;
    }
    return `radial-gradient(ellipse at center, ${stopStr})`;
}

function buildPatternCss(pat: PptxPatternFill): string {
    const fg = cssColor(pat.fgColor) ?? '#000000';
    const bg = cssColor(pat.bgColor) ?? '#FFFFFF';
    const preset = pat.preset;

    if (preset.startsWith('pct')) {
        const pct = Number.parseInt(preset.replace('pct', ''), 10);
        const size = Math.max(4, Math.round(20 - pct / 6));
        return `background-color:${bg};background-image:radial-gradient(circle, ${fg} 1px, transparent 1px);background-size:${size}px ${size}px`;
    }

    return buildPatternCssForPreset(preset, fg, bg);
}

function resolvePatternGradient(preset: string): { angle: number; width: number } | null {
    const thin: Record<string, number> = {
        horz: 0, ltHorz: 0, narHorz: 0,
        vert: 90, ltVert: 90, narVert: 90,
        dnDiag: 45, ltDnDiag: 45,
        upDiag: 135, ltUpDiag: 135,
    };
    const thick: Record<string, number> = {
        dkHorz: 0,
        dkVert: 90,
        dkDnDiag: 45,
        dkUpDiag: 135,
    };
    if (preset in thin) return { angle: thin[preset], width: 1 };
    if (preset in thick) return { angle: thick[preset], width: 2 };
    return null;
}

function buildPatternCssForPreset(preset: string, fg: string, bg: string): string {
    const single = resolvePatternGradient(preset);
    if (single) {
        const { angle, width } = single;
        const gap = width === 1 ? 8 : 6;
        return `background-color:${bg};background-image:repeating-linear-gradient(${angle}deg,${fg},${fg} ${width}px,transparent ${width}px,transparent ${gap}px)`;
    }
    if (preset === 'cross' || preset === 'smGrid' || preset === 'lgGrid') {
        return `background-color:${bg};background-image:repeating-linear-gradient(0deg,${fg},${fg} 1px,transparent 1px,transparent 8px),repeating-linear-gradient(90deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
    }
    if (preset === 'diagCross') {
        return `background-color:${bg};background-image:repeating-linear-gradient(45deg,${fg},${fg} 1px,transparent 1px,transparent 8px),repeating-linear-gradient(135deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
    }
    return `background-color:${bg};background-image:repeating-linear-gradient(45deg,${fg},${fg} 1px,transparent 1px,transparent 8px)`;
}

function buildEffectsCss(effects: PptxEffects, context: 'text' | 'shape'): string[] {
    const result: string[] = [];
    const filters: string[] = [];

    if (effects.outerShadow) {
        const s = effects.outerShadow;
        const color = cssColor(s.color) ?? 'transparent';
        if (context === 'text') {
            result.push(`text-shadow:${s.offsetX}px ${s.offsetY}px ${s.blur}px ${color}`);
        } else {
            result.push(`box-shadow:${s.offsetX}px ${s.offsetY}px ${s.blur}px ${color}`);
        }
    }

    if (effects.innerShadow && context === 'shape') {
        const s = effects.innerShadow;
        result.push(`box-shadow:inset ${s.offsetX}px ${s.offsetY}px ${s.blur}px ${cssColor(s.color) ?? 'transparent'}`);
    }

    if (effects.glow) {
        const color = cssColor(effects.glow.color) ?? 'transparent';
        if (context === 'text') {
            filters.push(`drop-shadow(0 0 ${effects.glow.radius}px ${color})`);
        } else {
            result.push(`box-shadow:0 0 ${effects.glow.radius}px ${color}`);
        }
    }

    if (effects.blur) filters.push(`blur(${effects.blur}px)`);
    if (effects.softEdge) {
        result.push(`mask-image:radial-gradient(ellipse, black ${Math.max(0, 100 - effects.softEdge)}%, transparent 100%)`);
    }
    if (effects.reflection) {
        const r = effects.reflection;
        result.push(`-webkit-box-reflect:below ${r.distance}px linear-gradient(transparent, rgba(0,0,0,${r.startOpacity}))`);
    }
    if (filters.length > 0) result.push(`filter:${filters.join(' ')}`);

    return result;
}

function buildUnderlineCss(uStyle: PptxUnderlineStyle): string[] {
    const result: string[] = ['text-decoration-line:underline'];
    const color = cssColor(uStyle.color);
    if (color) result.push(`text-decoration-color:${color}`);
    if (uStyle.width) result.push(`text-decoration-thickness:${uStyle.width}pt`);

    if (uStyle.compound === 'dbl' || uStyle.compound === 'tri') {
        result.push('text-decoration-style:double');
    } else if (uStyle.dashStyle) {
        result.push(`text-decoration-style:${mapDashToDecorationStyle(uStyle.dashStyle)}`);
    }

    return result;
}

function mapDashToDecorationStyle(dashStyle: string): string {
    switch (dashStyle) {
        case 'dot':
        case 'sysDot': return 'dotted';
        case 'dash':
        case 'sysDash':
        case 'lgDash':
        case 'dashDot':
        case 'lgDashDot':
        case 'sysDashDot': return 'dashed';
        default: return 'solid';
    }
}

function renderTabContent(text: string, tabs?: ReadonlyArray<PptxTabStop>, defaultTabSize?: number): string {
    if (!text.includes('\t')) return escapeHtml(text);

    const parts = text.split('\t');
    let result = escapeHtml(parts[0]);

    for (let i = 1; i < parts.length; i++) {
        if (tabs && tabs.length >= i) {
            const tab = tabs[i - 1];
            const alignMap: Record<string, string> = { r: 'right', ctr: 'center' };
            const align = alignMap[tab.alignment ?? ''] ?? 'left';
            result += `<span style="display:inline-block;min-width:${tab.position}px;text-align:${align}"></span>`;
        } else {
            const tabWidth = defaultTabSize ?? 48;
            result += `<span style="display:inline-block;width:${tabWidth}px"></span>`;
        }
        result += escapeHtml(parts[i]);
    }

    return result;
}

function mapSlideAlignment(alignment: string): string {
    switch (alignment) {
        case 'ctr': return 'center';
        case 'r': return 'right';
        case 'just': return 'justify';
        default: return 'left';
    }
}

/** Escapes text for element content or for a double-quoted attribute value — the only attribute quoting this file emits. */
function escapeHtml(str: string): string {
    return str
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

/**
 * ` style="…"` for a declaration list, attribute-escaped so no value inside it can
 * end the attribute; `''` when there are no declarations.
 */
function styleAttr(css: string): string {
    return css ? ` style="${escapeHtml(css)}"` : '';
}

export { detectDocumentRtl, renderDocxToHtml, renderDocxHeadersFooters, renderDocxFootnotes, renderDocxComments, renderSlideToHtml };
