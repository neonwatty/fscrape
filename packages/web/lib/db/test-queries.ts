// Test file for database queries
import { createEmptyDatabase, closeDatabase } from './sql-loader';
import {
  getRecentPosts,
  getPostsByHour,
  getTopSources,
  getScrapingSessions,
  getPlatformComparison,
  getPostingHeatmap,
  getAuthorStats,
  getTrendingPosts,
  getEngagementMetrics,
} from './queries';

export async function testQueries() {
  console.log('Testing Database Query System...');

  try {
    // Initialize empty database for testing
    const db = await createEmptyDatabase();

    // Insert test data
    db.run(`
      INSERT INTO posts (id, subreddit, title, author, body, created_utc, score, num_comments, url, permalink, platform)
      VALUES 
        ('1', 'programming', 'Test Post 1', 'user1', 'Test body', ${Math.floor(Date.now() / 1000) - 3600}, 100, 25, 'http://test.com', '/test1', 'reddit'),
        ('2', 'webdev', 'Test Post 2', 'user2', 'Test body 2', ${Math.floor(Date.now() / 1000) - 7200}, 200, 50, 'http://test.com', '/test2', 'reddit'),
        ('3', NULL, 'HN Post', 'hn_user', 'HN body', ${Math.floor(Date.now() / 1000) - 10800}, 150, 30, 'http://test.com', '/test3', 'hackernews')
    `);

    console.log('\n✅ Test data inserted');

    // Test each query function
    console.log('\nTesting query functions:');

    const recent = getRecentPosts(5);
    console.log('✅ getRecentPosts:', recent.length, 'posts');

    const byHour = getPostsByHour(7);
    console.log('✅ getPostsByHour:', byHour.length, 'hour buckets');

    const sources = getTopSources(10);
    console.log('✅ getTopSources:', sources.length, 'sources');

    const sessions = getScrapingSessions(10);
    console.log('✅ getScrapingSessions:', sessions.length, 'sessions');

    const comparison = getPlatformComparison();
    console.log('✅ getPlatformComparison:', comparison.length, 'platforms');

    const heatmap = getPostingHeatmap(30);
    console.log('✅ getPostingHeatmap:', heatmap.length, 'data points');

    const authorStats = getAuthorStats('user1');
    console.log('✅ getAuthorStats:', authorStats ? 'found' : 'not found');

    const trending = getTrendingPosts(5);
    console.log('✅ getTrendingPosts:', trending.length, 'posts');

    const engagement = getEngagementMetrics(30);
    console.log('✅ getEngagementMetrics:', engagement.length, 'metrics');

    console.log('\n✅ All query functions tested successfully!');

    // Clean up
    closeDatabase();
  } catch (error) {
    console.error('❌ Query test failed:', error);
    closeDatabase();
  }
}

// Export for use in browser console
if (typeof window !== 'undefined') {
  (window as unknown as { testQueries: typeof testQueries }).testQueries = testQueries;
}
