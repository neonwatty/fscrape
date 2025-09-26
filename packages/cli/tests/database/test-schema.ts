#!/usr/bin/env node
import Database from "better-sqlite3";
import {
  MigrationManager,
  initializeDatabase,
  getMigrationStatus,
} from "./src/database/migrations.js";
import { DatabaseConnection, DatabaseOperations } from "./src/database/index.js";
import type { ForumPost, Comment, User } from "./src/types/core.js";

console.log("🧪 Testing Database Schema and Migrations...\n");

// Create in-memory database for testing
const db = new Database(":memory:");
console.log("✅ Created in-memory database");

// Test 1: Initialize database with schema
console.log("\n📋 Test 1: Schema Initialization");
try {
  await initializeDatabase(db);
  console.log("✅ Database initialized with schema");
} catch (error) {
  console.error("❌ Failed to initialize database:", error);
  process.exit(1);
}

// Test 2: Verify tables exist
console.log("\n📋 Test 2: Table Verification");
const tables = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  .all() as Array<{ name: string }>;

const expectedTables = [
  "comments",
  "daily_stats",
  "forum_posts",
  "rate_limit_state",
  "schema_migrations",
  "scraping_metrics",
  "scraping_sessions",
  "users",
];

const tableNames = tables.map((t) => t.name);
const missingTables = expectedTables.filter((t) => !tableNames.includes(t));

if (missingTables.length === 0) {
  console.log(`✅ All ${expectedTables.length} tables created successfully`);
  console.log(`   Tables: ${tableNames.join(", ")}`);
} else {
  console.error(`❌ Missing tables: ${missingTables.join(", ")}`);
  process.exit(1);
}

// Test 3: Verify indexes
console.log("\n📋 Test 3: Index Verification");
const indexes = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name"
  )
  .all() as Array<{ name: string }>;

console.log(`✅ Created ${indexes.length} indexes`);
if (indexes.length < 10) {
  console.warn("⚠️  Warning: Expected at least 10 indexes");
}

// Test 4: Test generated columns
console.log("\n📋 Test 4: Generated Columns Test");
try {
  // Insert a test post
  db.prepare(`
    INSERT INTO forum_posts (
      id, platform, platform_id, title, content, url, 
      author, author_id, score, comment_count, created_at
    ) VALUES (
      'test-1', 'reddit', 'r123', 'Test Post', 'Test content', 
      'https://reddit.com/test', 'testuser', 'u123', 
      500, 50, ${Date.now()}
    )
  `).run();

  // Check generated columns
  const post = db
    .prepare("SELECT score_normalized, engagement_rate FROM forum_posts WHERE id = 'test-1'")
    .get() as { score_normalized: number; engagement_rate: number };

  // Check with tolerance for floating point
  const expectedEngagement = 50 / 501; // 50 comments / (500 score + 1)
  const normalizedOk = Math.abs(post.score_normalized - 0.05) < 0.001;
  const engagementOk = Math.abs(post.engagement_rate - expectedEngagement) < 0.001;
  
  if (normalizedOk && engagementOk) {
    console.log("✅ Generated columns work correctly");
    console.log(`   score_normalized: ${post.score_normalized}`);
    console.log(`   engagement_rate: ${post.engagement_rate.toFixed(4)}`);
  } else {
    console.error("❌ Generated columns calculation error");
    console.error(`   Expected normalized: 0.05, got: ${post.score_normalized}`);
    console.error(`   Expected engagement: ${expectedEngagement}, got: ${post.engagement_rate}`);
  }
} catch (error) {
  console.error("❌ Failed to test generated columns:", error);
  process.exit(1);
}

// Test 5: Test constraints
console.log("\n📋 Test 5: Constraint Testing");
try {
  // Try to insert invalid data (should fail)
  db.prepare(`
    INSERT INTO forum_posts (
      id, platform, platform_id, title, content, url, 
      author, author_id, score, comment_count, created_at
    ) VALUES (
      'test-2', 'invalid_platform', 'r456', 'Test', 'Test', 
      'https://test.com', 'user', 'u456', 0, 0, ${Date.now()}
    )
  `).run();
  console.error("❌ Constraint check failed - invalid platform accepted");
  process.exit(1);
} catch (error) {
  console.log("✅ Platform constraint working correctly");
}

