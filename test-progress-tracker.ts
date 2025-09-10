#!/usr/bin/env npx tsx
/**
 * Test suite for enhanced progress tracker with ETA calculations
 */

import { ProgressTracker } from "./src/session/progress-tracker.js";

async function testProgressTracker() {
  console.log("Testing Enhanced Progress Tracker...\n");
  
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Basic Progress Tracking
  console.log("Test 1: Basic Progress Tracking");
  try {
    const tracker = new ProgressTracker({
      enableHistory: true,
    });
    
    tracker.startTracking("test-1", 100);
    
    // Update progress
    const update1 = tracker.updateProgress("test-1", 25, 100);
    console.assert(update1.current === 25, "Current should be 25");
    console.assert(update1.total === 100, "Total should be 100");
    console.assert(update1.percentage === 25, "Percentage should be 25");
    
    // Update again
    const update2 = tracker.updateProgress("test-1", 50);
    console.assert(update2.current === 50, "Current should be 50");
    console.assert(update2.percentage === 50, "Percentage should be 50");
    
    // Stop tracking
    tracker.stopTracking("test-1");
    
    console.log("✓ Basic progress tracking working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 1 failed:", error);
    testsFailed++;
  }
  
  // Test 2: ETA Calculation with Moving Window
  console.log("\nTest 2: ETA Calculation with Moving Window");
  try {
    const tracker = new ProgressTracker();
    tracker.startTracking("test-2", 1000);
    
    // Simulate progress with delays
    const delays = [100, 150, 50, 200, 100]; // Variable processing times
    let processed = 0;
    
    for (const delay of delays) {
      await new Promise(resolve => setTimeout(resolve, delay));
      processed += 100;
      const update = tracker.updateProgress("test-2", processed);
      
      console.assert(update.itemsPerSecond !== undefined, "Should calculate items per second");
      if (processed < 1000) {
        console.assert(update.estimatedTimeRemaining !== undefined, "Should calculate ETA");
      }
    }
    
    tracker.stopTracking("test-2");
    console.log("✓ ETA calculation with moving window working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 2 failed:", error);
    testsFailed++;
  }
  
  // Test 3: Progress Formatting
  console.log("\nTest 3: Progress Formatting");
  try {
    const tracker = new ProgressTracker();
    tracker.startTracking("test-3", 200);
    tracker.updateProgress("test-3", 100);
    
    const formatted = tracker.formatProgress("test-3");
    console.assert(formatted.includes("100 items processed"), "Should include current count");
    console.assert(formatted.includes("of 200"), "Should include total");
    console.assert(formatted.includes("50.0%"), "Should include percentage");
    
    // Test time formatting
    console.assert(tracker.formatTime(30) === "30s", "Should format seconds");
    console.assert(tracker.formatTime(90) === "1m 30s", "Should format minutes and seconds");
    console.assert(tracker.formatTime(3660) === "1h 1m", "Should format hours and minutes");
    console.assert(tracker.formatTime(7200) === "2h", "Should format hours only");
    
    tracker.stopTracking("test-3");
    console.log("✓ Progress formatting working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 3 failed:", error);
    testsFailed++;
  }
  
  // Test 4: Progress Bar
  console.log("\nTest 4: Progress Bar");
  try {
    const tracker = new ProgressTracker();
    tracker.startTracking("test-4", 100);
    
    // 0% progress
    tracker.updateProgress("test-4", 0);
    let bar = tracker.getProgressBar("test-4", 10);
    console.assert(bar === "[          ]", "0% should be empty bar");
    
    // 50% progress
    tracker.updateProgress("test-4", 50);
    bar = tracker.getProgressBar("test-4", 10);
    console.assert(bar === "[█████     ]", "50% should be half filled");
    
    // 100% progress
    tracker.updateProgress("test-4", 100);
    bar = tracker.getProgressBar("test-4", 10);
    console.assert(bar === "[██████████]", "100% should be full bar");
    
    tracker.stopTracking("test-4");
    console.log("✓ Progress bar working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 4 failed:", error);
    testsFailed++;
  }
  
  // Test 5: Milestones
  console.log("\nTest 5: Milestones");
  try {
    const tracker = new ProgressTracker({
      milestones: [25, 50, 75, 100],
    });
    
    const milestones: number[] = [];
    tracker.on("progress:milestone", (data) => {
      milestones.push(data.milestone);
    });
    
    tracker.startTracking("test-5", 100);
    
    // Update to trigger milestones
    tracker.updateProgress("test-5", 25);
    tracker.updateProgress("test-5", 50);
    tracker.updateProgress("test-5", 75);
    tracker.updateProgress("test-5", 100);
    
    console.assert(milestones.length === 4, "Should trigger 4 milestones");
    console.assert(milestones.includes(25), "Should include 25% milestone");
    console.assert(milestones.includes(50), "Should include 50% milestone");
    console.assert(milestones.includes(75), "Should include 75% milestone");
    console.assert(milestones.includes(100), "Should include 100% milestone");
    
    tracker.stopTracking("test-5");
    console.log("✓ Milestone tracking working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 5 failed:", error);
    testsFailed++;
  }
  
  // Test 6: Multiple Sessions
  console.log("\nTest 6: Multiple Sessions");
  try {
    const tracker = new ProgressTracker();
    
    tracker.startTracking("session-1", 100);
    tracker.startTracking("session-2", 200);
    tracker.startTracking("session-3", 300);
    
    tracker.updateProgress("session-1", 50);
    tracker.updateProgress("session-2", 100);
    tracker.updateProgress("session-3", 150);
    
    const allProgress = tracker.getAllProgress();
    console.assert(allProgress.size === 3, "Should track 3 sessions");
    
    const progress1 = allProgress.get("session-1");
    console.assert(progress1?.current === 50, "Session 1 should be at 50");
    console.assert(progress1?.percentage === 50, "Session 1 should be 50%");
    
    const progress2 = allProgress.get("session-2");
    console.assert(progress2?.current === 100, "Session 2 should be at 100");
    console.assert(progress2?.percentage === 50, "Session 2 should be 50%");
    
    tracker.stopTracking("session-1");
    tracker.stopTracking("session-2");
    tracker.stopTracking("session-3");
    
    console.log("✓ Multiple session tracking working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 6 failed:", error);
    testsFailed++;
  }
  
  // Test 7: History Tracking
  console.log("\nTest 7: History Tracking");
  try {
    const tracker = new ProgressTracker({
      enableHistory: true,
    });
    
    tracker.startTracking("test-7", 100);
    
    // Create some history
    for (let i = 10; i <= 50; i += 10) {
      tracker.updateProgress("test-7", i);
    }
    
    const history = tracker.getHistory("test-7");
    console.assert(history.length === 5, "Should have 5 history entries");
    console.assert(history[0].current === 10, "First entry should be 10");
    console.assert(history[4].current === 50, "Last entry should be 50");
    
    tracker.stopTracking("test-7");
    console.log("✓ History tracking working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 7 failed:", error);
    testsFailed++;
  }
  
  // Test 8: Ora Spinner Integration (without actual display)
  console.log("\nTest 8: Ora Spinner Integration");
  try {
    const tracker = new ProgressTracker({
      useSpinner: true,
      spinnerText: "Testing spinner...",
    });
    
    tracker.startTracking("test-8", 100);
    
    // Update progress (spinner text should update)
    tracker.updateProgress("test-8", 50);
    
    // Test spinner control methods
    tracker.pauseSpinner("test-8");
    tracker.resumeSpinner("test-8");
    tracker.updateSpinnerText("test-8", "Custom text");
    
    // Stop with success
    tracker.stopTracking("test-8", true);
    
    // Test failure case
    tracker.startTracking("test-9", 100);
    tracker.updateProgress("test-9", 30);
    tracker.stopTracking("test-9", false);
    
    console.log("✓ Ora spinner integration working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 8 failed:", error);
    testsFailed++;
  }
  
  // Test 9: Event Emissions
  console.log("\nTest 9: Event Emissions");
  try {
    const tracker = new ProgressTracker();
    
    let startedFired = false;
    let updateFired = false;
    let stoppedFired = false;
    
    tracker.on("tracking:started", () => { startedFired = true; });
    tracker.on("progress:update", () => { updateFired = true; });
    tracker.on("tracking:stopped", () => { stoppedFired = true; });
    
    tracker.startTracking("test-10", 100);
    tracker.updateProgress("test-10", 50);
    tracker.stopTracking("test-10");
    
    console.assert(startedFired, "Should emit tracking:started");
    console.assert(updateFired, "Should emit progress:update");
    console.assert(stoppedFired, "Should emit tracking:stopped");
    
    console.log("✓ Event emissions working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 9 failed:", error);
    testsFailed++;
  }
  
  // Summary
  console.log("\n" + "=".repeat(50));
  console.log(`Tests Passed: ${testsPassed}`);
  console.log(`Tests Failed: ${testsFailed}`);
  
  if (testsFailed === 0) {
    console.log("\n✅ All progress tracker tests passed!");
    process.exit(0);
  } else {
    console.log(`\n❌ ${testsFailed} tests failed`);
    process.exit(1);
  }
}

// Run tests
testProgressTracker().catch(console.error);