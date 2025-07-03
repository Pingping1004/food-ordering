// src/lib/server-shims.ts

if (typeof window === 'undefined') {
  // NEW: More functional ReadableStream shim
  global.ReadableStream = class ReadableStream {
    constructor(underlyingSource?: any, strategy?: any) {
      // Dummy constructor
    }

    // Minimal implementation for getReader
    getReader(): ReadableStreamDefaultReader<Uint8Array> {
      return {
        read: async () => ({ value: undefined, done: true }), // Always signals end of stream
        releaseLock: () => {},
        cancel: async (reason?: any) => {},
        closed: Promise.resolve(),
      } as ReadableStreamDefaultReader<Uint8Array>; // Cast to satisfy type system
    }

    // Minimal implementation for async iteration (for 'for await of' loops)
    async *[Symbol.asyncIterator](): AsyncGenerator<Uint8Array> {
      // Yield nothing, immediately done
      return;
    }

    // Add any other methods if errors persist (e.g., pipeThrough, pipeTo, cancel, locked)
    // You'd add them here with dummy implementations:
    // pipeThrough(transform: any, options: any): any { return this; }
    // pipeTo(dest: any, options: any): Promise<void> { return Promise.resolve(); }
    // cancel(reason: any): Promise<void> { return Promise.resolve(); }
    // get locked(): boolean { return false; }

  } as unknown as typeof ReadableStream;


  // ... (rest of your shims - Blob, File, FileList, DataTransferItem, DataTransferItemList, DataTransfer)
  // Ensure Blob's stream() method returns new global.ReadableStream()
}