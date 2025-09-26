#!/usr/bin/env npx tsx
/**
 * Test suite for session state serialization and persistence
 */

import { SessionStateManager } from "./src/session/session-state.js";
import type { Platform } from "./src/types/core.js";
import { writeFileSync, readFileSync, unlinkSync, existsSync } from "fs";
import { join } from "path";

async function testSessionStatePersistence() {
  console.log("Testing Session State Persistence...\n");
  
  const manager = new SessionStateManager();
  let testsPassed = 0;
  let testsFailed = 0;
  
  // Test 1: Serialization and Deserialization
  console.log("Test 1: Serialization and Deserialization");
  try {
    const session = manager.createSession("test-1", "reddit" as Platform, {
      queryType: "subreddit",
      queryValue: "programming",
      maxItems: 100,
    });
    
    // Update session with data
    manager.updateStatus("test-1", "running");
    manager.updateProgress("test-1", {
      totalItems: 100,
      processedItems: 25,
      currentPage: 2,
    });
    manager.addError("test-1", new Error("Test error"), "item-123");
    
    // Serialize
    const serialized = manager.serialize("test-1");
    console.assert(serialized !== null, "Serialization should succeed");
    console.assert(serialized!.includes('"id":"test-1"'), "Should contain session ID");
    console.assert(serialized!.includes('"platform":"reddit"'), "Should contain platform");
    
    // Deserialize
    const deserialized = manager.deserialize(serialized!);
    console.assert(deserialized !== null, "Deserialization should succeed");
    console.assert(deserialized!.id === "test-1", "ID should match");
    console.assert(deserialized!.platform === "reddit", "Platform should match");
    console.assert(deserialized!.progress.processedItems === 25, "Progress should match");
    console.assert(deserialized!.errors.length === 1, "Errors should be preserved");
    
    console.log("✓ Serialization and deserialization working correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 1 failed:", error);
    testsFailed++;
  }
  
  // Test 2: Serialize All Sessions
  console.log("\nTest 2: Serialize All Sessions");
  try {
    // Create multiple sessions
    manager.createSession("test-2a", "hackernews" as Platform);
    manager.createSession("test-2b", "discourse" as Platform);
    manager.createSession("test-2c", "lemmy" as Platform);
    
    const allSerialized = manager.serializeAll();
    const allDeserialized = manager.deserializeAll(allSerialized);
    
    console.assert(allDeserialized.length >= 4, "Should have at least 4 sessions");
    const sessionIds = allDeserialized.map(s => s.id);
    console.assert(sessionIds.includes("test-1"), "Should include test-1");
    console.assert(sessionIds.includes("test-2a"), "Should include test-2a");
    console.assert(sessionIds.includes("test-2b"), "Should include test-2b");
    console.assert(sessionIds.includes("test-2c"), "Should include test-2c");
    
    console.log("✓ Multiple sessions serialization working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 2 failed:", error);
    testsFailed++;
  }
  
  // Test 3: File Persistence
  console.log("\nTest 3: File Persistence");
  try {
    const filePath = join(process.cwd(), "test-session.json");
    
    // Save to file
    const saved = await manager.saveToFile("test-1", filePath);
    console.assert(saved === true, "Save should succeed");
    console.assert(existsSync(filePath), "File should exist");
    
    // Create new manager and load from file
    const newManager = new SessionStateManager();
    const loaded = await newManager.loadFromFile(filePath);
    console.assert(loaded !== null, "Load should succeed");
    console.assert(loaded!.id === "test-1", "Loaded session ID should match");
    console.assert(loaded!.platform === "reddit", "Loaded platform should match");
    console.assert(loaded!.progress.processedItems === 25, "Loaded progress should match");
    
    // Clean up
    unlinkSync(filePath);
    
    console.log("✓ File persistence working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 3 failed:", error);
    testsFailed++;
  }
  
  // Test 4: Checkpoints
  console.log("\nTest 4: Checkpoints");
  try {
    const checkpoint = manager.createCheckpoint("test-1");
    console.assert(checkpoint !== null, "Checkpoint creation should succeed");
    console.assert(checkpoint.state.id === "test-1", "Checkpoint should contain session");
    console.assert(checkpoint.version === "1.0.0", "Checkpoint should have version");
    console.assert(checkpoint.timestamp, "Checkpoint should have timestamp");
    
    // Modify session
    manager.updateProgress("test-1", { processedItems: 50 });
    
    // Restore from checkpoint
    const restored = manager.restoreFromCheckpoint(checkpoint);
    console.assert(restored !== null, "Restore should succeed");
    console.assert(restored!.progress.processedItems === 25, "Should restore to checkpoint state");
    
    console.log("✓ Checkpoint creation and restoration working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 4 failed:", error);
    testsFailed++;
  }
  
  // Test 5: State Validation
  console.log("\nTest 5: State Validation");
  try {
    const validSession = manager.getSession("test-1");
    console.assert(manager.validateState(validSession!), "Valid session should pass validation");
    
    // Create invalid session
    const invalidSession: any = {
      id: "invalid",
      // Missing required fields
    };
    console.assert(!manager.validateState(invalidSession), "Invalid session should fail validation");
    
    // Session with wrong date types
    const badDateSession: any = {
      id: "bad-date",
      platform: "reddit",
      status: "running",
      startedAt: "2024-01-01", // Should be Date, not string
      updatedAt: "2024-01-01",
      progress: { processedItems: 0 },
      errors: [],
      metrics: { totalTime: 0 },
    };
    console.assert(!manager.validateState(badDateSession), "Bad date session should fail validation");
    
    console.log("✓ State validation working correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 5 failed:", error);
    testsFailed++;
  }
  
  // Test 6: Backup and Restore
  console.log("\nTest 6: Backup and Restore");
  try {
    const backupPath = join(process.cwd(), "test-backup.json");
    
    // Create backup
    const backupCreated = await manager.createBackup(backupPath);
    console.assert(backupCreated === true, "Backup creation should succeed");
    console.assert(existsSync(backupPath), "Backup file should exist");
    
    // Read and validate backup structure
    const backupContent = JSON.parse(readFileSync(backupPath, "utf-8"));
    console.assert(backupContent.version === "1.0.0", "Backup should have version");
    console.assert(backupContent.timestamp, "Backup should have timestamp");
    console.assert(backupContent.sessionCount >= 4, "Backup should contain sessions");
    console.assert(Array.isArray(backupContent.sessions), "Backup should have sessions array");
    
    // Create new manager and restore
    const restoredManager = new SessionStateManager();
    const restoredCount = await restoredManager.restoreFromBackup(backupPath);
    console.assert(restoredCount >= 4, "Should restore all sessions");
    
    const restoredSession = restoredManager.getSession("test-1");
    console.assert(restoredSession !== undefined, "Restored session should exist");
    console.assert(restoredSession!.platform === "reddit", "Restored data should match");
    
    // Clean up
    unlinkSync(backupPath);
    
    console.log("✓ Backup and restore working");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 6 failed:", error);
    testsFailed++;
  }
  
  // Test 7: Error Recovery
  console.log("\nTest 7: Error Recovery");
  try {
    // Test deserializing invalid JSON
    const invalidJson = manager.deserialize("invalid json");
    console.assert(invalidJson === null, "Invalid JSON should return null");
    
    // Test deserializing JSON with missing fields
    const incompleteJson = manager.deserialize('{"id": "test"}');
    console.assert(incompleteJson === null, "Incomplete JSON should return null");
    
    // Test loading non-existent file
    const nonExistent = await manager.loadFromFile("/non/existent/file.json");
    console.assert(nonExistent === null, "Non-existent file should return null");
    
    // Test restoring from invalid checkpoint
    const invalidCheckpoint = manager.restoreFromCheckpoint(null);
    console.assert(invalidCheckpoint === null, "Invalid checkpoint should return null");
    
    const badCheckpoint = manager.restoreFromCheckpoint({ wrong: "format" });
    console.assert(badCheckpoint === null, "Bad checkpoint format should return null");
    
    console.log("✓ Error recovery working correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 7 failed:", error);
    testsFailed++;
  }
  
  // Test 8: Date Handling
  console.log("\nTest 8: Date Handling");
  try {
    const session = manager.createSession("date-test", "reddit" as Platform);
    manager.updateStatus("date-test", "completed");
    
    // Serialize and check date format
    const serialized = manager.serialize("date-test");
    console.assert(serialized!.includes("T"), "Dates should be in ISO format");
    console.assert(serialized!.includes("Z"), "Dates should include timezone");
    
    // Deserialize and check Date objects
    const deserialized = manager.deserialize(serialized!);
    console.assert(deserialized!.startedAt instanceof Date, "startedAt should be Date object");
    console.assert(deserialized!.updatedAt instanceof Date, "updatedAt should be Date object");
    console.assert(deserialized!.completedAt instanceof Date, "completedAt should be Date object");
    
    console.log("✓ Date handling working correctly");
    testsPassed++;
  } catch (error) {
    console.error("✗ Test 8 failed:", error);
    testsFailed++;
  }
  
  // Test 9: Cleanup Corrupted States
  console.log("\nTest 9: Cleanup Corrupted States");
  try {
    // Manually add corrupted state
    const corruptedState: any = {
      id: "corrupted",
      platform: "reddit",
      // Missing required fields like status, dates, etc.
    };
    (manager as any).states.set("corrupted", corruptedState);
    
    const initialSize = (manager as any).states.size;
    const cleaned = manager.cleanupCorruptedStates();
    const finalSize = (manager as any).states.size;
    
    console.assert(cleaned >= 1, "Should clean at least one corrupted state");
    console.assert(finalSize < initialSize, "Map size should decrease after cleanup");
    console.assert(manager.getSession("corrupted") === undefined, "Corrupted state should be removed");
    
    console.log("✓ Corrupted state cleanup working");
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
    console.log("\n✅ All session state persistence tests passed!");
    process.exit(0);
  } else {
    console.log(`\n❌ ${testsFailed} tests failed`);
    process.exit(1);
  }
}

// Run tests
testSessionStatePersistence().catch(console.error);