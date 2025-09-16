#!/usr/bin/env npx tsx
/**
 * Module integration tests for session module index exports
 */

// Test importing from the main index file
import {
  // Core classes
  SessionManager,
  SessionStateManager,
  ProgressTracker,
  
  // Types and interfaces
  type SessionConfig,
  type SessionEvents,
  type SessionState,
  type SessionStatus,
  type ProgressUpdate,
  type ProgressMilestone
} from "./src/session/index.js";

async function testSessionModuleIntegration() {
  console.log("Testing Session Module Integration...\n");
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Core Classes Export
  console.log("Test 1: Core Classes Export");
  try {
    // Verify SessionManager is exported and constructable
    const manager = new SessionManager();
    console.assert(manager instanceof SessionManager, "SessionManager should be constructable");
    
    // Verify SessionStateManager is exported and constructable
    const stateManager = new SessionStateManager();
    console.assert(stateManager instanceof SessionStateManager, "SessionStateManager should be constructable");
    
    // Verify ProgressTracker is exported and constructable
    const progressTracker = new ProgressTracker();
    console.assert(progressTracker instanceof ProgressTracker, "ProgressTracker should be constructable");
    
    manager.destroy();
    progressTracker.destroy();
    
    console.log("✓ All core classes exported correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 1 failed:", error);
    testsFailed++;
  }
  
  // Test 2: Type Exports
  console.log("\nTest 2: Type Exports");
  try {
    // Create objects using the exported types
    const config: SessionConfig = {
      platform: "reddit",
      queryType: "subreddit",
      queryValue: "programming",
      maxItems: 100,
      includeComments: true,
      includeUsers: false,
    };
    
    const status: SessionStatus = "running";
    
    const progressUpdate: ProgressUpdate = {
      sessionId: "test-1",
      timestamp: new Date(),
      type: "item",
      current: 50,
      total: 100,
      percentage: 50,
      itemsPerSecond: 2.5,
      estimatedTimeRemaining: 20,
    };
    
    const milestone: ProgressMilestone = {
      threshold: 50,
      reached: true,
      reachedAt: new Date(),
      message: "Halfway complete",
    };
    
    console.assert(config.platform === "reddit", "SessionConfig type should work");
    console.assert(status === "running", "SessionStatus type should work");
    console.assert(progressUpdate.current === 50, "ProgressUpdate type should work");
    console.assert(milestone.threshold === 50, "ProgressMilestone type should work");
    
    console.log("✓ All type exports working correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 2 failed:", error);
    testsFailed++;
  }
  
  // Test 3: Integration Usage
  console.log("\nTest 3: Integration Usage");
  try {
    const manager = new SessionManager();
    
    // Test the complete flow using imported components
    const session = await manager.createSession({
      platform: "hackernews",
      maxItems: 50,
    });
    
    console.assert(session.id !== undefined, "Session should have ID");
    console.assert(session.platform === "hackernews", "Platform should match");
    console.assert(session.status === "pending", "Initial status should be pending");
    
    await manager.startSession(session.id);
    
    // Update progress
    manager.updateProgress(session.id, 25, 50);
    const progress = manager.getProgress(session.id);
    console.assert(progress.includes("25 items"), "Progress should be tracked");
    
    await manager.completeSession(session.id);
    
    const completedSession = manager.getSession(session.id);
    console.assert(completedSession?.status === "completed", "Session should be completed");
    
    manager.destroy();
    
    console.log("✓ Integration usage working correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 3 failed:", error);
    testsFailed++;
  }
  
  // Test 4: Event System
  console.log("\nTest 4: Event System");
  try {
    const manager = new SessionManager();
    
    let eventFired = false;
    
    // Test SessionEvents type by setting up listeners
    manager.on("session:created", (session: SessionState) => {
      eventFired = true;
      console.assert(session.id !== undefined, "Event should pass session state");
    });
    
    const session = await manager.createSession({
      platform: "discourse",
      maxItems: 10,
    });
    
    console.assert(eventFired, "Session created event should fire");
    
    manager.destroy();
    
    console.log("✓ Event system working correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 4 failed:", error);
    testsFailed++;
  }
  
  // Test 5: Module Completeness
  console.log("\nTest 5: Module Completeness");
  try {
    // Verify all expected exports are available
    console.assert(typeof SessionManager === "function", "SessionManager should be exported");
    console.assert(typeof SessionStateManager === "function", "SessionStateManager should be exported");
    console.assert(typeof ProgressTracker === "function", "ProgressTracker should be exported");
    
    // Create instances to verify they have expected methods
    const manager = new SessionManager();
    console.assert(typeof manager.createSession === "function", "SessionManager should have createSession");
    console.assert(typeof manager.startSession === "function", "SessionManager should have startSession");
    console.assert(typeof manager.pauseSession === "function", "SessionManager should have pauseSession");
    console.assert(typeof manager.resumeSession === "function", "SessionManager should have resumeSession");
    console.assert(typeof manager.completeSession === "function", "SessionManager should have completeSession");
    
    const stateManager = new SessionStateManager();
    console.assert(typeof stateManager.createSession === "function", "SessionStateManager should have createSession");
    console.assert(typeof stateManager.updateStatus === "function", "SessionStateManager should have updateStatus");
    console.assert(typeof stateManager.serialize === "function", "SessionStateManager should have serialize");
    
    const tracker = new ProgressTracker();
    console.assert(typeof tracker.startTracking === "function", "ProgressTracker should have startTracking");
    console.assert(typeof tracker.updateProgress === "function", "ProgressTracker should have updateProgress");
    console.assert(typeof tracker.formatProgress === "function", "ProgressTracker should have formatProgress");
    
    manager.destroy();
    tracker.destroy();
    
    console.log("✓ Module exports are complete");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 5 failed:", error);
    testsFailed++;
  }
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log("\n✅ All session module integration tests passed!");
    process.exit(0);
  } else {
    console.log(`\n❌ ${testsFailed} tests failed`);
    process.exit(1);
  }
}

// Run tests
testSessionModuleIntegration().catch(console.error);