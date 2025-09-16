#!/usr/bin/env npx tsx
/**
 * Session lifecycle integration tests for Task 8.3
 */

import { SessionManager } from "./src/session/session-manager.js";
import { SessionStateManager } from "./src/session/session-state.js";
import { ProgressTracker } from "./src/session/progress-tracker.js";
import type { Platform } from "./src/types/core.js";

async function testSessionLifecycle() {
  console.log("Testing Session Lifecycle Integration...\n");
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Complete Session Lifecycle
  console.log("Test 1: Complete Session Lifecycle");
  try {
    const manager = new SessionManager();
    const events: string[] = [];
    
    // Set up event listeners
    manager.on("session:created", () => events.push("created"));
    manager.on("session:started", () => events.push("started"));
    manager.on("session:paused", () => events.push("paused"));
    manager.on("session:resumed", () => events.push("resumed"));
    manager.on("session:completed", () => events.push("completed"));
    
    // Create session
    const session = await manager.createSession({
      platform: "reddit" as Platform,
      queryType: "subreddit",
      queryValue: "programming",
      maxItems: 100,
    });
    
    console.assert(session.status === "pending", "Initial status should be pending");
    console.assert(events.includes("created"), "Should emit created event");
    
    // Start session
    await manager.startSession(session.id);
    console.assert(events.includes("started"), "Should emit started event");
    
    // Update progress
    manager.updateProgress(session.id, 25, 100);
    const progress1 = manager.getProgress(session.id);
    console.assert(progress1.includes("25 items"), "Progress should show 25 items");
    
    // Pause session
    await manager.pauseSession(session.id);
    console.assert(events.includes("paused"), "Should emit paused event");
    
    // Resume session
    const resumed = await manager.resumeSession(session.id);
    console.assert(resumed.status === "running", "Status should be running after resume");
    console.assert(events.includes("resumed"), "Should emit resumed event");
    
    // Complete session
    manager.updateProgress(session.id, 100, 100);
    await manager.completeSession(session.id);
    console.assert(events.includes("completed"), "Should emit completed event");
    
    manager.destroy();
    console.log("✓ Complete session lifecycle working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 1 failed:", error);
    testsFailed++;
  }
  
  // Test 2: Error Handling and Recovery
  console.log("\nTest 2: Error Handling and Recovery");
  try {
    const manager = new SessionManager();
    
    const session = await manager.createSession({
      platform: "hackernews" as Platform,
      maxItems: 50,
    });
    
    await manager.startSession(session.id);
    manager.updateProgress(session.id, 20, 50);
    
    // Simulate error
    const error = new Error("Network timeout");
    await manager.failSession(session.id, error);
    
    const failedSession = manager.getSession(session.id);
    console.assert(failedSession?.status === "failed", "Status should be failed");
    console.assert(failedSession?.errors.length > 0, "Should have error recorded");
    
    manager.destroy();
    console.log("✓ Error handling and recovery working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 2 failed:", error);
    testsFailed++;
  }
  
  // Test 3: Multiple Concurrent Sessions
  console.log("\nTest 3: Multiple Concurrent Sessions");
  try {
    const manager = new SessionManager();
    
    // Create multiple sessions
    const session1 = await manager.createSession({
      platform: "reddit" as Platform,
      maxItems: 100,
    });
    
    const session2 = await manager.createSession({
      platform: "discourse" as Platform,
      maxItems: 200,
    });
    
    const session3 = await manager.createSession({
      platform: "lemmy" as Platform,
      maxItems: 150,
    });
    
    // Start all sessions
    await manager.startSession(session1.id);
    await manager.startSession(session2.id);
    await manager.startSession(session3.id);
    
    // Update progress independently
    manager.updateProgress(session1.id, 50, 100);
    manager.updateProgress(session2.id, 100, 200);
    manager.updateProgress(session3.id, 75, 150);
    
    const activeSessions = manager.getActiveSessions();
    console.assert(activeSessions.length === 3, "Should have 3 active sessions");
    
    // Pause one session
    await manager.pauseSession(session2.id);
    
    const runningSessions = manager.getSessionsByStatus("running");
    console.assert(runningSessions.length === 2, "Should have 2 running sessions");
    
    const pausedSessions = manager.getSessionsByStatus("paused");
    console.assert(pausedSessions.length === 1, "Should have 1 paused session");
    
    // Complete one session
    manager.updateProgress(session1.id, 100, 100);
    await manager.completeSession(session1.id);
    
    const completedSessions = manager.getSessionsByStatus("completed");
    console.assert(completedSessions.length === 1, "Should have 1 completed session");
    
    manager.destroy();
    console.log("✓ Multiple concurrent sessions working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 3 failed:", error);
    testsFailed++;
  }
  
  // Test 4: Session Cleanup
  console.log("\nTest 4: Session Cleanup");
  try {
    const manager = new SessionManager();
    
    // Create and complete several sessions
    for (let i = 0; i < 5; i++) {
      const session = await manager.createSession({
        platform: "reddit" as Platform,
        maxItems: 10,
      });
      await manager.startSession(session.id);
      manager.updateProgress(session.id, 10, 10);
      await manager.completeSession(session.id);
    }
    
    const beforeCleanup = manager.exportSessions().length;
    console.assert(beforeCleanup >= 5, "Should have at least 5 sessions");
    
    // Clean up old sessions (with 0ms age to clean all completed)
    const cleaned = manager.cleanupOldSessions(0);
    console.assert(cleaned > 0, "Should clean up some sessions");
    
    const afterCleanup = manager.exportSessions().length;
    console.assert(afterCleanup < beforeCleanup, "Should have fewer sessions after cleanup");
    
    manager.destroy();
    console.log("✓ Session cleanup working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 4 failed:", error);
    testsFailed++;
  }
  
  // Test 5: Abort Signal Integration
  console.log("\nTest 5: Abort Signal Integration");
  try {
    const manager = new SessionManager();
    
    const session = await manager.createSession({
      platform: "hackernews" as Platform,
      maxItems: 100,
    });
    
    await manager.startSession(session.id);
    
    const abortSignal = manager.getAbortSignal(session.id);
    console.assert(abortSignal !== undefined, "Should have abort signal");
    console.assert(!abortSignal.aborted, "Signal should not be aborted initially");
    
    // Cancel session (which should abort the signal)
    await manager.cancelSession(session.id);
    
    console.assert(abortSignal.aborted, "Signal should be aborted after cancel");
    
    const cancelledSession = manager.getSession(session.id);
    console.assert(cancelledSession?.status === "cancelled", "Status should be cancelled");
    
    manager.destroy();
    console.log("✓ Abort signal integration working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 5 failed:", error);
    testsFailed++;
  }
  
  // Test 6: Resume Data Persistence
  console.log("\nTest 6: Resume Data Persistence");
  try {
    const manager = new SessionManager();
    
    const session = await manager.createSession({
      platform: "discourse" as Platform,
      maxItems: 100,
    });
    
    await manager.startSession(session.id);
    manager.updateProgress(session.id, 50, 100);
    
    // Update resume data
    manager.updateResumeData(session.id, {
      token: "page_token_123",
      checkpoint: { page: 5, offset: 50 },
      lastSuccessfulItem: "item_50",
      nextUrl: "https://example.com/page6",
    });
    
    await manager.pauseSession(session.id);
    
    const pausedSession = manager.getSession(session.id);
    console.assert(pausedSession?.resumeData?.token === "page_token_123", "Resume token should be saved");
    console.assert(pausedSession?.resumeData?.lastSuccessfulItem === "item_50", "Last item should be saved");
    
    // Simulate resuming with existing session ID
    const resumed = await manager.resumeSession(session.id);
    console.assert(resumed.resumeData?.token === "page_token_123", "Resume data should persist");
    console.assert(resumed.progress.processedItems === 50, "Progress should persist");
    
    manager.destroy();
    console.log("✓ Resume data persistence working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 6 failed:", error);
    testsFailed++;
  }
  
  // Test 7: Metrics Tracking
  console.log("\nTest 7: Metrics Tracking");
  try {
    const manager = new SessionManager();
    
    const session = await manager.createSession({
      platform: "lemmy" as Platform,
      maxItems: 100,
    });
    
    await manager.startSession(session.id);
    
    // Update metrics
    manager.updateMetrics(session.id, {
      averageItemTime: 250,
      totalTime: 5000,
      requestCount: 20,
      rateLimitHits: 2,
    });
    
    const sessionWithMetrics = manager.getSession(session.id);
    console.assert(sessionWithMetrics?.metrics.averageItemTime === 250, "Average time should be updated");
    console.assert(sessionWithMetrics?.metrics.requestCount === 20, "Request count should be updated");
    console.assert(sessionWithMetrics?.metrics.rateLimitHits === 2, "Rate limit hits should be updated");
    
    // Check estimated completion
    manager.updateProgress(session.id, 20, 100);
    const estimatedCompletion = manager.getEstimatedCompletion(session.id);
    console.assert(estimatedCompletion !== null, "Should calculate estimated completion");
    
    manager.destroy();
    console.log("✓ Metrics tracking working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 7 failed:", error);
    testsFailed++;
  }
  
  // Test 8: Export and Import Sessions
  console.log("\nTest 8: Export and Import Sessions");
  try {
    const manager1 = new SessionManager();
    
    // Create sessions in first manager
    const session1 = await manager1.createSession({
      platform: "reddit" as Platform,
      maxItems: 100,
    });
    
    await manager1.startSession(session1.id);
    manager1.updateProgress(session1.id, 50, 100);
    
    // Export sessions
    const exported = manager1.exportSessions();
    console.assert(exported.length > 0, "Should export sessions");
    
    // Create new manager and import
    const manager2 = new SessionManager();
    manager2.importSessions(exported);
    
    const importedSession = manager2.getSession(session1.id);
    console.assert(importedSession !== undefined, "Session should be imported");
    console.assert(importedSession?.progress.processedItems === 50, "Progress should be preserved");
    
    manager1.destroy();
    manager2.destroy();
    console.log("✓ Export and import sessions working");
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
    console.log("\n✅ All session lifecycle integration tests passed!");
    process.exit(0);
  } else {
    console.log(`\n❌ ${testsFailed} tests failed`);
    process.exit(1);
  }
}

// Run tests
testSessionLifecycle().catch(console.error);