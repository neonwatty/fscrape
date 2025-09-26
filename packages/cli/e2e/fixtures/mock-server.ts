/**
 * Mock server for E2E tests
 */

import express from 'express';
import { Server } from 'http';
import { mockRedditResponse, mockHackerNewsTopStories, mockHackerNewsItems, mockRedditCommentsResponse } from './mock-data.js';

let server: Server | null = null;

export async function startMockServer(port = 3456): Promise<void> {
  if (server) {
    return; // Server already running
  }

  const app = express();

  // Reddit API endpoints
  app.get('/r/:subreddit/:sort?.json', (req, res) => {
    res.json(mockRedditResponse);
  });

  app.get('/r/:subreddit.json', (req, res) => {
    res.json(mockRedditResponse);
  });

  app.get('/r/:subreddit/comments/:postId.json', (req, res) => {
    res.json(mockRedditCommentsResponse);
  });

  app.get('/api/v1/me', (req, res) => {
    res.status(401).json({ error: 'Not authenticated' });
  });

  // HackerNews API endpoints
  app.get('/v0/topstories.json', (req, res) => {
    res.json(mockHackerNewsTopStories);
  });

  app.get('/v0/newstories.json', (req, res) => {
    res.json(mockHackerNewsTopStories);
  });

  app.get('/v0/beststories.json', (req, res) => {
    res.json(mockHackerNewsTopStories);
  });

  app.get('/v0/item/:id.json', (req, res) => {
    const id = parseInt(req.params.id);
    const item = mockHackerNewsItems[id as keyof typeof mockHackerNewsItems];
    if (item) {
      res.json(item);
    } else {
      res.status(404).json({ error: 'Item not found' });
    }
  });

  app.get('/v0/maxitem.json', (req, res) => {
    res.json(105);
  });

  // Default handler
  app.use((req, res) => {
    console.log('Mock server: Unhandled request', req.method, req.url);
    res.status(404).json({ error: 'Not found' });
  });

  return new Promise((resolve) => {
    server = app.listen(port, () => {
      console.log(`Mock server running on port ${port}`);
      resolve();
    });
  });
}

export async function stopMockServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        server = null;
        console.log('Mock server stopped');
        resolve();
      });
    } else {
      resolve();
    }
  });
}

export function getMockServerUrl(port = 3456): string {
  return `http://localhost:${port}`;
}