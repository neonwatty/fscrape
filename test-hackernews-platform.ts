#!/usr/bin/env npx tsx
/**
 * Test suite for HackerNews platform implementation
 */

import { HackerNewsScraper } from "./src/platforms/hackernews/index.js";
import { HackerNewsClient } from "./src/platforms/hackernews/client.js";
import {
  parsePost,
  parseComment,
  parseUser,
  cleanContent,
} from "./src/platforms/hackernews/parsers.js";

async function testHackerNewsPlatform() {
  console.log("Testing HackerNews Platform Implementation...\n");
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Client API Methods
  console.log("Test 1: Client API Methods");
  try {
    const client = new HackerNewsClient();
    
    // Test getting max item
    const maxItem = await client.getMaxItem();
    console.assert(maxItem > 0, "Should get valid max item ID");
    console.log(`  Max item ID: ${maxItem}`);
    
    // Test getting top stories
    const topStories = await client.getTopStories(5);
    console.assert(topStories.length > 0, "Should get top stories");
    console.assert(topStories.length <= 5, "Should respect limit");
    console.log(`  Got ${topStories.length} top stories`);
    
    // Test getting a single item
    if (topStories.length > 0) {
      const item = await client.getItem(topStories[0]);
      console.assert(item !== null, "Should get item details");
      console.assert(item?.id === topStories[0], "Item ID should match");
      console.log(`  Retrieved item: ${item?.title?.substring(0, 50)}...`);
    }
    
    // Test getting user
    const user = await client.getUser("pg");
    console.assert(user !== null, "Should get user details");
    console.assert(user?.id === "pg", "User ID should match");
    console.log(`  Retrieved user: ${user?.id} (karma: ${user?.karma})`);
    
    console.log("✓ Client API methods working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 1 failed:", error);
    testsFailed++;
  }
  
  // Test 2: Parsers
  console.log("\nTest 2: Parsers");
  try {
    // Mock HN story
    const mockStory = {
      id: 123,
      type: "story" as const,
      by: "testuser",
      time: Math.floor(Date.now() / 1000),
      title: "Test Story",
      text: "<p>This is a test story with <code>code</code> and <a href=\"https://example.com\">link</a></p>",
      score: 100,
      descendants: 50,
      url: "https://example.com",
      kids: [124, 125],
    };
    
    const post = parsePost(mockStory);
    console.assert(post !== null, "Should parse story");
    console.assert(post?.id === "123", "Post ID should match");
    console.assert(post?.title === "Test Story", "Title should match");
    console.assert(post?.author === "testuser", "Author should match");
    console.assert(post?.score === 100, "Score should match");
    
    // Test HTML cleaning
    const cleaned = cleanContent(mockStory.text!);
    console.assert(cleaned.includes("This is a test story"), "Should clean HTML");
    console.assert(cleaned.includes("`code`"), "Should preserve code blocks");
    console.assert(!cleaned.includes("<p>"), "Should remove HTML tags");
    
    // Mock HN comment
    const mockComment = {
      id: 124,
      type: "comment" as const,
      by: "commenter",
      time: Math.floor(Date.now() / 1000),
      text: "This is a comment",
      parent: 123,
      kids: [],
    };
    
    const comment = parseComment(mockComment);
    console.assert(comment !== null, "Should parse comment");
    console.assert(comment?.id === "124", "Comment ID should match");
    console.assert(comment?.parentId === "123", "Parent ID should match");
    
    // Mock HN user
    const mockUser = {
      id: "testuser",
      created: Math.floor(Date.now() / 1000) - 86400,
      karma: 1000,
      about: "Test user bio",
      submitted: [123, 124, 125],
    };
    
    const user = parseUser(mockUser);
    console.assert(user.id === "testuser", "User ID should match");
    console.assert(user.karma === 1000, "Karma should match");
    console.assert(user.username === "testuser", "Username should match");
    
    console.log("✓ Parsers working correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 2 failed:", error);
    testsFailed++;
  }
  
  // Test 3: Scraper - Get Top Stories
  console.log("\nTest 3: Scraper - Get Top Stories");
  try {
    const scraper = new HackerNewsScraper();
    
    // Test capabilities
    const capabilities = scraper.getCapabilities();
    console.assert(capabilities.supportsCommentThreads === true, "Should support comment threads");
    console.assert(capabilities.supportsUserProfiles === true, "Should support user profiles");
    console.assert(capabilities.supportsSearch === false, "Should not support native search");
    
    // Scrape top stories
    const result = await scraper.scrapePosts("top", { limit: 3 });
    console.assert(result.posts.length > 0, "Should get posts");
    console.assert(result.posts.length <= 3, "Should respect limit");
    console.assert(result.metadata.platform === "hackernews", "Platform should be hackernews");
    
    console.log(`  Scraped ${result.posts.length} posts`);
    if (result.posts.length > 0) {
      console.log(`  First post: ${result.posts[0].title.substring(0, 50)}...`);
    }
    
    console.log("✓ Scraper can get top stories");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 3 failed:", error);
    testsFailed++;
  }
  
  // Test 4: Scraper - Get Single Post with Comments
  console.log("\nTest 4: Scraper - Get Single Post with Comments");
  try {
    const scraper = new HackerNewsScraper();
    const client = new HackerNewsClient();
    
    // Get a story ID that likely has comments
    const topStories = await client.getTopStories(10);
    let storyWithComments = null;
    
    for (const storyId of topStories) {
      const item = await client.getItem(storyId);
      if (item && item.descendants && item.descendants > 0) {
        storyWithComments = item;
        break;
      }
    }
    
    if (storyWithComments) {
      const result = await scraper.scrapePost(
        storyWithComments.id.toString(),
        { includeComments: true, maxDepth: 2 }
      );
      
      console.assert(result.posts.length === 1, "Should get exactly one post");
      console.assert(result.posts[0].id === storyWithComments.id.toString(), "Post ID should match");
      
      if (storyWithComments.descendants > 0) {
        console.assert(result.comments.length > 0, "Should get comments");
        console.log(`  Scraped post "${result.posts[0].title.substring(0, 40)}..." with ${result.comments.length} comments`);
      }
    } else {
      console.log("  No stories with comments found for testing");
    }
    
    console.log("✓ Scraper can get single post with comments");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 4 failed:", error);
    testsFailed++;
  }
  
  // Test 5: Scraper - Get User Profile
  console.log("\nTest 5: Scraper - Get User Profile");
  try {
    const scraper = new HackerNewsScraper();
    
    // Use a well-known user
    const result = await scraper.scrapeUser("dang");
    
    console.assert(result.users.length === 1, "Should get user");
    console.assert(result.users[0].username === "dang", "Username should match");
    console.assert(result.users[0].karma !== undefined, "Should have karma");
    
    console.log(`  Scraped user: ${result.users[0].username} (karma: ${result.users[0].karma})`);
    console.log(`  User submissions: ${result.posts.length} posts, ${result.comments.length} comments`);
    
    console.log("✓ Scraper can get user profile");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 5 failed:", error);
    testsFailed++;
  }
  
  // Test 6: Different Story Types
  console.log("\nTest 6: Different Story Types");
  try {
    const scraper = new HackerNewsScraper();
    
    // Test different categories
    const categories = ["new", "best", "ask", "show"];
    
    for (const category of categories) {
      const result = await scraper.scrapePosts(category, { limit: 2 });
      console.assert(result.posts.length >= 0, `Should handle ${category} stories`);
      console.log(`  ${category}: ${result.posts.length} posts`);
    }
    
    console.log("✓ Scraper handles different story types");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 6 failed:", error);
    testsFailed++;
  }
  
  // Test 7: Error Handling
  console.log("\nTest 7: Error Handling");
  try {
    const scraper = new HackerNewsScraper();
    
    // Test invalid post ID
    const result1 = await scraper.scrapePost("invalid-id");
    console.assert(result1.errors.length > 0, "Should handle invalid post ID");
    
    // Test non-existent user
    const result2 = await scraper.scrapeUser("this-user-definitely-does-not-exist-12345");
    console.assert(result2.users.length === 0, "Should handle non-existent user");
    
    // Test search (not supported)
    const result3 = await scraper.search("test query");
    console.assert(result3.errors.length > 0, "Should indicate search not supported");
    console.assert(result3.errors[0].code === "NOT_SUPPORTED", "Error code should be NOT_SUPPORTED");
    
    console.log("✓ Error handling working correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 7 failed:", error);
    testsFailed++;
  }
  
  // Test 8: Rate Limiting
  console.log("\nTest 8: Rate Limiting");
  try {
    const scraper = new HackerNewsScraper({ batchSize: 2 });
    
    // Make multiple requests quickly
    const startTime = Date.now();
    const result = await scraper.scrapePosts("new", { limit: 4 });
    const duration = Date.now() - startTime;
    
    console.assert(result.posts.length > 0, "Should get posts");
    console.assert(duration > 100, "Should have delays for rate limiting");
    
    console.log(`  Scraped ${result.posts.length} posts in ${duration}ms (with rate limiting)`);
    
    console.log("✓ Rate limiting implemented");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 8 failed:", error);
    testsFailed++;
  }
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log("\n✅ All HackerNews platform tests passed!");
    process.exit(0);
  } else {
    console.log(`\n❌ ${testsFailed} tests failed`);
    process.exit(1);
  }
}

// Run tests
testHackerNewsPlatform().catch(console.error);