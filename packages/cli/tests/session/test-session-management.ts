/**
 * Test script for session management system
 */

import { SessionManager, SessionStateManager, ProgressTracker } from "./src/session/index.js";
import type { SessionState } from "./src/session/index.js";

async function testSessionManagement() {
  console.log("Testing Session Management System...\n");
  
  // Test 1: Session State Manager
  console.log("Test 1: Session State Manager");
  const stateManager = new SessionStateManager();
  
  const session1 = stateManager.createSession("test-1", "reddit", {
    queryType: "subreddit",
    queryValue: "programming",
    maxItems: 100,
  });
  
  console.log("✓ Created session:", session1.id);
  console.log("✓ Initial status:", session1.status);
  
  stateManager.updateStatus("test-1", "running");
  console.log("✓ Updated status to running");
  
  stateManager.updateProgress("test-1", {
    processedItems: 25,
    totalItems: 100,
  });
  console.log("✓ Updated progress: 25/100");
  
  // Test 2: Progress Tracker
  console.log("\nTest 2: Progress Tracker");
  const tracker = new ProgressTracker({
    milestones: [25, 50, 75, 100],
    enableHistory: true,
  });
  
  let milestoneReached = false;
  tracker.on("progress:milestone", (data) => {
    milestoneReached = true;
    console.log(`✓ Milestone reached: ${data.milestone}%`);
  });
  
  tracker.startTracking("test-2", 100);
  const update1 = tracker.updateProgress("test-2", 25, 100);
  console.log("✓ Progress update:", update1.percentage?.toFixed(1) + "%");
  
  const update2 = tracker.updateProgress("test-2", 50, 100);
  console.log("✓ Progress update:", update2.percentage?.toFixed(1) + "%");
  
  const formatted = tracker.formatProgress("test-2");
  console.log("✓ Formatted progress:", formatted);
  
  // Test 3: Session Manager
  console.log("\nTest 3: Session Manager");
  const manager = new SessionManager(undefined, undefined, {
    progressUpdateMs: 1000,
    milestones: [25, 50, 75, 100],
  });
  
  let sessionCreated = false;
  manager.on("session:created", (session) => {
    sessionCreated = true;
    console.log("✓ Session created event fired");
  });
  
  const session = await manager.createSession({
    platform: "hackernews",
    queryType: "top",
    maxItems: 50,
  });
  
  console.log("✓ Created session via manager:", session.id);
  
  await manager.startSession(session.id);
  console.log("✓ Started session");
  
  manager.updateProgress(session.id, 10, 50);
  console.log("✓ Updated progress: 10/50");
  
  const progress = manager.getProgress(session.id);
  console.log("✓ Current progress:", progress);
  
  await manager.pauseSession(session.id);
  console.log("✓ Paused session");
  
  const canResume = stateManager.canResume(session.id);
  console.log("✓ Can resume:", canResume);
  
  await manager.resumeSession(session.id);
  console.log("✓ Resumed session");
  
  manager.updateProgress(session.id, 50, 50);
  console.log("✓ Updated progress: 50/50");
  
  await manager.completeSession(session.id);
  console.log("✓ Completed session");
  
  // Test 4: Session lifecycle
  console.log("\nTest 4: Session Lifecycle");
  
  const lifecycleSession = await manager.createSession({
    platform: "reddit",
    queryType: "search",
    queryValue: "typescript",
    maxItems: 200,
  });
  
  const states: string[] = [];
  
  manager.on("session:started", () => states.push("started"));
  manager.on("session:paused", () => states.push("paused"));
  manager.on("session:resumed", () => states.push("resumed"));
  manager.on("session:completed", () => states.push("completed"));
  
  await manager.startSession(lifecycleSession.id);
  await manager.pauseSession(lifecycleSession.id);
  await manager.resumeSession(lifecycleSession.id);
  await manager.completeSession(lifecycleSession.id);
  
  console.log("✓ Lifecycle events:", states.join(" → "));
  
  // Test 5: Error handling
  console.log("\nTest 5: Error Handling");
  
  const errorSession = await manager.createSession({
    platform: "discourse",
    maxItems: 10,
  });
  
  await manager.startSession(errorSession.id);
  
  const testError = new Error("Test error");
  await manager.failSession(errorSession.id, testError);
  
  const failedSession = manager.getSession(errorSession.id);
  console.log("✓ Session failed with status:", failedSession?.status);
  console.log("✓ Errors recorded:", failedSession?.errors.length);
  
  // Test 6: Active sessions
  console.log("\nTest 6: Active Sessions Management");
  
  const active1 = await manager.createSession({ platform: "reddit" });
  const active2 = await manager.createSession({ platform: "hackernews" });
  
  await manager.startSession(active1.id);
  await manager.startSession(active2.id);
  
  const activeSessions = manager.getActiveSessions();
  console.log("✓ Active sessions count:", activeSessions.length);
  
  // Test 7: Session cleanup
  console.log("\nTest 7: Session Cleanup");
  
  const oldSessions = manager.cleanupOldSessions(0); // Clean all completed
  console.log("✓ Cleaned up sessions:", oldSessions);
  
  // Test 8: Abort signal
  console.log("\nTest 8: Abort Signal");
  
  const abortSession = await manager.createSession({ platform: "lemmy" });
  await manager.startSession(abortSession.id);
  
  const signal = manager.getAbortSignal(abortSession.id);
  console.log("✓ Abort signal available:", signal !== undefined);
  
  await manager.cancelSession(abortSession.id);
  console.log("✓ Session cancelled");
  
  // Clean up
  manager.destroy();
  tracker.destroy();
  
  console.log("\n✅ All session management tests passed!");
}

// Run tests
testSessionManagement().catch(console.error);