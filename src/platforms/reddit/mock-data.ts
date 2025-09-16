/**
 * Mock data for Reddit API responses during testing
 */

import type {
  RedditJsonPost,
  RedditJsonComment,
  RedditJsonListing,
} from "./public-client.js";

/**
 * Generate mock Reddit post data
 */
export function generateMockPost(
  overrides: Partial<RedditJsonPost> = {},
): RedditJsonPost {
  const id = Math.random().toString(36).substring(7);
  const timestamp = Math.floor(Date.now() / 1000);

  return {
    id,
    name: `t3_${id}`,
    subreddit: overrides.subreddit || "programming",
    title: overrides.title || `Mock Post Title ${id}`,
    selftext: overrides.selftext || `This is mock post content for post ${id}`,
    url:
      overrides.url || `https://www.reddit.com/r/programming/comments/${id}/`,
    permalink: `/r/programming/comments/${id}/mock_post_title/`,
    author: overrides.author || `mock_user_${Math.floor(Math.random() * 100)}`,
    score: overrides.score ?? Math.floor(Math.random() * 1000),
    num_comments: overrides.num_comments ?? Math.floor(Math.random() * 100),
    created_utc: overrides.created_utc ?? timestamp,
    ups: overrides.ups ?? Math.floor(Math.random() * 1000),
    downs: 0,
    is_self: overrides.is_self ?? true,
    domain: overrides.domain || "self.programming",
    thumbnail: overrides.thumbnail,
    ...overrides,
  };
}

/**
 * Generate mock Reddit comment data
 */
export function generateMockComment(
  overrides: Partial<RedditJsonComment> = {},
): RedditJsonComment {
  const id = Math.random().toString(36).substring(7);
  const timestamp = Math.floor(Date.now() / 1000);

  return {
    id,
    name: `t1_${id}`,
    author:
      overrides.author || `mock_commenter_${Math.floor(Math.random() * 100)}`,
    body: overrides.body || `This is a mock comment with id ${id}`,
    body_html:
      overrides.body_html || `<p>This is a mock comment with id ${id}</p>`,
    score: overrides.score ?? Math.floor(Math.random() * 100),
    created_utc: overrides.created_utc ?? timestamp,
    parent_id: overrides.parent_id || `t3_mockpost`,
    link_id: overrides.link_id || `t3_mockpost`,
    subreddit: overrides.subreddit || "programming",
    permalink: `/r/programming/comments/mockpost/mock_title/${id}/`,
    depth: overrides.depth ?? 0,
    replies: overrides.replies || "",
    ups: overrides.ups ?? Math.floor(Math.random() * 100),
    downs: 0,
    ...overrides,
  };
}

/**
 * Generate a mock subreddit listing response
 */
export function generateMockSubredditListing(
  subreddit: string,
  count: number = 5,
): RedditJsonListing<RedditJsonPost> {
  const posts = Array.from({ length: count }, (_, i) =>
    generateMockPost({
      subreddit,
      title: `${subreddit} Post ${i + 1}`,
      score: Math.floor(Math.random() * 5000),
      num_comments: Math.floor(Math.random() * 500),
    }),
  );

  return {
    kind: "Listing",
    data: {
      children: posts.map((post) => ({
        kind: "t3",
        data: post,
      })),
      after: count >= 5 ? "t3_nextpage" : null,
      before: null,
    },
  };
}

/**
 * Generate a mock post with comments
 */
export function generateMockPostWithComments(
  postId: string,
): [RedditJsonListing<RedditJsonPost>, RedditJsonListing<RedditJsonComment>] {
  const post = generateMockPost({
    id: postId,
    title: `Mock Post ${postId}`,
    num_comments: 5,
  });

  const comments = Array.from({ length: 5 }, (_, i) =>
    generateMockComment({
      parent_id: `t3_${postId}`,
      link_id: `t3_${postId}`,
      body: `Mock comment ${i + 1} on post ${postId}`,
      depth: 0,
    }),
  );

  // Add some nested replies
  const reply = generateMockComment({
    parent_id: `t1_${comments[0].id}`,
    link_id: `t3_${postId}`,
    body: `Mock reply to first comment`,
    depth: 1,
  });

  comments[0].replies = {
    kind: "Listing",
    data: {
      children: [
        {
          kind: "t1",
          data: reply,
        },
      ],
      after: null,
      before: null,
    },
  };

  return [
    {
      kind: "Listing",
      data: {
        children: [
          {
            kind: "t3",
            data: post,
          },
        ],
        after: null,
        before: null,
      },
    },
    {
      kind: "Listing",
      data: {
        children: comments.map((comment) => ({
          kind: "t1",
          data: comment,
        })),
        after: null,
        before: null,
      },
    },
  ];
}

/**
 * Get mock response based on URL
 */
export function getMockResponseForUrl(url: string): any {
  // Parse URL to determine what to return
  if (url.includes("/r/") && url.includes(".json")) {
    // Subreddit listing (handle URLs like /r/programming/hot.json?limit=5)
    const subredditMatch = url.match(/\/r\/([^/]+)\//);
    const subreddit = subredditMatch ? subredditMatch[1] : "programming";
    return generateMockSubredditListing(subreddit, 5);
  }

  if (url.includes("/comments/") && url.endsWith(".json")) {
    // Post with comments
    const postIdMatch = url.match(/\/comments\/([^/]+)/);
    const postId = postIdMatch ? postIdMatch[1] : "mockpost";
    return generateMockPostWithComments(postId);
  }

  // Default: return empty listing
  return {
    kind: "Listing",
    data: {
      children: [],
      after: null,
      before: null,
    },
  };
}
