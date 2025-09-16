import Database from "better-sqlite3";
import { initializeDatabase } from "./src/database/migrations.js";

async function test() {
  const db = new Database(":memory:");
  await initializeDatabase(db);

  // Insert test post
  db.prepare(`
    INSERT INTO forum_posts (
      id, platform, platform_id, title, content, url, 
      author, author_id, score, comment_count, created_at
    ) VALUES (
      'test-1', 'reddit', 'r123', 'Test Post', 'Test content', 
      'https://reddit.com/test', 'testuser', 'u123', 
      500, 50, ${Date.now()}
    )
  `).run();

  // Check generated columns
  const post = db.prepare('SELECT * FROM forum_posts WHERE id = ?').get('test-1') as any;
  console.log('Score:', post.score, 'Comment count:', post.comment_count);
  console.log('score_normalized:', post.score_normalized);
  console.log('engagement_rate:', post.engagement_rate);
  console.log('Expected score_normalized: 0.05');
  console.log('Expected engagement_rate: 0.1');
  
  // Check calculation
  const normalizedCalc = post.score / 10000.0;
  const engagementCalc = post.comment_count / (post.score + 1);
  console.log('Manual calc - normalized:', normalizedCalc, 'engagement:', engagementCalc);

  db.close();
}

test().catch(console.error);