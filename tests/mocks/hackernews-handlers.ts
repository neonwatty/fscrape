import { http, HttpResponse } from 'msw';

// Mock Hacker News API endpoints
const HN_API_BASE = 'https://hacker-news.firebaseio.com/v0';

// Mock data
const mockStory = {
  id: 12345,
  type: 'story',
  title: 'Mock HN Story',
  by: 'mock_user',
  time: Math.floor(Date.now() / 1000),
  score: 100,
  descendants: 15,
  kids: [12346, 12347, 12348],
  url: 'https://example.com/article',
  text: null,
};

const mockComment = {
  id: 12346,
  type: 'comment',
  by: 'commenter1',
  parent: 12345,
  time: Math.floor(Date.now() / 1000),
  text: 'This is a mock comment on the story',
  kids: [12349],
};

const mockReply = {
  id: 12349,
  type: 'comment',
  by: 'replier1',
  parent: 12346,
  time: Math.floor(Date.now() / 1000),
  text: 'This is a mock reply to the comment',
  kids: [],
};

const mockUser = {
  id: 'mock_user',
  created: Math.floor(Date.now() / 1000) - 86400 * 365,
  karma: 5000,
  about: 'Mock user bio',
  submitted: [12345, 12340, 12341],
};

const mockAskStory = {
  id: 12350,
  type: 'story',
  title: 'Ask HN: Mock Question?',
  by: 'ask_user',
  time: Math.floor(Date.now() / 1000),
  score: 50,
  descendants: 20,
  kids: [12351, 12352],
  text: 'This is the text of an Ask HN post',
  url: null,
};

const mockShowStory = {
  id: 12360,
  type: 'story',
  title: 'Show HN: My Mock Project',
  by: 'show_user',
  time: Math.floor(Date.now() / 1000),
  score: 75,
  descendants: 10,
  kids: [12361],
  text: 'Check out my new project!',
  url: 'https://myproject.example.com',
};

const mockJobStory = {
  id: 12370,
  type: 'job',
  title: 'Mock Company (YC S23) Is Hiring Engineers',
  by: 'company_hr',
  time: Math.floor(Date.now() / 1000),
  score: 0,
  text: 'We are looking for talented engineers...',
  url: 'https://mockcompany.com/careers',
};