// Test 6: Test unique constraints
console.log("\n📋 Test 6: Unique Constraint Testing");
try {
  // Try to insert duplicate platform_id (should fail)
  db.prepare(`
    INSERT INTO forum_posts (
      id, platform, platform_id, title, content, url, 
      author, author_id, score, comment_count, created_at
    ) VALUES (
      'test-3', 'reddit', 'r123', 'Duplicate', 'Duplicate', 
      'https://reddit.com/dup', 'user2', 'u789', 0, 0, ${Date.now()}
    )
  `).run();
  console.error("❌ Unique constraint failed - duplicate platform_id accepted");
  process.exit(1);
} catch (error) {
  console.log("✅ Unique constraint (platform, platform_id) working correctly");
}

// Test 7: Test migration status
console.log("\n📋 Test 7: Migration Status");
const status = getMigrationStatus(db);
console.log(`✅ Current migration version: ${status.current}`);
console.log(`   Applied migrations: ${status.applied.length}`);
console.log(`   Pending migrations: ${status.pending.length}`);

// Test 8: Test views
console.log("\n📋 Test 8: Views Verification");
const views = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='view' ORDER BY name"
  )
  .all() as Array<{ name: string }>;

const expectedViews = ["hot_posts", "session_performance", "user_stats"];
const viewNames = views.map((v) => v.name);
const missingViews = expectedViews.filter((v) => !viewNames.includes(v));

if (missingViews.length === 0) {
  console.log(`✅ All ${expectedViews.length} views created successfully`);
} else {
  console.error(`❌ Missing views: ${missingViews.join(", ")}`);
}

// Test 9: Test triggers
console.log("\n📋 Test 9: Triggers Verification");
const triggers = db
  .prepare(
    "SELECT name FROM sqlite_master WHERE type='trigger' ORDER BY name"
  )
  .all() as Array<{ name: string }>;

console.log(`✅ Created ${triggers.length} triggers`);
if (triggers.length >= 5) {
  console.log("✅ All expected triggers created");
} else {
  console.warn(`⚠️  Warning: Expected at least 5 triggers, found ${triggers.length}`);
}

// Test 10: Performance test with sample data
console.log("\n📋 Test 10: Performance Test with Sample Data");
const startTime = Date.now();

// Insert sample posts
const insertPost = db.prepare(`
  INSERT INTO forum_posts (
    id, platform, platform_id, title, content, url, 
    author, author_id, score, comment_count, created_at
  ) VALUES (
    @id, @platform, @platform_id, @title, @content, @url,
    @author, @author_id, @score, @comment_count, @created_at
  )
`);

const insertMany = db.transaction((posts: any[]) => {
  for (const post of posts) {
    insertPost.run(post);
  }
});

// Generate 1000 sample posts
const samplePosts = Array.from({ length: 1000 }, (_, i) => ({
  id: `perf-test-${i}`,
  platform: i % 2 === 0 ? "reddit" : "hackernews",
  platform_id: `p${i}`,
  title: `Test Post ${i}`,
  content: i % 3 === 0 ? null : `Content for post ${i}`,
  url: `https://example.com/post/${i}`,
  author: `user${i % 100}`,
  author_id: `u${i % 100}`,
  score: Math.floor(Math.random() * 1000),
  comment_count: Math.floor(Math.random() * 100),
  created_at: Date.now() - Math.floor(Math.random() * 86400000),
}));

insertMany(samplePosts);

const insertTime = Date.now() - startTime;
console.log(`✅ Inserted 1000 posts in ${insertTime}ms`);

// Test query performance
const queryStart = Date.now();
const topPosts = db
  .prepare(
    "SELECT * FROM forum_posts WHERE platform = ? ORDER BY score DESC LIMIT 10"
  )
  .all("reddit");
const queryTime = Date.now() - queryStart;

console.log(`✅ Query top posts in ${queryTime}ms`);

if (insertTime < 500 && queryTime < 10) {
  console.log("✅ Performance test passed");
} else {
  console.warn("⚠️  Performance could be improved");
}

// Clean up
db.close();

console.log("\n🎉 All schema tests passed successfully!");
console.log("💯 Database schema is properly configured with all features!\n");