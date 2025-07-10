if (typeof window === 'undefined') {
    global.ReadableStream = class ReadableStream {

        // Minimal implementation for getReader
        getReader(): ReadableStreamDefaultReader<Uint8Array> {
            return {
                read: async () => ({ value: undefined, done: true }), // Always signals end of stream
                releaseLock: () => {},
                cancel: async () => {},
                closed: Promise.resolve(),
            } as ReadableStreamDefaultReader<Uint8Array>; // Cast to satisfy type system
        }

        // Minimal implementation for async iteration (for 'for await of' loops)
        async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
            yield undefined as unknown as Uint8Array; // Yield undefined to signal end of stream
        }

    } as unknown as typeof ReadableStream;

}