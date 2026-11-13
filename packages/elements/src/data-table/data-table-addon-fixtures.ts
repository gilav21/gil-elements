/**
 * Test kit of the wave 7 addons and AI, safe in node and in the browser (no DOM needed to import it): a download recorder and a
 * scripted AI provider. Re-exported by data-table-fixtures.ts for the browser tests.
 */
import type { AiProvider, AiRequest, AiResult } from '../shared/ai.js';

export interface RecordedDownload {
    /** The anchor's `download` attribute. */
    name: string;
    href: string;
    /** The Blob behind `href`, when it is one of the recorded object URLs. */
    blob: Blob | undefined;
}

export interface DownloadStub {
    /** One entry per anchor click, in order. */
    readonly downloads: RecordedDownload[];
    /** Every object URL created, and those revoked, in order. */
    readonly created: string[];
    readonly revoked: string[];
    restore(): void;
}

/**
 * Replaces `URL.createObjectURL` / `revokeObjectURL` with recorders that keep the Blob, and (where there is a DOM) `HTMLAnchorElement.prototype.click`
 * with a recorder of `{ name, href, blob }`: no real download starts, so no file dialog and no file left behind. `restore()` puts all three back.
 */
export function stubDownload(): DownloadStub {
    const blobs = new Map<string, Blob>();
    const stub: DownloadStub = { downloads: [], created: [], revoked: [], restore };
    const { createObjectURL, revokeObjectURL } = URL;
    const anchor = globalThis.HTMLAnchorElement?.prototype;
    const click = anchor?.click;
    const ownClick = anchor !== undefined && Object.hasOwn(anchor, 'click'); // HTMLAnchorElement inherits HTMLElement's click
    URL.createObjectURL = (object: Blob | MediaSource): string => {
        const url = `blob:stub/${stub.created.length + 1}`;
        if (object instanceof Blob) blobs.set(url, object);
        stub.created.push(url);
        return url;
    };
    URL.revokeObjectURL = (url: string): void => void stub.revoked.push(url);
    if (anchor) {
        anchor.click = function (this: HTMLAnchorElement): void {
            stub.downloads.push({ name: this.download, href: this.href, blob: blobs.get(this.href) });
        };
    }
    function restore(): void {
        URL.createObjectURL = createObjectURL;
        URL.revokeObjectURL = revokeObjectURL;
        if (!anchor) return;
        if (ownClick && click) anchor.click = click;
        else delete (anchor as Partial<HTMLAnchorElement>).click; // the prototype chain again
    }
    return stub;
}

/** One scripted answer: a fixed result, or a function of the request (to throw, stream, or wait for `signal`). */
export type AiAnswer = AiResult | ((request: AiRequest) => AiResult);

export interface ScriptedAiProvider {
    readonly provider: AiProvider;
    /** Every request the table made, in order. */
    readonly requests: AiRequest[];
}

/** An `AiProvider` that answers the n-th request with the n-th scripted answer (the last one again after the script ends) and records every request. */
export function makeAiProvider(...answers: AiAnswer[]): ScriptedAiProvider {
    const requests: AiRequest[] = [];
    const provider: AiProvider = (request) => {
        requests.push(request);
        const answer = answers[Math.min(requests.length, answers.length) - 1] ?? '';
        return typeof answer === 'function' ? answer(request) : answer;
    };
    return { provider, requests };
}
