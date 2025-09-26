#!/usr/bin/env node

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Get command line arguments
const args = process.argv.slice(2);
const SOURCE_DB = args[0] || 'fscrape.db';
const FRONTEND_DB_PATH = args[1] || '/Users/jeremywatt/Desktop/fscrape-frontend/public/data/sample.db';
const TARGET_DB = 'frontend-temp.db';

console.log('Starting database migration from fscrape to frontend format...\n');
console.log(`Source: ${SOURCE_DB}`);
console.log(`Target: ${FRONTEND_DB_PATH}\n`);

// Open source database
const sourceDb = Database(SOURCE_DB, { readonly: true });
console.log(`✓ Connected to source database: ${SOURCE_DB}`);

// Create target database
if (fs.existsSync(TARGET_DB)) {
  fs.unlinkSync(TARGET_DB);
  console.log(`✓ Removed existing target database: ${TARGET_DB}`);
}
const targetDb = Database(TARGET_DB);
console.log(`✓ Created target database: ${TARGET_DB}`);

// Create frontend schema - UPDATED to match expected fields
const createSchema = `
-- Create posts table with frontend-expected schema
CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    content TEXT,
    url TEXT,
    score INTEGER DEFAULT 0,
    num_comments INTEGER DEFAULT 0,
    created_utc INTEGER NOT NULL,
    scraped_at TEXT,
    platform TEXT,
    source TEXT,
    permalink TEXT,
    subreddit TEXT,
    forum_name TEXT,
    thread_id TEXT,
    post_type TEXT,

    -- Additional fields from ForumPost type
    upvote_ratio REAL,
    link_flair_text TEXT,
    is_self BOOLEAN,
    is_video BOOLEAN,
    is_original_content BOOLEAN,
    over_18 BOOLEAN,
    spoiler BOOLEAN,
    stickied BOOLEAN,
    locked BOOLEAN,
    distinguished TEXT,
    edited INTEGER,
    author_flair_text TEXT,
    removed_by_category TEXT,
    domain TEXT,
    thumbnail TEXT,
    gilded INTEGER,
    total_awards_received INTEGER,
    deleted BOOLEAN,
    removed BOOLEAN
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_created_utc ON posts(created_utc DESC);
CREATE INDEX IF NOT EXISTS idx_posts_score ON posts(score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_posts_source ON posts(source);
`;

targetDb.exec(createSchema);
console.log('✓ Created frontend database schema with correct field names');

// Migrate posts from fscrape to frontend format
const migratePosts = targetDb.prepare(`
  INSERT INTO posts (
    id, title, author, content, url, score, num_comments,
    created_utc, scraped_at, platform, source, permalink,
    subreddit, forum_name, thread_id, post_type,
    upvote_ratio, link_flair_text, is_self, is_video,
    is_original_content, over_18, spoiler, stickied,
    locked, distinguished, edited, author_flair_text,
    removed_by_category, domain, thumbnail, gilded,
    total_awards_received, deleted, removed
  ) VALUES (
    @id, @title, @author, @content, @url, @score, @num_comments,
    @created_utc, @scraped_at, @platform, @source, @permalink,
    @subreddit, @forum_name, @thread_id, @post_type,
    @upvote_ratio, @link_flair_text, @is_self, @is_video,
    @is_original_content, @over_18, @spoiler, @stickied,
    @locked, @distinguished, @edited, @author_flair_text,
    @removed_by_category, @domain, @thumbnail, @gilded,
    @total_awards_received, @deleted, @removed
  )
`);

// Get posts from source database
const posts = sourceDb.prepare(`
  SELECT
    id,
    title,
    author,
    content,
    url,
    score,
    comment_count as comments,
    created_at,
    scraped_at,
    platform,
    metadata
  FROM posts
  ORDER BY created_at DESC
`).all();

console.log(`\n✓ Found ${posts.length} posts to migrate`);

