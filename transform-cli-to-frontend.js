#!/usr/bin/env node

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const CLI_DB_PATH = path.join(__dirname, 'packages/cli/fscrape.db');
const FRONTEND_DB_PATH = path.join(__dirname, 'packages/web/public/data/sample.db');
const BACKUP_DIR = path.join(__dirname, 'packages/web/public/data/backup');

console.log('=== Data Transformation: CLI → Frontend ===\n');

if (!fs.existsSync(CLI_DB_PATH)) {
  console.error(`Error: CLI database not found at ${CLI_DB_PATH}`);
  process.exit(1);
}

if (!fs.existsSync(FRONTEND_DB_PATH)) {
  console.error(`Error: Frontend database not found at ${FRONTEND_DB_PATH}`);
  process.exit(1);
}

const cliDb = new Database(CLI_DB_PATH, { readonly: true });
const frontendDb = new Database(FRONTEND_DB_PATH);

console.log(`✓ Connected to CLI database: ${CLI_DB_PATH}`);
console.log(`✓ Connected to frontend database: ${FRONTEND_DB_PATH}\n`);

const posts = cliDb.prepare('SELECT * FROM posts').all();

console.log(`Found ${posts.length} posts in CLI database\n`);

const insertStmt = frontendDb.prepare(`
  INSERT OR REPLACE INTO posts (
    id, title, author, content, url, score, num_comments,
    created_utc, scraped_at, platform, source, permalink,
    subreddit, upvote_ratio, is_self, is_video
  ) VALUES (
    @id, @title, @author, @content, @url, @score, @num_comments,
    @created_utc, @scraped_at, @platform, @source, @permalink,
    @subreddit, @upvote_ratio, @is_self, @is_video
  )
`);

let successCount = 0;
let errorCount = 0;

const transform = frontendDb.transaction((posts) => {
  for (const post of posts) {
    try {
      let metadata = {};
      if (post.metadata) {
        try {
          metadata = JSON.parse(post.metadata);
        } catch (e) {
          console.warn(`Warning: Could not parse metadata for post ${post.id}`);
        }
      }

      const transformedPost = {
        id: post.id,
        title: post.title,
        author: post.author,
        content: post.content || '',
        url: post.url,
        score: post.score || 0,
        num_comments: post.comment_count || 0,
        created_utc: Math.floor(post.created_at / 1000),
        scraped_at: new Date(post.scraped_at || Date.now()).toISOString(),
        platform: post.platform,
        source: metadata.subreddit || 'programming',
        permalink: metadata.permalink || `/r/programming/comments/${post.platform_id}`,
        subreddit: metadata.subreddit || 'programming',
        upvote_ratio: metadata.upvote_ratio || null,
        is_self: metadata.is_self ? 1 : 0,
        is_video: metadata.is_video ? 1 : 0,
      };

      insertStmt.run(transformedPost);
      successCount++;
    } catch (error) {
      console.error(`Error transforming post ${post.id}:`, error.message);
      errorCount++;
    }
  }
});

console.log('Starting transformation...');
transform(posts);
console.log('Transformation complete!\n');

console.log('=== Summary ===');
console.log(`✓ Successfully transformed: ${successCount} posts`);
if (errorCount > 0) {
  console.log(`✗ Errors: ${errorCount} posts`);
}

const frontendCount = frontendDb.prepare('SELECT COUNT(*) as count FROM posts').get();
console.log(`\n✓ Frontend database now has ${frontendCount.count} total posts`);

const programmingCount = frontendDb
  .prepare("SELECT COUNT(*) as count FROM posts WHERE source = 'programming'")
  .get();
console.log(`✓ Posts from r/programming: ${programmingCount.count}`);

cliDb.close();
frontendDb.close();

console.log('\n✓ Transformation complete!');