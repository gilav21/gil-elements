import { describe, expect, it } from 'vitest';
import { runAiTask, type AiProvider, type AiRequest } from './ai.js';

const REQ: AiRequest = { task: 'rewrite', input: 'hello' };

async function collect(iterable: AsyncIterable<string>): Promise<string[]> {
    const out: string[] = [];
    for await (const value of iterable) out.push(value);
    return out;
}

describe('runAiTask', () => {
    it('wraps a plain string result in a single emission', async () => {
        const provider: AiProvider = () => 'rewritten';
        expect(await collect(runAiTask(provider, REQ))).toEqual(['rewritten']);
    });

    it('wraps a Promise result', async () => {
        const provider: AiProvider = () => Promise.resolve('async result');
        expect(await collect(runAiTask(provider, REQ))).toEqual(['async result']);
    });

    it('passes an async iterable through, preserving progressive (streamed) emissions', async () => {
        const provider: AiProvider = async function* () {
            yield 'Hel';
            yield 'Hello';
            yield 'Hello world';
        };
        expect(await collect(runAiTask(provider, REQ))).toEqual(['Hel', 'Hello', 'Hello world']);
    });

    it('forwards the full request (task, prompt, context, signal) to the provider', async () => {
        const controller = new AbortController();
        let received: AiRequest | null = null;
        const provider: AiProvider = (req) => {
            received = req;
            return '';
        };
        const request: AiRequest = {
            task: 'translate',
            input: 'bonjour',
            prompt: 'to English',
            context: { locale: 'fr' },
            signal: controller.signal,
        };
        await collect(runAiTask(provider, request));
        expect(received).toBe(request);
    });
});