// Convert and insert posts
let migratedCount = 0;
const migrateMany = targetDb.transaction((posts) => {
  for (const post of posts) {
    try {
      // Parse metadata if it exists
      let metadata = {};
      if (post.metadata) {
        try {
          metadata = JSON.parse(post.metadata);
        } catch (e) {
          console.warn(`Warning: Could not parse metadata for post ${post.id}`);
        }
      }

      // Convert timestamps
      // created_at is already in milliseconds from fscrape
      const createdUtc = post.created_at ? Math.floor(post.created_at / 1000) : Math.floor(Date.now() / 1000);
      const scrapedAt = post.scraped_at
        ? new Date(post.scraped_at).toISOString()
        : new Date().toISOString();

      // Extract subreddit and source
      let subreddit = null;
      let source = null;

      if (post.platform === 'reddit') {
        if (metadata.subreddit) {
          subreddit = metadata.subreddit;
        } else if (metadata.subreddit_name) {
          subreddit = metadata.subreddit_name;
        } else if (metadata.subreddit_name_prefixed) {
          subreddit = metadata.subreddit_name_prefixed.replace('r/', '');
        } else {
          subreddit = 'programming';
        }
        source = subreddit; // For Reddit, source is the subreddit
      } else if (post.platform === 'hackernews') {
        source = metadata.category || 'frontpage';
      } else {
        source = metadata.source || post.platform;
      }

      // Build permalink
      let permalink = metadata.permalink;
      if (!permalink && post.platform === 'reddit' && metadata.id) {
        permalink = `/r/${subreddit || 'programming'}/comments/${metadata.id}/`;
      } else if (!permalink) {
        permalink = `/post/${post.id}`;
      }

      // Generate unique ID if needed
      const postId = post.id || `${post.platform}_${createdUtc}_${Math.random().toString(36).substr(2, 9)}`;

      // Prepare the data for migration with all fields
      const migratedPost = {
        id: postId,
        title: post.title || 'Untitled',
        author: post.author || 'Anonymous',
        content: post.content || '',
        url: post.url || '',
        score: post.score || 0,
        num_comments: post.comments || 0, // Changed from comments to num_comments
        created_utc: createdUtc, // Unix timestamp in seconds
        scraped_at: scrapedAt,
        platform: post.platform || 'unknown',
        source: source, // Added source field
        permalink: permalink,
        subreddit: subreddit,
        forum_name: metadata.forum_name || null,
        thread_id: metadata.id || post.id,
        post_type: metadata.is_self ? 'text' : 'link',

        // Additional fields from metadata (convert booleans to integers for SQLite)
        upvote_ratio: metadata.upvote_ratio || null,
        link_flair_text: metadata.link_flair_text || null,
        is_self: metadata.is_self ? 1 : 0,
        is_video: metadata.is_video ? 1 : 0,
        is_original_content: metadata.is_original_content ? 1 : 0,
        over_18: metadata.over_18 ? 1 : 0,
        spoiler: metadata.spoiler ? 1 : 0,
        stickied: metadata.stickied ? 1 : 0,
        locked: metadata.locked ? 1 : 0,
        distinguished: metadata.distinguished || null,
        edited: typeof metadata.edited === 'boolean' ? (metadata.edited ? 1 : 0) : (metadata.edited || null),
        author_flair_text: metadata.author_flair_text || null,
        removed_by_category: metadata.removed_by_category || null,
        domain: metadata.domain || null,
        thumbnail: metadata.thumbnail || null,
        gilded: metadata.gilded || 0,
        total_awards_received: metadata.total_awards_received || 0,
        deleted: metadata.deleted ? 1 : 0,
        removed: metadata.removed ? 1 : 0
      };

      migratePosts.run(migratedPost);
      migratedCount++;

      if (migratedCount % 10 === 0) {
        process.stdout.write(`\rMigrating posts: ${migratedCount}/${posts.length}`);
      }
    } catch (error) {
      console.error(`\nError migrating post ${post.id}: ${error.message}`);
    }
  }
});

migrateMany(posts);
console.log(`\n✓ Successfully migrated ${migratedCount} posts`);

// Add metadata table
targetDb.exec(`
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO metadata (key, value) VALUES
    ('version', '1.0.0'),
    ('last_update', datetime('now')),
    ('total_posts', (SELECT COUNT(*) FROM posts));
`);
console.log('✓ Added metadata table');

// Get statistics
const stats = targetDb.prepare(`
  SELECT
    platform,
    COUNT(*) as count,
    AVG(score) as avg_score,
    MAX(score) as max_score,
    AVG(num_comments) as avg_comments,
    MIN(created_utc) as earliest_post,
    MAX(created_utc) as latest_post
  FROM posts
  GROUP BY platform
`).all();

console.log('\n📊 Migration Statistics:');
console.log('━'.repeat(50));
stats.forEach(stat => {
  console.log(`Platform: ${stat.platform}`);
  console.log(`  • Posts: ${stat.count}`);
  console.log(`  • Avg Score: ${Math.round(stat.avg_score)}`);
  console.log(`  • Max Score: ${stat.max_score}`);
  console.log(`  • Avg Comments: ${Math.round(stat.avg_comments)}`);
  console.log(`  • Date Range: ${new Date(stat.earliest_post * 1000).toLocaleDateString()} - ${new Date(stat.latest_post * 1000).toLocaleDateString()}`);
});

// Verify critical fields
const verification = targetDb.prepare(`
  SELECT
    COUNT(*) as total,
    COUNT(created_utc) as has_created_utc,
    COUNT(num_comments) as has_num_comments,
    COUNT(source) as has_source
  FROM posts
`).get();

console.log('\n✅ Field Verification:');
console.log(`  • Total posts: ${verification.total}`);
console.log(`  • Posts with created_utc: ${verification.has_created_utc}`);
console.log(`  • Posts with num_comments: ${verification.has_num_comments}`);
console.log(`  • Posts with source: ${verification.has_source}`);

// Close databases
sourceDb.close();
targetDb.close();
console.log('\n✓ Closed database connections');

// Deploy to frontend
console.log('\n🚀 Deploying to frontend...');

// Backup existing frontend database
if (fs.existsSync(FRONTEND_DB_PATH)) {
  const backupPath = FRONTEND_DB_PATH.replace('.db', `_backup_${Date.now()}.db`);
  fs.copyFileSync(FRONTEND_DB_PATH, backupPath);
  console.log(`✓ Backed up existing database to: ${path.basename(backupPath)}`);
}

// Copy new database to frontend
fs.copyFileSync(TARGET_DB, FRONTEND_DB_PATH);
console.log(`✓ Deployed database to: ${FRONTEND_DB_PATH}`);

console.log('\n✅ Migration completed successfully!');
console.log('\nNext steps:');
console.log('1. The frontend server should automatically reload');
console.log('2. Navigate to http://localhost:3000/analytics');
console.log('3. You should now see all charts and visualizations with data');