import { describe, expect, it } from 'vitest';
import type { GeRichTextEditor } from './rich-text-editor.js';
import { blockEditor, editableOf, load } from './rich-text-editor.fixture.test.js';

/**
 * Properties of the block commands over generated documents: a seeded generator builds documents from the
 * whole tag set the sanitizer keeps, including the hostile shapes paste and import deliver, so a failure
 * reproduces from its seed and document. Words are compared as words (glued text shows), markup is judged
 * on an attached element by structure, saves are compared with their input, and a second command follows
 * the first, where half of the original defects surfaced.
 */

function mulberry32(seed: number): () => number {
    let state = seed;
    return () => {
        state = (state + 0x6d2b79f5) | 0;
        let t = Math.imul(state ^ (state >>> 15), 1 | state);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const SEED = 20260913;
const GENERATED_DOCUMENTS = 160;
const GROUP_SIZE = 20;
const IMAGE = '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" alt="pic">';
const WORDS = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'];

class DocumentGenerator {
    private words = 0;

    constructor(private readonly random: () => number) {}

    document(): string {
        return this.repeat(1, 3, () => this.block(0)).join('');
    }

    private pick<T>(options: readonly T[]): T {
        return options[Math.floor(this.random() * options.length)] as T;
    }

    private repeat(min: number, max: number, make: () => string): string[] {
        const count = min + Math.floor(this.random() * (max - min + 1));
        return Array.from({ length: count }, make);
    }

    /** Distinct words, so a moved or duplicated word is visible as such. */
    private word(): string {
        this.words++;
        return `${this.pick(WORDS)}${this.words}`;
    }

    private inline(depth: number): string {
        const leaf = (): string => this.word();
        if (depth >= 2) return leaf();
        return this.pick<() => string>([
            leaf, leaf, leaf,
            () => `<b>${this.inlineRun(depth + 1)}</b>`,
            () => `<i>${this.inlineRun(depth + 1)}</i>`,
            () => `<a href="https://example.com/">${this.word()}</a>`,
            () => `<code>${this.word()}</code>`,
            () => `<span>${this.inlineRun(depth + 1)}</span>`,
            () => IMAGE,
            () => `<strong>${this.inlineRun(depth + 1)}</strong>`,
            () => `<em>${this.inlineRun(depth + 1)}</em>`,
            () => this.wrapped(this.pick(['u', 's', 'del', 'ins', 'mark', 'sub', 'sup', 'small']), this.word()),
            () => `${this.word()}<br>${this.word()}`,
            () => `${this.word()}<em>${this.word()}</em>${this.word()}`,
            () => this.syntaxText(),
        ])();
    }

    private wrapped(tag: string, inner: string): string {
        return `<${tag}>${inner}</${tag}>`;
    }

    /** Text a markdown reader could take for syntax, each beside a distinct word so a save that makes it structure shows. */
    private syntaxText(): string {
        const w = this.word();
        return this.pick<() => string>([
            () => `2024. ${w}`,
            () => `2024.`,
            () => `- ${w}`,
            () => '-',
            () => `+ ${w}`,
            () => `&gt;50% ${w}`,
            () => `--- ${w}`,
            () => '---',
            () => `~~${w}~~`,
            () => '~~~',
            () => `:::details ${w}`,
            () => `[${w}](https://example.com/)`,
            () => `# ${w}`,
            () => `2 * 3 * 4 ${w}`,
            () => `a\\*b ${w}`,
            () => `| ${w} |`,
            () => '```',
            () => `[x] ${w}`,
            () => `&amp;copy ${w}`,
            () => `~<span>~</span>~ ${w}`,
        ])();
    }

    private inlineRun(depth: number): string {
        return this.repeat(1, 3, () => this.inline(depth)).join(' ');
    }

    private block(depth: number): string {
        const plain = [
            () => `<p>${this.inlineRun(0)}</p>`,
            () => `<p>${this.inlineRun(0)}</p>`,
            () => `<h2>${this.inlineRun(0)}</h2>`,
            () => '<hr>',
            () => `<pre><code>${this.word()}\n\n${this.word()}</code></pre>`,
            () => this.table(),
        ];
        if (depth >= 2) return this.pick(plain)();
        return this.pick([
            ...plain,
            () => this.list('ul', depth),
            () => this.list('ol', depth),
            () => this.taskList(depth),
            () => this.taskList(depth),
            () => `<blockquote>${this.repeat(1, 3, () => this.block(depth + 1)).join('')}</blockquote>`,
            () => `<details><summary>${this.inlineRun(0)}</summary>${this.block(depth + 1)}</details>`,
            () => `<blockquote><p>${this.word()}</p><hr><p>${this.word()}</p></blockquote>`,
            () => `<blockquote><li>${this.word()}</li></blockquote>`,
            () => `<div><p>${this.word()}</p>${this.word()}<hr>${this.word()}</div>`,
            () => `<div><p>${this.word()}</p><span><p>${this.word()}</p></span></div>`,
            () => `<h2>${this.word()}<div>${this.word()}</div></h2>`,
            () => `<blockquote><pre><code>${this.word()}\n\n${this.word()}</code></pre></blockquote>`,
            () => this.heading(),
            () => '<h2><br></h2>',
            () => `<p>${this.syntaxText()}</p>`,
            () => this.fullTable(),
            () => `<ol start="${this.pick(['0', '5', '999999999', '-2'])}">${this.repeat(1, 3, () => this.item(depth)).join('')}</ol>`,
            () => `<details><summary><br></summary>${this.block(depth + 1)}</details>`,
            () => `<details>${this.block(depth + 1)}</details>`,
            () => `<details><details><summary>${this.word()}</summary><p>${this.word()}</p></details><summary>${this.word()}</summary></details>`,
            () => `<summary><p>${this.word()}</p></summary>`,
            () => `<p>${this.word()}<table><tbody><tr><td>${this.word()}</td></tr></tbody></table></p>`,
            () => `<blockquote><table><tbody><tr><td>${this.word()}</td><td>${this.word()}</td></tr></tbody></table><p>${this.word()} | ${this.word()}</p></blockquote>`,
            () => `<ul><li>${this.word()}</li><li data-task data-checked="false"><input type="checkbox"><span>${this.word()}</span></li></ul>`,
            () => `<ol><li data-task data-checked="true"><input type="checkbox"><span>${this.word()}</span></li><li>${this.word()}</li></ol>`,
        ])();
    }

    private heading(): string {
        const level = this.pick(['1', '2', '3', '4', '5', '6']);
        return `<h${level}>${this.inlineRun(0)}</h${level}>`;
    }

    private fullTable(): string {
        const row = (cell: string): string => `<tr><${cell}>${this.word()}</${cell}><${cell}>${this.word()}</${cell}></tr>`;
        return `<table><thead>${row('th')}</thead><tbody>${row('td')}</tbody><tfoot>${row('td')}</tfoot></table>`;
    }

    private item(depth: number): string {
        return this.pick([
            () => `<li>${this.inlineRun(0)}</li>`,
            () => `<li>${this.inlineRun(0)}</li>`,
            () => `<li>${this.inlineRun(0)}${depth < 2 ? this.list('ul', depth + 1) : ''}</li>`,
            () => `<li>${this.inlineRun(0)}${depth < 2 ? this.list('ol', depth + 1) : ''}<p>${this.word()}</p></li>`,
            () => `<li><p>${this.word()}</p>${depth < 2 ? this.list('ul', depth + 1) : ''}${this.block(depth + 1)}</li>`,
            () => `<li><p>${this.word()}</p><p>${this.word()}</p></li>`,
            () => `<li>${this.block(depth + 1)}</li>`,
            () => `<li>${this.word()}<hr>${this.word()}</li>`,
            () => `<li><details><summary>${this.word()}</summary><p>${this.word()}</p><h2>${this.word()}</h2><blockquote><p>${this.word()}</p></blockquote></details></li>`,
            () => `<li><p>${this.word()}</p><p>${this.word()}</p><table><tbody><tr><td>${this.word()}</td></tr></tbody></table></li>`,
            () => `<li>${this.syntaxText()}</li>`,
        ])();
    }

    private list(tag: 'ul' | 'ol', depth: number): string {
        return `<${tag}>${this.repeat(1, 3, () => this.item(depth)).join('')}</${tag}>`;
    }

    private row(depth: number): string {
        const checked = this.random() < 0.5 ? 'true' : 'false';
        const open = `<li data-task data-checked="${checked}"><input type="checkbox">`;
        return this.pick([
            () => `${open}<span>${this.inlineRun(0)}</span></li>`,
            () => `${open}<span>${this.inlineRun(0)}</span></li>`,
            () => `${open}<span>${this.inlineRun(0)}</span>${depth < 2 ? this.taskList(depth + 1) : ''}</li>`,
            () => `${open}<span>${this.word()}</span>${depth < 2 ? this.taskList(depth + 1) : ''}<p>${this.word()}</p></li>`,
            () => `${open}<span>${IMAGE}</span></li>`,
            () => `${open}<p>${this.word()}</p><p>${this.word()}</p></li>`,
            () => `${open}<span>${this.word()}<p>${this.word()}</p></span></li>`,
            () => `${open}<blockquote><p>${this.word()}</p><p>${this.word()}</p></blockquote></li>`,
            () => `${open}<table><tbody><tr><td>${this.word()}</td><td>${this.word()}</td></tr></tbody></table></li>`,
            () => `${open}<span>${this.syntaxText()}</span></li>`,
        ])();
    }

    private taskList(depth: number): string {
        return `<ul data-task-list>${this.repeat(1, 3, () => this.row(depth)).join('')}</ul>`;
    }

    private cell(): string {
        return this.pick([
            () => `<td>${this.inlineRun(0)}</td>`,
            () => `<td>${this.inlineRun(0)}</td>`,
            () => `<td><p>${this.word()}</p><p>${this.word()}</p></td>`,
            () => `<td>${this.word()}<hr>${this.word()}</td>`,
        ])();
    }

    private table(): string {
        const rows = this.repeat(1, 2, () => `<tr>${this.cell()}${this.cell()}</tr>`).join('');
        return `<table><tbody>${rows}</tbody></table>`;
    }
}

/** Named shapes stay first: a failure on one of these reads without a seed. */
const NAMED: ReadonlyArray<readonly [string, string]> = [
    ['a paragraph', '<p>one</p>'],
    ['two paragraphs', '<p>one</p><p>two</p>'],
    ['a heading', '<h2>title</h2>'],
    ['plain items', '<ul><li>one</li><li>two</li></ul>'],
    ['a numbered list', '<ol><li>one</li><li>two</li></ol>'],
    ['an item with a sub-list', '<ul><li>parent<ul><li>child</li></ul></li></ul>'],
    ['task rows', '<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>first</span></li>'
        + '<li data-task data-checked="true"><input type="checkbox"><span>second</span></li></ul>'],
    ['a task row with a sub-list', '<ul data-task-list><li data-task data-checked="false"><input type="checkbox">'
        + '<span>parent</span><ul data-task-list><li data-task data-checked="false"><input type="checkbox">'
        + '<span>child</span></li></ul></li></ul>'],
    ['a quote', '<blockquote><p>quoted</p></blockquote>'],
    ['a quote holding a list', '<blockquote><ul><li>item</li></ul></blockquote>'],
    ['a code block', '<pre><code>x = 1</code></pre>'],
    ['a table', '<table><tbody><tr><td>a</td><td>b</td></tr></tbody></table>'],
    ['a cell with two lines', '<table><tbody><tr><td><p>a</p><p>b</p></td></tr></tbody></table>'],
    ['a details block', '<details><summary>head</summary><p>body</p></details>'],
    ['a line with an image', `<p>before${IMAGE}</p>`],
    ['a row with an image', `<ul data-task-list><li data-task data-checked="false"><input type="checkbox"><span>${IMAGE}</span></li></ul>`],
    ['inline formatting', '<p>read <b>the</b> <i>docs</i></p>'],
    ['a link', '<p>see <a href="https://example.com/">docs</a> now</p>'],
    ['a rule between lines', '<p>above</p><hr><p>below</p>'],
    ['an empty line', '<p><br></p>'],
];

const DOCUMENTS: ReadonlyArray<readonly [string, string]> = (() => {
    const generator = new DocumentGenerator(mulberry32(SEED));
    const generated = Array.from({ length: GENERATED_DOCUMENTS }, (...[, i]) => [`generated #${i}`, generator.document()] as const);
    return [...NAMED, ...generated];
})();

// ------------------------------------------------------------------- measures

/** Elements the HTML parser keeps inside a paragraph. */
const PHRASING = new Set([
    'A', 'ABBR', 'B', 'BDI', 'BDO', 'BR', 'CITE', 'CODE', 'DATA', 'DEL', 'DFN', 'EM', 'I', 'IMG', 'INPUT',
    'INS', 'KBD', 'MARK', 'Q', 'S', 'SAMP', 'SMALL', 'SPAN', 'STRONG', 'SUB', 'SUP', 'TIME', 'U', 'VAR', 'WBR',
]);
const TEXT_AND_BLOCK_HOSTS = new Set(['LI', 'TD', 'TH', 'BLOCKQUOTE', 'DIV', 'SUMMARY', 'DETAILS']);

function isPhrasingNode(node: Node): boolean {
    if (node.nodeType !== Node.ELEMENT_NODE) return true;
    return PHRASING.has(node.nodeName) && Array.from(node.childNodes).every(isPhrasingNode);
}

/** A reproducible, attached container: selectors and layout behave as in the editor. */
function attached(html: string): HTMLElement {
    const host = document.createElement('div');
    host.innerHTML = html;
    host.dataset['propertyHost'] = '';
    document.body.append(host);
    return host;
}

/** A browser shows a details block's summary first wherever it sits. */
function childrenInReadingOrder(node: Node): Node[] {
    const children = Array.from(node.childNodes);
    if (node.nodeName !== 'DETAILS') return children;
    const summary = children.find((child) => child.nodeName === 'SUMMARY');
    return summary ? [summary, ...children.filter((child) => child !== summary)] : children;
}

/** The words a subtree shows, in order; every block element and `<br>` is a word boundary. */
function wordsOf(root: Node): string[] {
    const parts: string[] = [];
    const walk = (node: Node): void => {
        if (node.nodeType === Node.TEXT_NODE) {
            parts.push((node as Text).data);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const boundary = !PHRASING.has(node.nodeName) || node.nodeName === 'BR';
        if (boundary) parts.push(' ');
        for (const child of childrenInReadingOrder(node)) walk(child);
        if (boundary) parts.push(' ');
    };
    walk(root);
    return parts.join('').replaceAll(/[ ​]/g, ' ').split(/\s+/).filter(Boolean);
}

const countOf = (root: ParentNode, selector: string): number => root.querySelectorAll(selector).length;

/** Paragraphs with text directly in a quote; a save that merged two of them lowers it. */
const quoteParagraphs = (root: ParentNode): number =>
    Array.from(root.querySelectorAll('blockquote > p')).filter((p) => (p.textContent ?? '').trim() !== '').length;

/** Rules inside a cell have no markdown form: a save turns each into a line boundary. */
const rulesWithoutMarkdownForm = (root: ParentNode): number => countOf(root, 'td hr, th hr');

function firstDifference(expected: string, actual: string): string {
    let at = 0;
    while (at < expected.length && expected[at] === actual[at]) at++;
    const from = Math.max(0, at - 50);
    return `at ${at}: expected …${expected.slice(from, at + 70)}… got …${actual.slice(from, at + 70)}…`;
}

const isTaskRow = (el: Element | null): boolean => el?.nodeName === 'LI' && (el as HTMLElement).dataset['task'] !== undefined;
const isTaskList = (el: Element | null): boolean => el?.nodeName === 'UL' && (el as HTMLElement).dataset['taskList'] !== undefined;
const isListTag = (el: Element): boolean => el.nodeName === 'UL' || el.nodeName === 'OL';

function isBlankText(node: Node): boolean {
    return node.nodeType === Node.TEXT_NODE && (node.textContent ?? '').replaceAll('​', '').trim() === '';
}

/** A list item of a different kind from its list: a save writes an item by its list's kind. */
function kindProblem(el: Element): string | null {
    const list = el.parentElement;
    if (el.nodeName !== 'LI' || !list || !isListTag(list)) return null;
    return isTaskRow(el) === isTaskList(list) ? null : 'a list item whose kind differs from its list';
}

function placementProblem(el: Element): string | null {
    const parentTag = el.parentElement?.nodeName ?? '';
    if (el.nodeName === 'LI' && parentTag !== 'UL' && parentTag !== 'OL') return 'an item outside a list';
    if ((el.nodeName === 'TD' || el.nodeName === 'TH') && parentTag !== 'TR') return 'a cell outside a row';
    if (isListTag(el) && Array.from(el.children).some((child) => child.nodeName !== 'LI')) return 'a list holding something other than items';
    return null;
}

/** A line element holding a block: a paragraph, a heading, or a task row's text. */
function lineProblem(el: Element): string | null {
    const tag = el.nodeName;
    const children = Array.from(el.childNodes);
    if (/^(P|H[1-6])$/.test(tag) && !children.every(isPhrasingNode)) return `a ${tag.toLowerCase()} holding a block`;
    if (tag === 'SPAN' && isTaskRow(el.parentElement) && !children.every(isPhrasingNode)) return "a block inside a task row's text";
    if (isTaskRow(el) && children.some((node) => !['INPUT', 'SPAN', 'UL', 'OL'].includes(node.nodeName) && !isBlankText(node))) {
        return 'a task row holding something beside its text';
    }
    return null;
}

/** A container holding a line of text and a block side by side, so the text belongs to no line. */
function mixedProblem(el: Element): string | null {
    const tag = el.nodeName;
    if (!TEXT_AND_BLOCK_HOSTS.has(tag) || isTaskRow(el)) return null;
    const children = Array.from(el.childNodes);
    const holdsText = children.some((node) => node.nodeType === Node.TEXT_NODE
        ? !isBlankText(node)
        : PHRASING.has(node.nodeName) && node.nodeName !== 'BR' && node.nodeName !== 'INPUT');
    const holdsBlock = children.some((node) => node.nodeType === Node.ELEMENT_NODE && !isPhrasingNode(node)
        && node.nodeName !== 'SUMMARY' && !(tag === 'LI' && isListTag(node as Element)));
    return holdsText && holdsBlock ? `a ${tag.toLowerCase()} holding both a line of text and a block` : null;
}

/** Every rule of the line model the markup breaks, named. */
function invalidMarkup(root: HTMLElement): string {
    const problems = new Set<string>();
    for (const el of Array.from(root.querySelectorAll('*'))) {
        for (const problem of [placementProblem(el), kindProblem(el), lineProblem(el), mixedProblem(el)]) {
            if (problem) problems.add(problem);
        }
    }
    return [...problems].join('; ');
}

/** The document's structure with nothing a reader cannot see: tags, task markers and words. */
function shape(root: Node): string {
    const walk = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = (node as Text).data.replaceAll(/[ ​]/g, ' ').replaceAll(/\s+/g, ' ').trim();
            return text ? JSON.stringify(text) : '';
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        const el = node as HTMLElement;
        const marks = ['task', 'checked', 'taskList'].filter((key) => el.dataset[key] !== undefined)
            .map((key) => `${key}=${el.dataset[key]}`).join(',');
        const inner = Array.from(el.childNodes).map(walk).filter(Boolean).join(' ');
        return `${el.nodeName}${marks ? `[${marks}]` : ''}(${inner})`;
    };
    return Array.from(root.childNodes).map(walk).filter(Boolean).join(' ');
}

// ------------------------------------------------------------------- commands

const BLOCK_COMMANDS = ['heading1', 'blockquote', 'codeBlock', 'bulletList', 'orderedList', 'taskList', 'horizontalRule'] as const;
const COMMANDS = ['paragraph', ...BLOCK_COMMANDS] as const;
type Command = typeof COMMANDS[number];

interface Scenario {
    readonly name: string;
    readonly html: string;
    readonly first: Command;
    readonly second: Command;
    readonly caretSeed: number;
}

const SCENARIOS: readonly Scenario[] = (() => {
    const random = mulberry32(SEED + 1);
    const pickFrom = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
    return DOCUMENTS.flatMap(([name, html]) =>
        (name.startsWith('generated') ? [pickFrom(COMMANDS)] : COMMANDS).map((first) => ({
            name: `${first} on ${name}`,
            html,
            first,
            second: pickFrom(BLOCK_COMMANDS),
            caretSeed: Math.floor(random() * 1_000_000),
        })));
})();

/** One test per run of scenarios, so one editor serves many; every assertion is soft and names its scenario. */
function scenarioGroups(scenarios: readonly Scenario[]): Array<{ label: string; group: Scenario[] }> {
    const groups: Scenario[][] = [];
    for (let at = 0; at < scenarios.length; at += GROUP_SIZE) groups.push(scenarios.slice(at, at + GROUP_SIZE));
    return groups.map((group) => ({ label: `${group[0]?.name} … ${group.at(-1)?.name}`, group }));
}

describe('block commands over generated documents', () => {
    async function session(): Promise<{ editor: GeRichTextEditor; root: HTMLElement }> {
        const editor = await blockEditor('');
        // Each scenario is written as a value; recording the write gives undo a state to return to.
        editor.history = { recordExternalWrites: true };
        return { editor, root: editableOf(editor) };
    }

    /** The caret in a text node chosen by `seed`, at its start, one in or its end; else the start of the first line element. */
    function placeCaret(root: HTMLElement, seed: number): boolean {
        const texts: Text[] = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!isBlankText(node)) texts.push(node as Text);
        }
        const range = new Range();
        const text = texts[seed % Math.max(texts.length, 1)];
        if (text) {
            const offsets = [0, Math.min(1, text.data.length), text.data.length];
            range.setStart(text, offsets[Math.floor(seed / 7) % offsets.length] ?? 0);
        } else {
            const target = root.querySelector('td, li, p, span, h2, summary');
            if (!target) return false;
            range.setStart(target, 0);
        }
        range.collapse(true);
        const selection = document.getSelection();
        if (!selection) return false;
        selection.removeAllRanges();
        selection.addRange(range);
        return true;
    }

    const contextOf = (scenario: Scenario, root: HTMLElement, step: string): string =>
        `${scenario.name} — ${step}\ninput: ${scenario.html}\neditor: ${root.innerHTML}`;

    function liveProblems(root: HTMLElement): string {
        const host = attached(root.innerHTML);
        try {
            return invalidMarkup(host);
        } finally {
            host.remove();
        }
    }

    /** Where what the author sees and what a save would keep first differ, or '' when they agree. */
    function unsavedChange(editor: GeRichTextEditor, root: HTMLElement): string {
        const live = attached(root.innerHTML);
        const saved = attached(editor.sanitizer.sanitize(root.innerHTML));
        try {
            const shown = shape(live);
            const kept = shape(saved);
            return shown === kept ? '' : firstDifference(shown, kept);
        } finally {
            live.remove();
            saved.remove();
        }
    }

    /** A markdown save of what the editor shows keeps every word, image and rule it can represent. */
    function expectSaveKeeps(editor: GeRichTextEditor, root: HTMLElement, scenario: Scenario, step: string): void {
        const shown = editor.sanitizer.sanitize(root.innerHTML);
        const first = editor.markdown.toHtml(editor.markdown.toMarkdown(shown));
        const before = attached(shown);
        const after = attached(first);
        const why = (what: string) => contextOf(scenario, root, `${what} ${step}`);
        try {
            expect.soft(wordsOf(after).join(' '), why('words')).toBe(wordsOf(before).join(' '));
            expect.soft(countOf(after, 'img'), why('images')).toBe(countOf(before, 'img'));
            expect.soft(countOf(after, 'hr'), why('rules')).toBe(countOf(before, 'hr') - rulesWithoutMarkdownForm(before));
            expect.soft(invalidMarkup(after), why('markup')).toBe('');
            expect.soft(countOf(after, 'p:empty'), why('empty paragraphs')).toBeLessThanOrEqual(countOf(before, 'p:empty'));
            expect.soft(quoteParagraphs(after), why('quote paragraphs')).toBeGreaterThanOrEqual(quoteParagraphs(before));
            expect.soft(editor.markdown.toHtml(editor.markdown.toMarkdown(first)), why('second save')).toBe(first);
        } finally {
            before.remove();
            after.remove();
        }
    }

    function expectShapesThatSave(editor: GeRichTextEditor, root: HTMLElement, scenario: Scenario, step: string): void {
        expect.soft(liveProblems(root), contextOf(scenario, root, `markup ${step}`)).toBe('');
        expect.soft(unsavedChange(editor, root), contextOf(scenario, root, `shown differs from saved ${step}`)).toBe('');
    }

    async function checkCommand(editor: GeRichTextEditor, root: HTMLElement, scenario: Scenario): Promise<void> {
        await load(editor, scenario.html);
        if (!placeCaret(root, scenario.caretSeed)) return;
        const words = wordsOf(root).join(' ');
        const images = countOf(root, 'img');
        const rules = countOf(root, 'hr') + (scenario.first === 'horizontalRule' ? 1 : 0);

        editor.format(scenario.first);
        expect.soft(wordsOf(root).join(' '), contextOf(scenario, root, 'words')).toBe(words);
        expect.soft(countOf(root, 'img'), contextOf(scenario, root, 'images')).toBe(images);
        expect.soft(countOf(root, 'hr'), contextOf(scenario, root, 'rules')).toBe(rules);
        expectShapesThatSave(editor, root, scenario, 'after the command');
        expectSaveKeeps(editor, root, scenario, 'saved after the command');
    }

    async function checkCommandPair(editor: GeRichTextEditor, root: HTMLElement, scenario: Scenario): Promise<void> {
        await load(editor, scenario.html);
        if (!placeCaret(root, scenario.caretSeed)) return;
        const words = wordsOf(root).join(' ');
        const images = countOf(root, 'img');
        const rules = countOf(root, 'hr') + [scenario.first, scenario.second].filter((command) => command === 'horizontalRule').length;

        editor.format(scenario.first);
        placeCaret(root, scenario.caretSeed + 7);
        editor.format(scenario.second);
        expect.soft(wordsOf(root).join(' '), contextOf(scenario, root, `words after ${scenario.second}`)).toBe(words);
        expect.soft(countOf(root, 'img'), contextOf(scenario, root, `images after ${scenario.second}`)).toBe(images);
        expect.soft(countOf(root, 'hr'), contextOf(scenario, root, `rules after ${scenario.second}`)).toBe(rules);
        expectShapesThatSave(editor, root, scenario, `after ${scenario.second}`);
        expectSaveKeeps(editor, root, scenario, `saved after ${scenario.second}`);
    }

    describe('a command keeps every word, image and rule, and builds only markup that saves as shown', () => {
        it.each(scenarioGroups(SCENARIOS))('$label', async ({ group }) => {
            const { editor, root } = await session();
            for (const scenario of group) await checkCommand(editor, root, scenario);
        });
    });

    describe('a second block command on the result still builds markup that saves as shown', () => {
        it.each(scenarioGroups(SCENARIOS.filter((scenario) => (BLOCK_COMMANDS as readonly Command[]).includes(scenario.first))))('$label', async ({ group }) => {
            const { editor, root } = await session();
            for (const scenario of group) await checkCommandPair(editor, root, scenario);
        });
    });

    // Angular spec 789-793: undo restores the document a command changed
    describe('undo restores the document a command changed', () => {
        it.each(scenarioGroups(SCENARIOS.filter((scenario) => (BLOCK_COMMANDS as readonly Command[]).includes(scenario.first))))('$label', async ({ group }) => {
            const { editor, root } = await session();
            for (const scenario of group) {
                await load(editor, scenario.html);
                const before = root.innerHTML;
                const saved = editor.htmlOutput;
                if (!placeCaret(root, scenario.caretSeed)) continue;
                editor.format(scenario.first);
                // History records the saved document, so a command that only touched the live DOM has nothing to undo.
                if (editor.htmlOutput === saved) continue;
                editor.undo();
                expect.soft(root.innerHTML, contextOf(scenario, root, 'undo')).toBe(before);
            }
        });
    });
});
