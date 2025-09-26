import { setupServer } from 'msw/node';
import { redditHandlers } from './reddit-handlers';
import { hackerNewsHandlers } from './hackernews-handlers';

// Create the MSW server with all handlers
export const server = setupServer(
  ...redditHandlers,
  ...hackerNewsHandlers,
);

// Reset handlers after each test
export function resetHandlers() {
  server.resetHandlers();
}

// Add custom handlers for specific tests
export function useHandlers(...handlers: Parameters<typeof server.use>) {
  server.use(...handlers);
}