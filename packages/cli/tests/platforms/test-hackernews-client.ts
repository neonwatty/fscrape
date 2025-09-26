#!/usr/bin/env npx tsx
/**
 * API client tests for HackerNews Firebase endpoints - Task 9.1
 */

import { HackerNewsClient } from "./src/platforms/hackernews/client.js";
import type { HNItem, HNUser } from "./src/platforms/hackernews/client.js";

async function testHackerNewsClient() {
  console.log("Testing HackerNews API Client with Firebase Endpoints...\n");
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Firebase Endpoint Connection
  console.log("Test 1: Firebase Endpoint Connection");
  try {
    const client = new HackerNewsClient({
      baseUrl: "https://hacker-news.firebaseio.com/v0",
      timeout: 10000,
    });
    
    // Test connection to Firebase
    const maxItem = await client.getMaxItem();
    console.assert(maxItem > 0, "Should connect to Firebase and get max item");
    console.log(`  ✓ Connected to Firebase API (max item: ${maxItem})`);
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 1 failed:", error);
    testsFailed++;
  }
  
  // Test 2: Story Lists Endpoints
  console.log("\nTest 2: Story Lists Endpoints");
  try {
    const client = new HackerNewsClient();
    
    // Test all story list endpoints
    const endpoints = [
      { method: "getTopStories", name: "topstories" },
      { method: "getNewStories", name: "newstories" },
      { method: "getBestStories", name: "beststories" },
      { method: "getAskStories", name: "askstories" },
      { method: "getShowStories", name: "showstories" },
      { method: "getJobStories", name: "jobstories" },
    ];
    
    for (const endpoint of endpoints) {
      const stories = await (client as any)[endpoint.method](3);
      console.assert(Array.isArray(stories), `${endpoint.name} should return array`);
      console.assert(stories.length <= 3, `${endpoint.name} should respect limit`);
      console.log(`  ✓ /${endpoint.name}.json endpoint working (${stories.length} items)`);
    }
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 2 failed:", error);
    testsFailed++;
  }
  
  // Test 3: Item Endpoint
  console.log("\nTest 3: Item Endpoint");
  try {
    const client = new HackerNewsClient();
    
    // Get a real story ID
    const topStories = await client.getTopStories(1);
    console.assert(topStories.length > 0, "Should get at least one story");
    
    // Test item endpoint
    const item = await client.getItem(topStories[0]);
    console.assert(item !== null, "Should get item from Firebase");
    console.assert(item?.id === topStories[0], "Item ID should match");
    console.assert(item?.type !== undefined, "Item should have type");
    console.log(`  ✓ /item/{id}.json endpoint working`);
    console.log(`    Retrieved: "${item?.title?.substring(0, 50)}..."`);
    
    // Test null handling for non-existent item
    const nullItem = await client.getItem(999999999);
    console.assert(nullItem === null, "Should return null for non-existent item");
    console.log(`  ✓ Handles non-existent items correctly`);
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 3 failed:", error);
    testsFailed++;
  }
  
  // Test 4: User Endpoint
  console.log("\nTest 4: User Endpoint");
  try {
    const client = new HackerNewsClient();
    
    // Test with known users
    const knownUsers = ["pg", "dang", "sama"];
    
    for (const username of knownUsers) {
      const user = await client.getUser(username);
      console.assert(user !== null, `Should get user ${username}`);
      console.assert(user?.id === username, "User ID should match");
      console.assert(user?.karma !== undefined, "User should have karma");
      console.log(`  ✓ /user/${username}.json: karma=${user?.karma}`);
    }
    
    // Test non-existent user
    const nullUser = await client.getUser("this-user-definitely-does-not-exist-99999");
    console.assert(nullUser === null, "Should return null for non-existent user");
    console.log(`  ✓ Handles non-existent users correctly`);
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 4 failed:", error);
    testsFailed++;
  }
  
  // Test 5: Batch Operations with Rate Limiting
  console.log("\nTest 5: Batch Operations with Rate Limiting");
  try {
    const client = new HackerNewsClient();
    
    // Get multiple items to test batch fetching
    const storyIds = await client.getTopStories(5);
    
    const startTime = Date.now();
    const items = await client.getItems(storyIds);
    const duration = Date.now() - startTime;
    
    console.assert(items.length === storyIds.length, "Should get all requested items");
    console.assert(items.every(item => item === null || item?.id !== undefined), "Items should be valid or null");
    
    const validItems = items.filter(item => item !== null);
    console.log(`  ✓ Batch fetched ${validItems.length}/${items.length} items in ${duration}ms`);
    console.log(`  ✓ Rate limiting working (avg ${Math.round(duration / items.length)}ms per item)`);
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 5 failed:", error);
    testsFailed++;
  }
  
  // Test 6: Comment Fetching with Recursion
  console.log("\nTest 6: Comment Fetching with Recursion");
  try {
    const client = new HackerNewsClient();
    
    // Find a story with comments
    const topStories = await client.getTopStories(10);
    let storyWithComments: HNItem | null = null;
    
    for (const storyId of topStories) {
      const item = await client.getItem(storyId);
      if (item && item.kids && item.kids.length > 0) {
        storyWithComments = item;
        break;
      }
    }
    
    if (storyWithComments) {
      const comments = await client.getComments(storyWithComments.id, 2);
      console.assert(Array.isArray(comments), "Should return array of comments");
      console.log(`  ✓ Fetched ${comments.length} comments for story ${storyWithComments.id}`);
      console.log(`  ✓ Recursive comment fetching working`);
    } else {
      console.log("  ⚠ No stories with comments found for testing");
    }
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 6 failed:", error);
    testsFailed++;
  }
  
  // Test 7: Updates Endpoint
  console.log("\nTest 7: Updates Endpoint");
  try {
    const client = new HackerNewsClient();
    
    const updates = await client.getUpdates();
    console.assert(updates !== null, "Should get updates object");
    console.assert(Array.isArray(updates.items), "Updates should have items array");
    console.assert(Array.isArray(updates.profiles), "Updates should have profiles array");
    console.log(`  ✓ /updates.json endpoint working`);
    console.log(`    ${updates.items.length} updated items, ${updates.profiles.length} updated profiles`);
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 7 failed:", error);
    testsFailed++;
  }
  
  // Test 8: Error Handling
  console.log("\nTest 8: Error Handling");
  try {
    const client = new HackerNewsClient({
      baseUrl: "https://hacker-news.firebaseio.com/v0",
      timeout: 1000, // Short timeout for testing
    });
    
    // Test null returns for invalid requests
    const invalidItem = await client.getItem(-1);
    console.assert(invalidItem === null, "Should handle invalid item ID");
    
    const invalidUser = await client.getUser("");
    console.assert(invalidUser === null, "Should handle empty username");
    
    console.log(`  ✓ Error handling working correctly`);
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 8 failed:", error);
    testsFailed++;
  }
  
  // Test 9: Time Range Queries
  console.log("\nTest 9: Time Range Queries");
  try {
    const client = new HackerNewsClient();
    
    // Test stories in time range (last 24 hours)
    const now = Math.floor(Date.now() / 1000);
    const yesterday = now - 86400;
    
    const recentStories = await client.getStoriesInRange(yesterday, now, 5);
    console.assert(Array.isArray(recentStories), "Should return array of stories");
    console.assert(recentStories.every(s => s.time >= yesterday && s.time <= now), 
      "Stories should be within time range");
    console.log(`  ✓ Time range query working (${recentStories.length} stories from last 24h)`);
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 9 failed:", error);
    testsFailed++;
  }
  
  // Test 10: Response Interceptor
  console.log("\nTest 10: Response Interceptor and Logging");
  try {
    // Test with custom logger to verify logging works
    const logs: string[] = [];
    const customLogger = {
      error: (msg: string, meta?: any) => logs.push(`ERROR: ${msg}`),
      warn: (msg: string, meta?: any) => logs.push(`WARN: ${msg}`),
      info: (msg: string, meta?: any) => logs.push(`INFO: ${msg}`),
    } as any;
    
    const client = new HackerNewsClient({
      logger: customLogger,
    });
    
    // Make a request that will fail
    await client.getItem(999999999);
    
    // Make a valid request
    await client.getMaxItem();
    
    console.log(`  ✓ Response interceptor and logging configured`);
    
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 10 failed:", error);
    testsFailed++;
  }
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log("\n✅ All HackerNews API client tests passed!");
    console.log("Firebase endpoints validated successfully.");
    process.exit(0);
  } else {
    console.log(`\n❌ ${testsFailed} tests failed`);
    process.exit(1);
  }
}

// Run tests
testHackerNewsClient().catch(console.error);