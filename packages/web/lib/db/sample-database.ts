import { Database } from 'sql.js';

export async function createSampleDatabase(): Promise<Database> {
  const SQL = await (window as any).initSqlJs({
    locateFile: (file: string) => `/sql-js/${file}`,
  });

  const db = new (SQL as any).Database();

  // Create tables matching the expected schema
  db.run(`
    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      subreddit TEXT,
      title TEXT,
      author TEXT,
      body TEXT,
      created_utc INTEGER,
      score INTEGER,
      num_comments INTEGER,
      url TEXT,
      permalink TEXT,
      platform TEXT DEFAULT 'reddit'
    );

    CREATE TABLE IF NOT EXISTS authors (
      username TEXT PRIMARY KEY,
      total_posts INTEGER,
      total_score INTEGER,
      first_seen INTEGER,
      last_seen INTEGER,
      platform TEXT DEFAULT 'reddit'
    );

    CREATE INDEX IF NOT EXISTS idx_posts_created ON posts(created_utc);
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
    CREATE INDEX IF NOT EXISTS idx_posts_subreddit ON posts(subreddit);
    CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
  `);

  // Insert sample data
  const samplePosts = [
    {
      id: 'post1',
      subreddit: 'machinelearning',
      title: 'New breakthrough in transformer architectures',
      author: 'ai_researcher',
      body: 'We have discovered a new approach to attention mechanisms that reduces computational complexity...',
      created_utc: Date.now() / 1000 - 86400, // 1 day ago
      score: 245,
      num_comments: 42,
      url: 'https://example.com/paper.pdf',
      permalink: '/r/machinelearning/comments/post1',
      platform: 'reddit',
    },
    {
      id: 'post2',
      subreddit: 'programming',
      title: 'Understanding async/await in JavaScript',
      author: 'js_developer',
      body: 'Let me explain how async/await works under the hood and common pitfalls to avoid...',
      created_utc: Date.now() / 1000 - 172800, // 2 days ago
      score: 523,
      num_comments: 89,
      url: 'https://example.com/blog/async-await',
      permalink: '/r/programming/comments/post2',
      platform: 'reddit',
    },
    {
      id: 'post3',
      subreddit: 'datascience',
      title: 'Best practices for data pipeline architecture',
      author: 'data_engineer',
      body: 'Here are the key principles I follow when designing data pipelines for scale...',
      created_utc: Date.now() / 1000 - 259200, // 3 days ago
      score: 167,
      num_comments: 28,
      url: '',
      permalink: '/r/datascience/comments/post3',
      platform: 'reddit',
    },
    {
      id: 'post4',
      subreddit: 'webdev',
      title: 'Why I switched from React to Svelte',
      author: 'frontend_dev',
      body: 'After 3 years of React development, I decided to give Svelte a try. Here is my experience...',
      created_utc: Date.now() / 1000 - 345600, // 4 days ago
      score: 892,
      num_comments: 156,
      url: '',
      permalink: '/r/webdev/comments/post4',
      platform: 'reddit',
    },
    {
      id: 'post5',
      subreddit: 'rust',
      title: 'Memory management patterns in Rust',
      author: 'systems_programmer',
      body: 'Understanding ownership, borrowing, and lifetimes with practical examples...',
      created_utc: Date.now() / 1000 - 432000, // 5 days ago
      score: 412,
      num_comments: 67,
      url: 'https://example.com/rust-memory',
      permalink: '/r/rust/comments/post5',
      platform: 'reddit',
    },
  ];

  // Insert posts
  const insertPost = db.prepare(`
    INSERT INTO posts (id, subreddit, title, author, body, created_utc, score, num_comments, url, permalink, platform)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  samplePosts.forEach((post) => {
    insertPost.run([
      post.id,
      post.subreddit,
      post.title,
      post.author,
      post.body,
      post.created_utc,
      post.score,
      post.num_comments,
      post.url,
      post.permalink,
      post.platform,
    ]);
  });

  insertPost.free();

  // Create author summaries
  const authors = [
    { username: 'ai_researcher', posts: 1, score: 245 },
    { username: 'js_developer', posts: 1, score: 523 },
    { username: 'data_engineer', posts: 1, score: 167 },
    { username: 'frontend_dev', posts: 1, score: 892 },
    { username: 'systems_programmer', posts: 1, score: 412 },
  ];

  const insertAuthor = db.prepare(`
    INSERT INTO authors (username, total_posts, total_score, first_seen, last_seen, platform)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  authors.forEach((author, index) => {
    const timestamp = Date.now() / 1000 - 86400 * (index + 1);
    insertAuthor.run([author.username, author.posts, author.score, timestamp, timestamp, 'reddit']);
  });

  insertAuthor.free();

  return db;
}

export function getSampleDatabaseBlob(db: Database): Blob {
  const data = db.export();
  return new Blob([data as unknown as BlobPart], { type: 'application/octet-stream' });
}