export const hackerNewsHandlers = [
  // Get item by ID
  http.get(`${HN_API_BASE}/item/:id.json`, ({ params }) => {
    const id = Number(params.id);
    
    // Return different items based on ID
    switch (id) {
      case 12345:
        return HttpResponse.json(mockStory);
      case 12346:
        return HttpResponse.json(mockComment);
      case 12347:
        return HttpResponse.json({
          id: 12347,
          type: 'comment',
          by: 'commenter2',
          parent: 12345,
          time: Math.floor(Date.now() / 1000),
          text: 'Another comment on the story',
          kids: [],
        });
      case 12348:
        return HttpResponse.json({
          id: 12348,
          type: 'comment',
          by: 'commenter3',
          parent: 12345,
          time: Math.floor(Date.now() / 1000),
          text: 'Third comment on the story',
          kids: [],
        });
      case 12349:
        return HttpResponse.json(mockReply);
      case 12350:
        return HttpResponse.json(mockAskStory);
      case 12351:
      case 12352:
        return HttpResponse.json({
          id: id,
          type: 'comment',
          by: `answer_user_${id}`,
          parent: 12350,
          time: Math.floor(Date.now() / 1000),
          text: `Answer to the Ask HN question #${id}`,
          kids: [],
        });
      case 12360:
        return HttpResponse.json(mockShowStory);
      case 12361:
        return HttpResponse.json({
          id: 12361,
          type: 'comment',
          by: 'feedback_user',
          parent: 12360,
          time: Math.floor(Date.now() / 1000),
          text: 'Great project! Here is my feedback...',
          kids: [],
        });
      case 12370:
        return HttpResponse.json(mockJobStory);
      case 99999:
        // Non-existent item
        return HttpResponse.json(null);
      default:
        // Return a generic story for other IDs
        return HttpResponse.json({
          id: id,
          type: 'story',
          title: `Generic Story ${id}`,
          by: 'generic_user',
          time: Math.floor(Date.now() / 1000),
          score: Math.floor(Math.random() * 100),
          descendants: Math.floor(Math.random() * 50),
          kids: [],
          url: `https://example.com/story/${id}`,
        });
    }
  }),

  // Get user by username
  http.get(`${HN_API_BASE}/user/:username.json`, ({ params }) => {
    const { username } = params;
    
    if (username === 'nonexistent') {
      return HttpResponse.json(null);
    }
    
    if (username === 'mock_user') {
      return HttpResponse.json(mockUser);
    }
    
    // Return generic user for other usernames
    return HttpResponse.json({
      id: username,
      created: Math.floor(Date.now() / 1000) - 86400 * 180,
      karma: Math.floor(Math.random() * 10000),
      about: `Bio for ${username}`,
      submitted: [12340, 12341, 12342],
    });
  }),

  // Top stories
  http.get(`${HN_API_BASE}/topstories.json`, () => {
    return HttpResponse.json([
      12345, 12350, 12360, 12370,
      ...Array.from({ length: 496 }, (_, i) => 10000 + i),
    ]);
  }),

  // New stories
  http.get(`${HN_API_BASE}/newstories.json`, () => {
    return HttpResponse.json([
      12380, 12381, 12382, 12383, 12384,
      ...Array.from({ length: 495 }, (_, i) => 11000 + i),
    ]);
  }),

  // Best stories
  http.get(`${HN_API_BASE}/beststories.json`, () => {
    return HttpResponse.json([
      12345, 12350, 12360,
      ...Array.from({ length: 197 }, (_, i) => 12000 + i),
    ]);
  }),

  // Ask stories
  http.get(`${HN_API_BASE}/askstories.json`, () => {
    return HttpResponse.json([
      12350,
      ...Array.from({ length: 199 }, (_, i) => 13000 + i),
    ]);
  }),

  // Show stories
  http.get(`${HN_API_BASE}/showstories.json`, () => {
    return HttpResponse.json([
      12360,
      ...Array.from({ length: 199 }, (_, i) => 14000 + i),
    ]);
  }),

  // Job stories
  http.get(`${HN_API_BASE}/jobstories.json`, () => {
    return HttpResponse.json([
      12370,
      ...Array.from({ length: 199 }, (_, i) => 15000 + i),
    ]);
  }),

  // Max item ID
  http.get(`${HN_API_BASE}/maxitem.json`, () => {
    return HttpResponse.json(20000);
  }),

  // Updates (for real-time features)
  http.get(`${HN_API_BASE}/updates.json`, () => {
    return HttpResponse.json({
      items: [12345, 12346, 12347],
      profiles: ['mock_user', 'commenter1'],
    });
  }),

  // Algolia search API for HN
  http.get('https://hn.algolia.com/api/v1/search', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    const tags = url.searchParams.get('tags');
    
    return HttpResponse.json({
      hits: [
        {
          objectID: '12345',
          title: `Search result for: ${query}`,
          author: 'search_author',
          points: 150,
          num_comments: 25,
          created_at_i: Math.floor(Date.now() / 1000),
          url: 'https://example.com/search-result',
          story_text: null,
          _tags: tags ? tags.split(',') : ['story'],
        },
        {
          objectID: '12346',
          title: `Another result for: ${query}`,
          author: 'another_author',
          points: 75,
          num_comments: 10,
          created_at_i: Math.floor(Date.now() / 1000) - 3600,
          url: 'https://example.com/another-result',
          story_text: 'Some story text',
          _tags: tags ? tags.split(',') : ['story'],
        },
      ],
      nbHits: 2,
      page: 0,
      nbPages: 1,
      hitsPerPage: 20,
      exhaustiveNbHits: true,
      query: query,
      params: url.search.substring(1),
    });
  }),

  // Algolia search by date
  http.get('https://hn.algolia.com/api/v1/search_by_date', ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('query');
    
    return HttpResponse.json({
      hits: [
        {
          objectID: '12390',
          title: `Recent result for: ${query}`,
          author: 'recent_author',
          points: 50,
          num_comments: 5,
          created_at_i: Math.floor(Date.now() / 1000) - 300,
          url: 'https://example.com/recent-result',
          story_text: null,
          _tags: ['story'],
        },
      ],
      nbHits: 1,
      page: 0,
      nbPages: 1,
      hitsPerPage: 20,
      exhaustiveNbHits: true,
      query: query,
      params: url.search.substring(1),
    });
  }),

  // Error scenarios
  http.get(`${HN_API_BASE}/error/timeout`, () => {
    // Simulate timeout
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(new HttpResponse(null, { status: 504 }));
      }, 5000);
    });
  }),

  http.get(`${HN_API_BASE}/error/ratelimit`, () => {
    return new HttpResponse(null, { 
      status: 429,
      headers: {
        'Retry-After': '60',
      },
    });
  }),
];