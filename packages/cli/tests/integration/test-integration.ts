#!/usr/bin/env node
import { DatabaseConnection, DatabaseOperations } from "./src/database/index.js";
import { ConfigManager } from "./src/config/index.js";
import type { ForumPost, Comment, User } from "./src/types/core.js";

console.log("🧪 Running Database and Configuration Integration Test...\n");

// Test Configuration Manager
console.log("📦 Testing Configuration Manager...");
const configManager = new ConfigManager();
const config = configManager.loadConfig();
console.log("✅ Configuration loaded successfully");
console.log(`  Platform: ${config.platform}`);
console.log(`  Database type: ${config.database?.type || "sqlite"}`);
console.log(`  Rate limit: ${config.rateLimit?.maxRequestsPerSecond || 1} req/s`);

// Test Database Connection with in-memory database
console.log("\n💾 Testing Database Connection...");
const dbConnection = DatabaseConnection.createInMemory();
console.log("✅ In-memory database created successfully");

// Test Database Operations
console.log("\n🔧 Testing Database Operations...");
const dbOps = new DatabaseOperations(dbConnection);

// Create test data
const testPost: ForumPost = {
  id: "test-post-1",
  title: "Test Post Title",
  content: "This is test content",
  author: "testuser",
  authorId: "user123",
  url: "https://example.com/post/1",
  score: 42,
  commentCount: 5,
  createdAt: new Date(),
  platform: "reddit",
  metadata: { testKey: "testValue" },
};

const testComment: Comment = {
  id: "test-comment-1",
  postId: "test-post-1",
  parentId: null,
  author: "commentuser",
  authorId: "user456",
  content: "This is a test comment",
  score: 10,
  createdAt: new Date(),
  depth: 0,
  platform: "reddit",
};

const testUser: User = {
  id: "user123",
  username: "testuser",
  karma: 1000,
  createdAt: new Date(),
  platform: "reddit",
};

// Test inserting data
console.log("  📝 Inserting test post...");
dbOps.insertPost(testPost);
console.log("  ✅ Post inserted");

console.log("  📝 Inserting test comment...");
dbOps.insertComment(testComment);
console.log("  ✅ Comment inserted");

console.log("  📝 Inserting test user...");
dbOps.insertUser(testUser);
console.log("  ✅ User inserted");

// Test retrieving data
console.log("\n  🔍 Retrieving test data...");
const retrievedPost = dbOps.getPost("test-post-1", "reddit");
if (retrievedPost && retrievedPost.title === testPost.title) {
  console.log("  ✅ Post retrieved successfully");
} else {
  console.error("  ❌ Failed to retrieve post");
  process.exit(1);
}

const retrievedComments = dbOps.getComments("test-post-1", "reddit");
if (retrievedComments.length === 1 && retrievedComments[0].id === testComment.id) {
  console.log("  ✅ Comments retrieved successfully");
} else {
  console.error("  ❌ Failed to retrieve comments");
  process.exit(1);
}

const retrievedUser = dbOps.getUser("user123", "reddit");
if (retrievedUser && retrievedUser.username === testUser.username) {
  console.log("  ✅ User retrieved successfully");
} else {
  console.error("  ❌ Failed to retrieve user");
  process.exit(1);
}

// Test statistics
console.log("\n  📊 Testing statistics...");
const stats = dbOps.getStatistics("reddit");
console.log(`  Total posts: ${stats.totalPosts}`);
console.log(`  Total comments: ${stats.totalComments}`);
console.log(`  Total users: ${stats.totalUsers}`);

if (stats.totalPosts === 1 && stats.totalComments === 1 && stats.totalUsers === 1) {
  console.log("  ✅ Statistics correct");
} else {
  console.error("  ❌ Statistics incorrect");
  process.exit(1);
}

// Test bulk operations
console.log("\n  📦 Testing bulk operations...");
const bulkPosts: ForumPost[] = [
  {
    id: "bulk-post-1",
    title: "Bulk Post 1",
    content: null,
    author: "bulkuser1",
    url: "https://example.com/bulk/1",
    score: 10,
    commentCount: 0,
    createdAt: new Date(),
    platform: "hackernews",
  },
  {
    id: "bulk-post-2",
    title: "Bulk Post 2",
    content: null,
    author: "bulkuser2",
    url: "https://example.com/bulk/2",
    score: 20,
    commentCount: 0,
    createdAt: new Date(),
    platform: "hackernews",
  },
];

dbOps.insertPosts(bulkPosts);
const hnPosts = dbOps.getPosts("hackernews", 10, 0);
if (hnPosts.length === 2) {
  console.log("  ✅ Bulk insert successful");
} else {
  console.error("  ❌ Bulk insert failed");
  process.exit(1);
}

// Clean up
dbConnection.disconnect();
console.log("\n✅ All tests passed successfully!");
console.log("💯 Database and Configuration modules are working correctly!\n");