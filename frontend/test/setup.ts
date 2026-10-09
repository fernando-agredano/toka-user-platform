import '@testing-library/jest-dom';
import { server } from './msw/server';

// RTK Query builds `new Request('/api/...')`. Node's fetch rejects relative URLs, while browsers resolve them
// against the page, so resolve them against jsdom's location the same way.
const NativeRequest = globalThis.Request;
globalThis.Request = class RelativeUrlRequest extends NativeRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    const isRelative = typeof input === 'string' && input.startsWith('/');
    super(isRelative ? new URL(input, window.location.href) : input, init);
  }
} as typeof Request;

// jsdom does not implement scrolling; the chat page scrolls to the latest message.
Element.prototype.scrollIntoView = () => undefined;

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
