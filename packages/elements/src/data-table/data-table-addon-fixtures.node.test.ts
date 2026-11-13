import { afterEach, describe, expect, it } from 'vitest';
import { runAiTask } from '../shared/ai.js';
import { makeAiProvider, stubDownload, type DownloadStub } from './data-table-addon-fixtures.js';

let stub: DownloadStub | undefined;
afterEach(() => stub?.restore());

describe('stubDownload (node: no DOM)', () => {
    it('records the object URLs and their Blobs, and the revokes, then restores the real functions', () => {
        const { createObjectURL, revokeObjectURL } = URL;
        stub = stubDownload();
        const blob = new Blob(['a,b'], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        URL.revokeObjectURL(url);
        expect(stub.created).toEqual([url]);
        expect(stub.revoked).toEqual([url]);
        expect(url.startsWith('blob:stub/')).toBe(true);
        stub.restore();
        expect(URL.createObjectURL).toBe(createObjectURL);
        expect(URL.revokeObjectURL).toBe(revokeObjectURL);
    });
});

describe('makeAiProvider', () => {
    it('answers request n with answer n, then the last one again, and records every request', async () => {
        const { provider, requests } = makeAiProvider('first', (request) => `echo ${request.input}`);
        const answers: string[] = [];
        for (const input of ['a', 'b', 'c']) {
            for await (const text of runAiTask(provider, { task: 'nl-filter', input })) answers.push(text);
        }
        expect(answers).toEqual(['first', 'echo b', 'echo c']);
        expect(requests.map((r) => r.input)).toEqual(['a', 'b', 'c']);
    });

    it('answers an empty string without a script', () => {
        expect(makeAiProvider().provider({ task: 'table-fill', input: '{}' })).toBe('');
    });
});
