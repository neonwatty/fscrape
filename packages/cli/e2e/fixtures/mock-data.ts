/**
 * Mock data for E2E tests
 */

export const mockRedditResponse = {
  kind: 'Listing',
  data: {
    children: [
      {
        kind: 't3',
        data: {
          id: 'mock_post_1',
          title: 'Mock Reddit Post 1',
          selftext: 'This is mock content for testing',
          author: 'mock_user_1',
          score: 100,
          num_comments: 5,
          created_utc: Date.now() / 1000,
          url: 'https://www.reddit.com/r/programming/comments/mock_post_1',
          subreddit: 'programming',
          permalink: '/r/programming/comments/mock_post_1/'
        }
      },
      {
        kind: 't3',
        data: {
          id: 'mock_post_2',
          title: 'Mock Reddit Post 2',
          selftext: 'Another mock post for testing',
          author: 'mock_user_2',
          score: 200,
          num_comments: 10,
          created_utc: Date.now() / 1000,
          url: 'https://www.reddit.com/r/programming/comments/mock_post_2',
          subreddit: 'programming',
          permalink: '/r/programming/comments/mock_post_2/'
        }
      },
      {
        kind: 't3',
        data: {
          id: 'mock_post_3',
          title: 'Mock Reddit Post 3',
          selftext: 'Third mock post',
          author: 'mock_user_3',
          score: 150,
          num_comments: 7,
          created_utc: Date.now() / 1000,
          url: 'https://www.reddit.com/r/programming/comments/mock_post_3',
          subreddit: 'programming',
          permalink: '/r/programming/comments/mock_post_3/'
        }
      }
    ],
    after: null,
    before: null
  }
};

export const mockHackerNewsTopStories = [101, 102, 103, 104, 105];

export const mockHackerNewsItems = {
  101: {
    id: 101,
    type: 'story',
    title: 'Mock HN Story 1',
    text: 'Mock story content 1',
    by: 'hn_user_1',
    score: 50,
    descendants: 3,
    time: Math.floor(Date.now() / 1000),
    url: 'https://example.com/story1',
    kids: [201, 202]
  },
  102: {
    id: 102,
    type: 'story',
    title: 'Mock HN Story 2',
    text: 'Mock story content 2',
    by: 'hn_user_2',
    score: 75,
    descendants: 5,
    time: Math.floor(Date.now() / 1000),
    url: 'https://example.com/story2',
    kids: [203]
  },
  103: {
    id: 103,
    type: 'story',
    title: 'Mock HN Story 3',
    text: 'Mock story content 3',
    by: 'hn_user_3',
    score: 100,
    descendants: 8,
    time: Math.floor(Date.now() / 1000),
    url: 'https://example.com/story3',
    kids: []
  },
  201: {
    id: 201,
    type: 'comment',
    text: 'Mock comment 1',
    by: 'commenter_1',
    parent: 101,
    time: Math.floor(Date.now() / 1000),
    kids: []
  },
  202: {
    id: 202,
    type: 'comment',
    text: 'Mock comment 2',
    by: 'commenter_2',
    parent: 101,
    time: Math.floor(Date.now() / 1000),
    kids: []
  },
  203: {
    id: 203,
    type: 'comment',
    text: 'Mock comment 3',
    by: 'commenter_3',
    parent: 102,
    time: Math.floor(Date.now() / 1000),
    kids: []
  }
};

export const mockRedditCommentsResponse = [
  {
    kind: 'Listing',
    data: {
      children: [
        {
          kind: 't3',
          data: {
            id: 'mock_post_1',
            title: 'Mock Reddit Post 1',
            selftext: 'This is mock content for testing',
            author: 'mock_user_1',
            score: 100,
            num_comments: 2
          }
        }
      ]
    }
  },
  {
    kind: 'Listing',
    data: {
      children: [
        {
          kind: 't1',
          data: {
            id: 'comment_1',
            body: 'Mock comment 1',
            author: 'commenter_1',
            score: 10,
            created_utc: Date.now() / 1000,
            parent_id: 't3_mock_post_1',
            depth: 0
          }
        },
        {
          kind: 't1',
          data: {
            id: 'comment_2',
            body: 'Mock comment 2',
            author: 'commenter_2',
            score: 5,
            created_utc: Date.now() / 1000,
            parent_id: 't3_mock_post_1',
            depth: 0
          }
        }
      ]
    }
  }
];