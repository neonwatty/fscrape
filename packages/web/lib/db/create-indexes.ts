import { executeQuery } from './sql-loader';

/**
 * Create optimized indexes for the database
 * This should be run when initializing the database
 */
export function createDatabaseIndexes(): void {
  console.log('Creating database indexes for optimization...');

  const indexes = [
    // Single column indexes for common filters
    {
      name: 'idx_platform',
      sql: 'CREATE INDEX IF NOT EXISTS idx_platform ON posts(platform)',
    },
    {
      name: 'idx_subreddit',
      sql: 'CREATE INDEX IF NOT EXISTS idx_subreddit ON posts(subreddit)',
    },
    {
      name: 'idx_author',
      sql: 'CREATE INDEX IF NOT EXISTS idx_author ON posts(author) WHERE author IS NOT NULL',
    },
    {
      name: 'idx_created_utc',
      sql: 'CREATE INDEX IF NOT EXISTS idx_created_utc ON posts(created_utc DESC)',
    },
    {
      name: 'idx_score',
      sql: 'CREATE INDEX IF NOT EXISTS idx_score ON posts(score DESC)',
    },
    {
      name: 'idx_num_comments',
      sql: 'CREATE INDEX IF NOT EXISTS idx_num_comments ON posts(num_comments DESC)',
    },

    // Composite indexes for common query patterns
    {
      name: 'idx_platform_created',
      sql: 'CREATE INDEX IF NOT EXISTS idx_platform_created ON posts(platform, created_utc DESC)',
    },
    {
      name: 'idx_platform_score',
      sql: 'CREATE INDEX IF NOT EXISTS idx_platform_score ON posts(platform, score DESC)',
    },
    {
      name: 'idx_author_created',
      sql: 'CREATE INDEX IF NOT EXISTS idx_author_created ON posts(author, created_utc DESC) WHERE author IS NOT NULL',
    },

    // Covering index for dashboard queries
    {
      name: 'idx_dashboard_covering',
      sql: `CREATE INDEX IF NOT EXISTS idx_dashboard_covering ON posts(
        created_utc DESC, 
        platform, 
        score, 
        num_comments, 
        title, 
        author
      )`,
    },

    // Partial indexes for specific conditions
    {
      name: 'idx_high_score',
      sql: 'CREATE INDEX IF NOT EXISTS idx_high_score ON posts(score DESC) WHERE score > 100',
    },
    {
      name: 'idx_has_comments',
      sql: 'CREATE INDEX IF NOT EXISTS idx_has_comments ON posts(num_comments DESC) WHERE num_comments > 0',
    },

    // Text search optimization
    {
      name: 'idx_title_search',
      sql: 'CREATE INDEX IF NOT EXISTS idx_title_search ON posts(title COLLATE NOCASE)',
    },
  ];

  let successCount = 0;
  let failureCount = 0;

  indexes.forEach(({ name, sql }) => {
    try {
      executeQuery(sql);
      console.log(`✅ Created index: ${name}`);
      successCount++;
    } catch (error) {
      console.error(`❌ Failed to create index ${name}:`, error);
      failureCount++;
    }
  });

  // Update database statistics
  try {
    executeQuery('ANALYZE');
    console.log('✅ Updated database statistics with ANALYZE');
  } catch (error) {
    console.error('❌ Failed to run ANALYZE:', error);
  }

  console.log(`
Index creation complete:
- Successfully created: ${successCount} indexes
- Failed: ${failureCount} indexes
  `);
}

/**
 * Drop all custom indexes (useful for testing)
 */
export function dropDatabaseIndexes(): void {
  const indexNames = [
    'idx_platform',
    'idx_subreddit',
    'idx_author',
    'idx_created_utc',
    'idx_score',
    'idx_num_comments',
    'idx_platform_created',
    'idx_platform_score',
    'idx_author_created',
    'idx_dashboard_covering',
    'idx_high_score',
    'idx_has_comments',
    'idx_title_search',
  ];

  indexNames.forEach((name) => {
    try {
      executeQuery(`DROP INDEX IF EXISTS ${name}`);
      console.log(`Dropped index: ${name}`);
    } catch (error) {
      console.error(`Failed to drop index ${name}:`, error);
    }
  });
}

/**
 * Check existing indexes
 */
export function checkExistingIndexes(): Array<{ name: string; sql: string }> {
  const sql = `
    SELECT name, sql 
    FROM sqlite_master 
    WHERE type = 'index' 
    AND tbl_name = 'posts'
    AND name NOT LIKE 'sqlite_%'
  `;

  try {
    const indexes = executeQuery(sql) as Array<{ name: string; sql: string }>;
    return indexes;
  } catch (error) {
    console.error('Failed to check indexes:', error);
    return [];
  }
}

/**
 * Get index usage statistics
 */
export function getIndexUsageStats(): void {
  const queries = [
    {
      name: 'Recent posts query',
      sql: 'EXPLAIN QUERY PLAN SELECT * FROM posts ORDER BY created_utc DESC LIMIT 10',
    },
    {
      name: 'Platform filter query',
      sql: "EXPLAIN QUERY PLAN SELECT * FROM posts WHERE platform = 'Reddit'",
    },
    {
      name: 'Author search query',
      sql: "EXPLAIN QUERY PLAN SELECT * FROM posts WHERE author = 'test_user'",
    },
    {
      name: 'Score range query',
      sql: 'EXPLAIN QUERY PLAN SELECT * FROM posts WHERE score > 100 ORDER BY score DESC',
    },
    {
      name: 'Text search query',
      sql: "EXPLAIN QUERY PLAN SELECT * FROM posts WHERE title LIKE '%search%'",
    },
  ];

  console.log('Index Usage Analysis:\n');

  queries.forEach(({ name, sql }) => {
    try {
      const plan = executeQuery(sql) as Array<{ detail: string }>;
      console.log(`${name}:`);
      plan.forEach((step) => {
        console.log(`  - ${step.detail}`);
      });
      console.log('');
    } catch (error) {
      console.error(`Failed to analyze ${name}:`, error);
    }
  });
}

// Auto-create indexes when module is imported
if (typeof window === 'undefined') {
  // Only run on server-side
  try {
    const existingIndexes = checkExistingIndexes();
    if (existingIndexes.length === 0) {
      console.log('No indexes found, creating...');
      createDatabaseIndexes();
    } else {
      console.log(`Found ${existingIndexes.length} existing indexes`);
    }
  } catch (error) {
    console.error('Failed to check/create indexes:', error);
  }
}
