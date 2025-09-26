/**
 * Mock data for HackerNews API responses during testing
 */

import type { HNItem, HNUser, StoryListType } from './client.js';

/**
 * Generate mock HackerNews story
 */
export function generateMockStory(overrides: Partial<HNItem> = {}): HNItem {
  const id = Math.floor(Math.random() * 1000000) + 30000000;
  const timestamp = Math.floor(Date.now() / 1000);

  return {
    id,
    type: 'story',
    by: overrides.by || `mock_user_${Math.floor(Math.random() * 100)}`,
    time: overrides.time ?? timestamp,
    title: overrides.title || `Mock HN Story ${id}`,
    url: overrides.url || `https://example.com/story-${id}`,
    score: overrides.score ?? Math.floor(Math.random() * 500),
    descendants: overrides.descendants ?? Math.floor(Math.random() * 100),
    kids: overrides.kids || generateMockCommentIds(5),
    text: overrides.text,
    dead: overrides.dead,
    deleted: overrides.deleted,
    ...overrides,
  };
}

/**
 * Generate mock HackerNews comment
 */
export function generateMockComment(overrides: Partial<HNItem> = {}): HNItem {
  const id = Math.floor(Math.random() * 1000000) + 30000000;
  const timestamp = Math.floor(Date.now() / 1000);

  return {
    id,
    type: 'comment',
    by: overrides.by || `mock_commenter_${Math.floor(Math.random() * 100)}`,
    time: overrides.time ?? timestamp,
    text: overrides.text || `<p>This is a mock comment with id ${id}</p>`,
    parent: overrides.parent || 30000000,
    kids: overrides.kids || [],
    dead: overrides.dead,
    deleted: overrides.deleted,
    ...overrides,
  };
}

/**
 * Generate mock HackerNews user
 */
export function generateMockUser(username: string, overrides: Partial<HNUser> = {}): HNUser {
  const timestamp = Math.floor(Date.now() / 1000) - 86400 * 365; // 1 year ago

  return {
    id: username,
    created: overrides.created ?? timestamp,
    karma: overrides.karma ?? Math.floor(Math.random() * 10000),
    about: overrides.about || `Mock user ${username}`,
    submitted: overrides.submitted || generateMockStoryIds(10),
    ...overrides,
  };
}

/**
 * Generate array of mock story IDs
 */
export function generateMockStoryIds(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 1000000) + 30000000);
}

/**
 * Generate array of mock comment IDs
 */
export function generateMockCommentIds(count: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 1000000) + 31000000);
}

/**
 * Get mock story list based on type
 */
export function getMockStoryList(type: StoryListType, limit: number = 500): number[] {
  const baseId = 30000000;
  const stories: number[] = [];

  // Generate different IDs for different story types to simulate variety
  const offset =
    {
      topstories: 0,
      newstories: 1000,
      beststories: 2000,
      askstories: 3000,
      showstories: 4000,
      jobstories: 5000,
    }[type] || 0;

  for (let i = 0; i < limit; i++) {
    stories.push(baseId + offset + i);
  }

  return stories;
}

/**
 * Get mock stories with full data
 */
export function getMockStories(ids: number[]): HNItem[] {
  return ids.map((id) =>
    generateMockStory({
      id,
      title: `Mock Story ${id}`,
      score: Math.floor(Math.random() * 1000),
      descendants: Math.floor(Math.random() * 200),
    })
  );
}

/**
 * Get mock item by ID
 */
export function getMockItem(id: number): HNItem | null {
  // Determine type based on ID range (arbitrary but consistent)
  if (id >= 31000000) {
    // Comment range
    return generateMockComment({ id });
  } else if (id >= 30000000) {
    // Story range
    return generateMockStory({ id });
  }

  return null;
}

/**
 * Get mock max item ID
 */
export function getMockMaxItemId(): number {
  return 32000000; // Arbitrary high number
}

/**
 * Generate mock data for common test scenarios
 */
export const MOCK_TEST_DATA = {
  // Common test story
  testStory: generateMockStory({
    id: 30000001,
    title: 'Test Story for E2E',
    by: 'testuser',
    score: 100,
    descendants: 50,
    url: 'https://example.com/test',
    kids: [31000001, 31000002, 31000003],
  }),

  // Common test comment
  testComment: generateMockComment({
    id: 31000001,
    parent: 30000001,
    by: 'testcommenter',
    text: '<p>This is a test comment</p>',
  }),

  // Common test user
  testUser: generateMockUser('testuser', {
    karma: 1000,
    created: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
    about: 'Test user for E2E tests',
  }),
};
