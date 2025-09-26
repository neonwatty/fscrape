// Test file for SQL.js database loader
import {
  initializeDatabase,
  createEmptyDatabase,
  loadDatabaseFromData,
  closeDatabase,
} from './sql-loader';

export async function testDatabaseLoader() {
  console.log('Testing SQL.js Database Loader...');

  // Test 1: Create empty database
  console.log('\nTest 1: Creating empty database...');
  try {
    const emptyDb = await createEmptyDatabase();
    console.log('✅ Empty database created successfully');
    emptyDb.close();
  } catch (error) {
    console.error('❌ Failed to create empty database:', error);
  }

  // Test 2: Initialize with missing file (should handle gracefully)
  console.log('\nTest 2: Testing missing file handling...');
  try {
    closeDatabase(); // Ensure clean state
    const _db = await initializeDatabase({ databasePath: '/.fscrape/nonexistent.db' });
    console.log('✅ Handled missing file gracefully, created new database');
    closeDatabase();
  } catch (error) {
    console.error('❌ Failed to handle missing file:', error);
  }

  // Test 3: Test schema validation
  console.log('\nTest 3: Testing schema validation...');
  try {
    const db = await createEmptyDatabase();
    const data = db.export();
    db.close();

    const _loadedDb = await loadDatabaseFromData(data, { validateSchema: true });
    console.log('✅ Schema validation passed');
    closeDatabase();
  } catch (error) {
    console.error('❌ Schema validation failed:', error);
  }

  // Test 4: Test corrupted data handling
  console.log('\nTest 4: Testing corrupted data handling...');
  try {
    const corruptedData = new Uint8Array([1, 2, 3, 4, 5]); // Invalid SQLite data
    await loadDatabaseFromData(corruptedData);
    console.error('❌ Should have thrown error for corrupted data');
  } catch {
    console.log('✅ Correctly rejected corrupted data');
  }

  console.log('\n✅ All database loader tests completed!');
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as any).testDatabaseLoader = testDatabaseLoader;
}
