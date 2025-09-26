import { http, HttpResponse } from 'msw';

// Mock Reddit API endpoints
const REDDIT_API_BASE = 'https://oauth.reddit.com';
const REDDIT_WWW_BASE = 'https://www.reddit.com';

export const redditHandlers = [
  // Authentication endpoint
  http.post(`${REDDIT_WWW_BASE}/api/v1/access_token`, () => {
    return HttpResponse.json({
      access_token: 'mock-access-token',
      token_type: 'bearer',
      expires_in: 3600,
      scope: 'read',
    });
  }),

  // Get subreddit posts
  http.get(`${REDDIT_API_BASE}/r/:subreddit/:sort`, ({ params, request }) => {
    const { subreddit, sort } = params;
    const url = new URL(request.url);
    const limit = url.searchParams.get('limit') || '25';
    
    return HttpResponse.json({
      kind: 'Listing',
      data: {
        after: 'after_token',
        before: null,
        children: [
          {
            kind: 't3',
            data: {
              id: 'post1',
              title: `Mock ${sort} post in ${subreddit}`,
              author: 'mock_user',
              author_fullname: 't2_mockuser',
              selftext: 'This is a mock post content',
              created_utc: Date.now() / 1000,
              score: 100,
              num_comments: 10,
              subreddit: subreddit as string,
              permalink: `/r/${subreddit}/comments/post1/mock_post/`,
              url: `https://reddit.com/r/${subreddit}/comments/post1/`,
              over_18: false,
              spoiler: false,
              locked: false,
              stickied: false,
              is_self: true,
              is_video: false,
              link_flair_text: 'Discussion',
              upvote_ratio: 0.95,
            },
          },
          {
            kind: 't3',
            data: {
              id: 'post2',
              title: `Another mock post in ${subreddit}`,
              author: 'another_user',
              author_fullname: 't2_anotheruser',
              selftext: 'Another post content',
              created_utc: Date.now() / 1000 - 3600,
              score: 50,
              num_comments: 5,
              subreddit: subreddit as string,
              permalink: `/r/${subreddit}/comments/post2/another_mock_post/`,
              url: `https://reddit.com/r/${subreddit}/comments/post2/`,
              over_18: false,
              spoiler: false,
              locked: false,
              stickied: false,
              is_self: true,
              is_video: false,
              link_flair_text: 'Question',
              upvote_ratio: 0.90,
            },
          },
        ],
      },
    });
  }),

  // Get post by ID
  http.get(`${REDDIT_API_BASE}/api/info`, ({ request }) => {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    
    if (id === 't3_notfound') {
      return HttpResponse.json({
        kind: 'Listing',
        data: {
          children: [],
        },
      });
    }
    
    return HttpResponse.json({
      kind: 'Listing',
      data: {
        children: [
          {
            kind: 't3',
            data: {
              id: id?.replace('t3_', ''),
              title: 'Mock post by ID',
              author: 'mock_user',
              author_fullname: 't2_mockuser',
              selftext: 'Post content retrieved by ID',
              created_utc: Date.now() / 1000,
              score: 75,
              num_comments: 8,
              subreddit: 'test',
              permalink: `/r/test/comments/${id}/mock_post/`,
              url: `https://reddit.com/r/test/comments/${id}/`,
              over_18: false,
              spoiler: false,
              locked: false,
              stickied: false,
              is_self: true,
              is_video: false,
              link_flair_text: 'Meta',
              upvote_ratio: 0.92,
            },
          },
        ],
      },
    });
  }),

  // Get comments for a post
  http.get(`${REDDIT_API_BASE}/r/:subreddit/comments/:postId`, ({ params }) => {
    const { subreddit, postId } = params;
    
    return HttpResponse.json([
      // First element is the post
      {
        kind: 'Listing',
        data: {
          children: [
            {
              kind: 't3',
              data: {
                id: postId,
                title: 'Post with comments',
                subreddit: subreddit,
              },
            },
          ],
        },
      },
      // Second element is the comments
      {
        kind: 'Listing',
        data: {
          children: [
            {
              kind: 't1',
              data: {
                id: 'comment1',
                author: 'commenter1',
                author_fullname: 't2_commenter1',
                body: 'This is a top-level comment',
                created_utc: Date.now() / 1000,
                score: 20,
                parent_id: `t3_${postId}`,
                depth: 0,
                replies: {
                  kind: 'Listing',
                  data: {
                    children: [
                      {
                        kind: 't1',
                        data: {
                          id: 'reply1',
                          author: 'replier1',
                          author_fullname: 't2_replier1',
                          body: 'This is a reply',
                          created_utc: Date.now() / 1000,
                          score: 5,
                          parent_id: 't1_comment1',
                          depth: 1,
                          replies: '',
                        },
                      },
                    ],
                  },
                },
              },
            },
            {
              kind: 't1',
              data: {
                id: 'comment2',
                author: 'commenter2',
                author_fullname: 't2_commenter2',
                body: 'Another top-level comment',
                created_utc: Date.now() / 1000,
                score: 15,
                parent_id: `t3_${postId}`,
                depth: 0,
                replies: '',
              },
            },
          ],
        },
      },
    ]);
  }),

  // Get user info
  http.get(`${REDDIT_API_BASE}/user/:username/about`, ({ params }) => {
    const { username } = params;
    
    if (username === 'nonexistent') {
      return new HttpResponse(null, { status: 404 });
    }
    
    return HttpResponse.json({
      kind: 't2',
      data: {
        id: `user_${username}`,
        name: username,
        created_utc: Date.now() / 1000 - 86400 * 365,
        total_karma: 10000,
        link_karma: 5000,
        comment_karma: 5000,
        is_gold: false,
        is_mod: false,
        is_employee: false,
        icon_img: `https://www.redditstatic.com/avatars/avatar_${username}.png`,
      },
    });
  }),

  // Search endpoint
  http.get(`${REDDIT_API_BASE}/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    
    return HttpResponse.json({
      kind: 'Listing',
      data: {
        after: null,
        before: null,
        children: [
          {
            kind: 't3',
            data: {
              id: 'search1',
              title: `Search result for: ${query}`,
              author: 'search_user',
              author_fullname: 't2_searchuser',
              selftext: `Content matching query: ${query}`,
              created_utc: Date.now() / 1000,
              score: 200,
              num_comments: 25,
              subreddit: 'all',
              permalink: '/r/all/comments/search1/search_result/',
              url: 'https://reddit.com/r/all/comments/search1/',
              over_18: false,
              spoiler: false,
              locked: false,
              stickied: false,
              is_self: true,
              is_video: false,
              link_flair_text: 'Search',
              upvote_ratio: 0.88,
            },
          },
        ],
      },
    });
  }),

  // Handle rate limiting
  http.get(`${REDDIT_API_BASE}/api/v1/me`, ({ request }) => {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.includes('Bearer')) {
      return new HttpResponse(null, { status: 401 });
    }
    
    // Simulate rate limit based on a header
    if (request.headers.get('X-Test-Rate-Limit')) {
      return new HttpResponse(null, { 
        status: 429,
        headers: {
          'X-Ratelimit-Remaining': '0',
          'X-Ratelimit-Reset': String(Date.now() / 1000 + 60),
        },
      });
    }
    
    return HttpResponse.json({
      name: 'test_user',
      id: 'user123',
    });
  }),
];