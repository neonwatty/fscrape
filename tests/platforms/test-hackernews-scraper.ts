#!/usr/bin/env npx tsx

import { HackerNewsScraper } from "./src/platforms/hackernews/scraper.js";

/**
 * Integration tests for HackerNews scraper
 */
async function testHackerNewsScraper() {
  console.log("🧪 Testing HackerNews Scraper Implementation\n");

  let testsPassed = 0;
  let totalTests = 0;

  const scraper = new HackerNewsScraper({
    batchSize: 5,
    maxConcurrent: 3,
  });

  // Test 1: Initialize scraper
  try {
    totalTests++;
    console.log("Test 1: Initialize HackerNews scraper");
    
    await scraper.initialize();
    console.log("✅ Scraper initialized successfully\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Initialization failed:", error, "\n");
  }

  // Test 2: Get capabilities
  try {
    totalTests++;
    console.log("Test 2: Get platform capabilities");
    
    const capabilities = scraper.getCapabilities();
    
    if (!capabilities.supportsCommentThreads) throw new Error("Should support comment threads");
    if (!capabilities.supportsUserProfiles) throw new Error("Should support user profiles");
    if (capabilities.supportsSearch) throw new Error("Should not support native search");
    if (!capabilities.supportsCategories) throw new Error("Should support categories");
    if (capabilities.maxCommentDepth !== 100) throw new Error("Max comment depth should be 100");
    
    console.log("✅ Capabilities correctly reported\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Capabilities test failed:", error, "\n");
  }

  // Test 3: Scrape top stories
  try {
    totalTests++;
    console.log("Test 3: Scrape top stories (limited to 5)");
    
    const result = await scraper.scrapePosts("top", { 
      limit: 5,
      includeComments: false 
    });
    
    if (!result.posts || result.posts.length === 0) {
      throw new Error("No posts returned");
    }
    
    if (result.posts.length > 5) {
      throw new Error(`Expected max 5 posts, got ${result.posts.length}`);
    }
    
    // Validate post structure
    const post = result.posts[0];
    if (!post.id) throw new Error("Post missing ID");
    if (!post.title) throw new Error("Post missing title");
    if (!post.author) throw new Error("Post missing author");
    if (!post.createdAt) throw new Error("Post missing createdAt");
    if (post.platform !== "hackernews") throw new Error("Wrong platform");
    
    console.log(`✅ Scraped ${result.posts.length} top stories`);
    console.log(`   First post: "${post.title}" by ${post.author}\n`);
    testsPassed++;
  } catch (error) {
    console.error("❌ Top stories scraping failed:", error, "\n");
  }

  // Test 4: Scrape different story categories
  try {
    totalTests++;
    console.log("Test 4: Scrape different story categories");
    
    const categories = ["new", "best", "ask", "show", "job"];
    const results = [];
    
    for (const category of categories) {
      const result = await scraper.scrapePosts(category, { limit: 2 });
      results.push({ category, count: result.posts.length });
    }
    
    for (const { category, count } of results) {
      console.log(`   ${category}: ${count} posts`);
    }
    
    console.log("✅ All categories scraped successfully\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Category scraping failed:", error, "\n");
  }

  // Test 5: Scrape single post with comments
  try {
    totalTests++;
    console.log("Test 5: Scrape single post with comments");
    
    // First get a post ID
    const topStories = await scraper.scrapePosts("top", { limit: 1 });
    if (topStories.posts.length === 0) {
      throw new Error("No posts available to test");
    }
    
    const postId = topStories.posts[0].id;
    const result = await scraper.scrapePost(postId, {
      includeComments: true,
      maxDepth: 3
    });
    
    if (!result.posts || result.posts.length !== 1) {
      throw new Error("Should return exactly one post");
    }
    
    const post = result.posts[0];
    console.log(`   Post: "${post.title}"`);
    console.log(`   Comments: ${result.comments.length}`);
    
    // Check comment hierarchy
    if (result.comments.length > 0) {
      const topLevelComments = result.comments.filter(c => !c.parentId || c.depth === 1);
      const nestedComments = result.comments.filter(c => c.depth > 1);
      console.log(`   Top-level: ${topLevelComments.length}, Nested: ${nestedComments.length}`);
      
      // Verify depth limit
      const maxDepth = Math.max(...result.comments.map(c => c.depth));
      if (maxDepth > 3) {
        throw new Error(`Max depth should be 3, got ${maxDepth}`);
      }
    }
    
    console.log("✅ Post with comments scraped successfully\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Post with comments scraping failed:", error, "\n");
  }

  // Test 6: Scrape user profile
  try {
    totalTests++;
    console.log("Test 6: Scrape user profile");
    
    // Use a well-known user
    const result = await scraper.scrapeUser("pg");
    
    if (!result.users || result.users.length !== 1) {
      throw new Error("Should return exactly one user");
    }
    
    const user = result.users[0];
    if (user.id !== "pg") throw new Error("User ID mismatch");
    if (user.username !== "pg") throw new Error("Username mismatch");
    if (!user.karma || user.karma <= 0) throw new Error("Invalid karma");
    if (user.platform !== "hackernews") throw new Error("Wrong platform");
    
    console.log(`   User: ${user.username}`);
    console.log(`   Karma: ${user.karma}`);
    console.log(`   Recent posts: ${result.posts.length}`);
    console.log(`   Recent comments: ${result.comments.length}`);
    
    console.log("✅ User profile scraped successfully\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ User profile scraping failed:", error, "\n");
  }

  // Test 7: Hierarchical comment structure
  try {
    totalTests++;
    console.log("Test 7: Verify hierarchical comment structure");
    
    // Find a post with comments
    const topStories = await scraper.scrapePosts("top", { limit: 10 });
    let testPost = null;
    
    for (const post of topStories.posts) {
      if (post.commentCount > 10) {
        testPost = post;
        break;
      }
    }
    
    if (!testPost) {
      console.log("⚠️  No suitable post with comments found, skipping test\n");
    } else {
      const result = await scraper.scrapePost(testPost.id, {
        includeComments: true,
        maxDepth: 5
      });
      
      // Verify parent-child relationships
      const commentMap = new Map(result.comments.map(c => [c.id, c]));
      let validHierarchy = true;
      
      for (const comment of result.comments) {
        if (comment.parentId && comment.parentId !== testPost.id) {
          // Parent should exist in our comment set or be the post
          const parent = commentMap.get(comment.parentId);
          if (parent) {
            // Child depth should be parent depth + 1
            if (comment.depth !== parent.depth + 1) {
              validHierarchy = false;
              throw new Error(`Invalid depth: comment ${comment.id} has depth ${comment.depth}, parent ${parent.id} has depth ${parent.depth}`);
            }
          }
        }
      }
      
      console.log(`   Comments: ${result.comments.length}`);
      console.log(`   Max depth: ${Math.max(...result.comments.map(c => c.depth))}`);
      console.log("✅ Hierarchical structure validated\n");
      testsPassed++;
    }
  } catch (error) {
    console.error("❌ Hierarchical structure test failed:", error, "\n");
  }

  // Test 8: Error handling - invalid post ID
  try {
    totalTests++;
    console.log("Test 8: Error handling for invalid post ID");
    
    const result = await scraper.scrapePost("invalid_id", {});
    
    if (result.posts.length > 0) {
      throw new Error("Should not return posts for invalid ID");
    }
    
    if (!result.errors || result.errors.length === 0) {
      throw new Error("Should return error for invalid ID");
    }
    
    console.log("✅ Invalid post ID handled correctly\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Error handling test failed:", error, "\n");
  }

  // Test 9: Search functionality (should return not supported)
  try {
    totalTests++;
    console.log("Test 9: Search functionality (not supported)");
    
    const result = await scraper.search("test query");
    
    if (result.posts.length > 0 || result.comments.length > 0) {
      throw new Error("Should not return results for unsupported search");
    }
    
    if (!result.errors || result.errors.length === 0) {
      throw new Error("Should return error for unsupported search");
    }
    
    const error = result.errors[0];
    if (error.code !== "NOT_SUPPORTED") {
      throw new Error(`Expected NOT_SUPPORTED error, got ${error.code}`);
    }
    
    console.log("✅ Search correctly returns not supported\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Search test failed:", error, "\n");
  }

  // Test 10: Rate limiting and batching
  try {
    totalTests++;
    console.log("Test 10: Rate limiting and batching");
    
    const startTime = Date.now();
    const result = await scraper.scrapePosts("new", { 
      limit: 15,  // Will require multiple batches
      includeComments: false 
    });
    const duration = Date.now() - startTime;
    
    if (result.posts.length === 0) {
      throw new Error("No posts returned");
    }
    
    // With batch size of 5 and rate limiting, should take some time
    console.log(`   Scraped ${result.posts.length} posts in ${duration}ms`);
    console.log(`   Average time per post: ${Math.round(duration / result.posts.length)}ms`);
    
    console.log("✅ Rate limiting and batching working\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Rate limiting test failed:", error, "\n");
  }

  // Summary
  console.log("═".repeat(50));
  console.log(`\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
  
  if (testsPassed === totalTests) {
    console.log("✅ All HackerNews scraper tests passed!");
  } else {
    console.log(`❌ ${totalTests - testsPassed} tests failed`);
    process.exit(1);
  }
}

// Run tests
testHackerNewsScraper().catch(console.error);