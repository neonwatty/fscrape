import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new Database(':memory:');

// Load schema
const schema = fs.readFileSync(path.join(__dirname, 'src/database/schema.sql'), 'utf8');
db.exec(schema);

// Create the statement
const insertSession = db.prepare(`
  INSERT INTO scraping_sessions (
    platform, status, query_type, query_value,
    total_items_target, total_items_scraped,
    started_at, last_activity_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?
  )
`);

// Try to insert
try {
  const now = Date.now();
  console.log('Now timestamp:', now);
  console.log('Type of now:', typeof now);
  
  const result = insertSession.run(
    'reddit',
    'in_progress',
    'subreddit',
    'programming',
    null,
    0,
    now,
    now
  );
  
  console.log('Success!', result);
} catch (error) {
  console.error('Error:', error.message);
  console.error('Stack:', error.stack);
}