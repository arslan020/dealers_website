import { EventEmitter } from 'events';

const globalForSse = globalThis as unknown as {
    sseEmitter: EventEmitter | undefined;
};

export const sseEmitter = globalForSse.sseEmitter ?? new EventEmitter();

if (process.env.NODE_ENV !== 'production') globalForSse.sseEmitter = sseEmitter;

// Increase limit to allow many SSE clients
sseEmitter.setMaxListeners(100);
