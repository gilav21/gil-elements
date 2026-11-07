/** The kind of AI action requested: editor tasks transform prose; table tasks fill cells or compile a filter. */
export type AiTask =
    | 'rewrite'
    | 'shorten'
    | 'expand'
    | 'fix-grammar'
    | 'translate'
    | 'summarize'
    | 'continue'
    | 'custom'
    | 'table-fill'
    | 'nl-filter';

export interface AiRequest {
    task: AiTask;
    /** The source text: selected prose, a serialized row, or a natural-language query. */
    input: string;
    /** A free-form instruction (target language, the user's prompt). */
    prompt?: string;
    /** Extra structured context (columns, locale, surrounding text). */
    context?: Record<string, unknown>;
    /** Providers should cancel in-flight work when it fires. */
    signal?: AbortSignal;
}

/**
 * A string or Promise is a one-shot answer; an async iterable may emit progressively (each emission
 * is the full text so far) to drive a streaming UI. (The Angular version used an RxJS Observable.)
 */
export type AiResult = AsyncIterable<string> | Promise<string> | string;

/** The bring-your-own-AI hook. Optional: with no provider, no AI affordances appear. */
export type AiProvider = (request: AiRequest) => AiResult;

/** Normalize any {@link AiResult} into an async iterable of progressive output. */
export async function* runAiTask(provider: AiProvider, request: AiRequest): AsyncGenerator<string> {
    const result = provider(request);
    if (typeof result === 'string' || result instanceof Promise) yield await result;
    else yield* result;
}
