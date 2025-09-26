#!/usr/bin/env npx tsx

import { PlatformRegistry } from "./src/platforms/platform-registry.js";
import { PlatformFactory } from "./src/platforms/platform-factory.js";
import { HackerNewsPlatform } from "./src/platforms/hackernews/index.js";

/**
 * Platform registration and discovery tests for HackerNews
 */
async function testHackerNewsPlatform() {
  console.log("🧪 Testing HackerNews Platform Registration and Discovery\n");

  let testsPassed = 0;
  let totalTests = 0;

  // Test 1: Direct platform registration
  try {
    totalTests++;
    console.log("Test 1: Direct platform registration");
    
    // Clear registry first
    PlatformRegistry.clear();
    
    // Register HackerNews platform directly
    PlatformRegistry.register("hackernews", HackerNewsPlatform, {
      version: "1.0.0",
      description: "Hacker News platform scraper",
      author: "fscrape",
    });
    
    if (!PlatformRegistry.has("hackernews")) {
      throw new Error("Platform not registered");
    }
    
    const platforms = PlatformRegistry.list();
    if (!platforms.includes("hackernews")) {
      throw new Error("Platform not in list");
    }
    
    console.log("✅ Direct registration successful\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Direct registration failed:", error, "\n");
  }

  // Test 2: Get platform metadata
  try {
    totalTests++;
    console.log("Test 2: Get platform metadata");
    
    const metadata = PlatformRegistry.getMetadata("hackernews");
    
    if (!metadata) {
      throw new Error("Metadata not found");
    }
    
    if (metadata.name !== "hackernews") {
      throw new Error(`Name mismatch: ${metadata.name}`);
    }
    
    if (metadata.version !== "1.0.0") {
      throw new Error(`Version mismatch: ${metadata.version}`);
    }
    
    if (!metadata.capabilities) {
      throw new Error("Capabilities missing");
    }
    
    console.log(`   Platform: ${metadata.name}`);
    console.log(`   Version: ${metadata.version}`);
    console.log(`   Description: ${metadata.description}`);
    console.log("✅ Metadata retrieved successfully\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Metadata retrieval failed:", error, "\n");
  }

  // Test 3: Platform capabilities
  try {
    totalTests++;
    console.log("Test 3: Platform capabilities");
    
    const metadata = PlatformRegistry.getMetadata("hackernews");
    const capabilities = metadata?.capabilities;
    
    if (!capabilities) {
      throw new Error("Capabilities not found");
    }
    
    if (!capabilities.supportsCommentThreads) {
      throw new Error("Should support comment threads");
    }
    
    if (!capabilities.supportsUserProfiles) {
      throw new Error("Should support user profiles");
    }
    
    if (capabilities.supportsSearch) {
      throw new Error("Should not support native search");
    }
    
    console.log("   Capabilities:");
    console.log(`   - Comment threads: ${capabilities.supportsCommentThreads}`);
    console.log(`   - User profiles: ${capabilities.supportsUserProfiles}`);
    console.log(`   - Native search: ${capabilities.supportsSearch}`);
    console.log(`   - Categories: ${capabilities.supportsCategories}`);
    console.log("✅ Capabilities validated\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Capabilities test failed:", error, "\n");
  }

  // Test 4: Initialize with async registry
  try {
    totalTests++;
    console.log("Test 4: Initialize with async registry");
    
    // Clear and reinitialize
    PlatformRegistry.clear();
    await PlatformRegistry.initializeAsync();
    
    if (!PlatformRegistry.has("hackernews")) {
      throw new Error("HackerNews not loaded in async init");
    }
    
    const platforms = PlatformRegistry.list();
    console.log(`   Loaded platforms: ${platforms.join(", ")}`);
    
    console.log("✅ Async initialization successful\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Async initialization failed:", error, "\n");
  }

  // Test 5: Create platform via factory
  try {
    totalTests++;
    console.log("Test 5: Create platform via factory");
    
    const platform = await PlatformFactory.create("hackernews", {
      initialize: true,
      useRateLimiter: false,
    });
    
    if (!platform) {
      throw new Error("Platform creation failed");
    }
    
    const capabilities = platform.getCapabilities();
    if (!capabilities) {
      throw new Error("Capabilities not available");
    }
    
    console.log("   Platform created successfully");
    console.log(`   Max comment depth: ${capabilities.maxCommentDepth}`);
    console.log("✅ Factory creation successful\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Factory creation failed:", error, "\n");
  }

  // Test 6: Test platform connection
  try {
    totalTests++;
    console.log("Test 6: Test platform connection");
    
    const connected = await PlatformFactory.testPlatform("hackernews");
    
    if (!connected) {
      throw new Error("Connection test failed");
    }
    
    console.log("✅ Connection test successful\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Connection test failed:", error, "\n");
  }

  // Test 7: List platforms by capability
  try {
    totalTests++;
    console.log("Test 7: List platforms by capability");
    
    const withComments = PlatformRegistry.listByCapability("supportsCommentThreads");
    const withSearch = PlatformRegistry.listByCapability("supportsSearch");
    
    if (!withComments.includes("hackernews")) {
      throw new Error("HackerNews should support comment threads");
    }
    
    if (withSearch.includes("hackernews")) {
      throw new Error("HackerNews should not support native search");
    }
    
    console.log(`   Platforms with comment threads: ${withComments.join(", ")}`);
    console.log(`   Platforms with native search: ${withSearch.join(", ")}`);
    console.log("✅ Capability filtering successful\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Capability filtering failed:", error, "\n");
  }

  // Test 8: Platform requirements
  try {
    totalTests++;
    console.log("Test 8: Platform requirements");
    
    const requirements = PlatformFactory.getPlatformRequirements("hackernews");
    
    if (requirements.required.length !== 0) {
      throw new Error("HackerNews should have no required config");
    }
    
    if (!requirements.optional.includes("baseUrl")) {
      throw new Error("baseUrl should be optional");
    }
    
    console.log(`   Required: ${requirements.required.length === 0 ? "none" : requirements.required.join(", ")}`);
    console.log(`   Optional: ${requirements.optional.join(", ")}`);
    console.log("✅ Requirements validated\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Requirements test failed:", error, "\n");
  }

  // Test 9: Registry statistics
  try {
    totalTests++;
    console.log("Test 9: Registry statistics");
    
    const stats = PlatformRegistry.getStats();
    
    if (stats.total === 0) {
      throw new Error("No platforms registered");
    }
    
    if (!stats.versions.hackernews) {
      throw new Error("HackerNews version not tracked");
    }
    
    console.log(`   Total platforms: ${stats.total}`);
    console.log(`   HackerNews version: ${stats.versions.hackernews}`);
    console.log(`   Platforms with comment threads: ${stats.byCapability.supportsCommentThreads || 0}`);
    console.log("✅ Statistics retrieved successfully\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Statistics test failed:", error, "\n");
  }

  // Test 10: Platform instance scraping
  try {
    totalTests++;
    console.log("Test 10: Platform instance scraping");
    
    const platform = await PlatformFactory.create("hackernews", {
      initialize: true,
    });
    
    // Test scraping via the platform interface
    const result = await platform.scrapePosts("top", { limit: 1 });
    
    if (!result || !result.posts || result.posts.length === 0) {
      throw new Error("No posts scraped");
    }
    
    const post = result.posts[0];
    console.log(`   Scraped post: "${post.title}"`);
    console.log(`   Platform: ${post.platform}`);
    console.log("✅ Platform instance scraping successful\n");
    testsPassed++;
  } catch (error) {
    console.error("❌ Platform instance scraping failed:", error, "\n");
  }

  // Summary
  console.log("═".repeat(50));
  console.log(`\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
  
  if (testsPassed === totalTests) {
    console.log("✅ All HackerNews platform tests passed!");
  } else {
    console.log(`❌ ${totalTests - testsPassed} tests failed`);
    process.exit(1);
  }
}

// Run tests
testHackerNewsPlatform().catch(console.error);