#!/usr/bin/env node

const fs = require('fs')
const path = require('path')
const initSqlJs = require('sql.js')

/**
 * Database validation script
 * Validates the structure and content of the SQLite database
 */

const DB_PATH = path.join(process.cwd(), 'public', 'data', 'sample.db')

// Required tables and their columns
const SCHEMA_REQUIREMENTS = {
  posts: {
    required: [
      'id',
      'title',
      'author',
      'content',
      'url',
      'score',
      'comments',
      'created_at',
      'platform',
    ],
    optional: ['scraped_at', 'permalink', 'subreddit', 'forum_name', 'thread_id', 'post_type'],
  },
  metadata: {
    required: ['key', 'value'],
    optional: ['updated_at'],
  },
}

// Validation rules
const VALIDATION_RULES = {
  minPosts: 1,
  maxTitleLength: 500,
  maxContentLength: 10000,
  validPlatforms: ['reddit', 'hackernews', 'discourse', 'other'],
  dateFormat: /^\d{4}-\d{2}-\d{2}/,
}

async function loadDatabase() {
  try {
    const SQL = await initSqlJs()
    const fileBuffer = fs.readFileSync(DB_PATH)
    const db = new SQL.Database(fileBuffer)
    return db
  } catch (error) {
    console.error('❌ Failed to load database:', error.message)
    process.exit(1)
  }
}

function validateSchema(db) {
  console.log('\n📋 Validating database schema...')
  let hasErrors = false

  // Get all tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'")[0]
  const tableNames = tables ? tables.values.map((row) => row[0]) : []

  console.log(`   Found tables: ${tableNames.join(', ')}`)

  // Check required tables
  for (const [tableName, columns] of Object.entries(SCHEMA_REQUIREMENTS)) {
    if (!tableNames.includes(tableName)) {
      console.error(`   ❌ Missing required table: ${tableName}`)
      hasErrors = true
      continue
    }

    // Get table columns
    const columnInfo = db.exec(`PRAGMA table_info(${tableName})`)[0]
    const existingColumns = columnInfo ? columnInfo.values.map((row) => row[1]) : []

    // Check required columns
    for (const col of columns.required) {
      if (!existingColumns.includes(col)) {
        console.error(`   ❌ Missing required column in ${tableName}: ${col}`)
        hasErrors = true
      }
    }

    console.log(`   ✅ Table '${tableName}' structure valid`)
  }

  return !hasErrors
}

function validateData(db) {
  console.log('\n📊 Validating data integrity...')
  let hasErrors = false
  let warnings = []

  try {
    // Count posts
    const postCount = db.exec('SELECT COUNT(*) as count FROM posts')[0].values[0][0]
    console.log(`   Total posts: ${postCount}`)

    if (postCount < VALIDATION_RULES.minPosts) {
      console.error(`   ❌ Insufficient posts (minimum: ${VALIDATION_RULES.minPosts})`)
      hasErrors = true
    }

    // Check for null required fields
    const nullChecks = [
      { field: 'title', table: 'posts' },
      { field: 'platform', table: 'posts' },
      { field: 'created_at', table: 'posts' },
    ]

    for (const check of nullChecks) {
      const nullCount = db.exec(
        `SELECT COUNT(*) FROM ${check.table} WHERE ${check.field} IS NULL`
      )[0].values[0][0]

      if (nullCount > 0) {
        console.error(`   ❌ Found ${nullCount} records with NULL ${check.field}`)
        hasErrors = true
      }
    }

    // Validate platforms
    const platforms = db.exec('SELECT DISTINCT platform FROM posts')[0]
    if (platforms) {
      const platformList = platforms.values.map((row) => row[0])
      const invalidPlatforms = platformList.filter(
        (p) => p && !VALIDATION_RULES.validPlatforms.includes(p.toLowerCase())
      )

      if (invalidPlatforms.length > 0) {
        warnings.push(`Unknown platforms: ${invalidPlatforms.join(', ')}`)
      }
      console.log(`   Platforms: ${platformList.join(', ')}`)
    }

    // Check data constraints
    const longTitles = db.exec(
      `SELECT COUNT(*) FROM posts WHERE LENGTH(title) > ${VALIDATION_RULES.maxTitleLength}`
    )[0].values[0][0]

    if (longTitles > 0) {
      warnings.push(
        `${longTitles} posts have titles exceeding ${VALIDATION_RULES.maxTitleLength} characters`
      )
    }

    // Validate date formats
    const invalidDates = db.exec(
      "SELECT COUNT(*) FROM posts WHERE created_at IS NOT NULL AND created_at NOT LIKE '____-__-__%'"
    )[0].values[0][0]

    if (invalidDates > 0) {
      console.error(`   ❌ Found ${invalidDates} posts with invalid date format`)
      hasErrors = true
    }

    // Check for duplicates
    const duplicates = db.exec(
      'SELECT url, COUNT(*) as count FROM posts WHERE url IS NOT NULL GROUP BY url HAVING count > 1'
    )[0]

    if (duplicates && duplicates.values.length > 0) {
      warnings.push(`Found ${duplicates.values.length} duplicate URLs`)
    }
  } catch (error) {
    console.error(`   ❌ Data validation error: ${error.message}`)
    hasErrors = true
  }

  // Display warnings
  if (warnings.length > 0) {
    console.log('\n⚠️  Warnings:')
    warnings.forEach((w) => console.log(`   - ${w}`))
  }

  return !hasErrors
}

function validateIndexes(db) {
  console.log('\n🔍 Checking indexes...')

  const recommendedIndexes = [
    'idx_posts_platform',
    'idx_posts_created_at',
    'idx_posts_score',
    'idx_posts_author',
  ]

  const indexes = db.exec(
    "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='posts'"
  )[0]

  const existingIndexes = indexes ? indexes.values.map((row) => row[0]) : []

  for (const idx of recommendedIndexes) {
    if (existingIndexes.includes(idx)) {
      console.log(`   ✅ Index '${idx}' exists`)
    } else {
      console.log(`   ⚠️  Missing recommended index: ${idx}`)
    }
  }

  return true
}

function generateReport(db) {
  console.log('\n📈 Database Statistics:')

  try {
    // Get statistics
    const stats = {
      totalPosts: db.exec('SELECT COUNT(*) FROM posts')[0].values[0][0],
      uniqueAuthors: db.exec('SELECT COUNT(DISTINCT author) FROM posts WHERE author IS NOT NULL')[0]
        .values[0][0],
      avgScore: db.exec('SELECT AVG(score) FROM posts WHERE score IS NOT NULL')[0].values[0][0],
      avgComments: db.exec('SELECT AVG(comments) FROM posts WHERE comments IS NOT NULL')[0]
        .values[0][0],
      dateRange: db.exec(
        'SELECT MIN(created_at), MAX(created_at) FROM posts WHERE created_at IS NOT NULL'
      )[0].values[0],
    }

    console.log(`   Posts: ${stats.totalPosts}`)
    console.log(`   Unique authors: ${stats.uniqueAuthors}`)
    console.log(`   Average score: ${Math.round(stats.avgScore || 0)}`)
    console.log(`   Average comments: ${Math.round(stats.avgComments || 0)}`)

    if (stats.dateRange[0] && stats.dateRange[1]) {
      console.log(`   Date range: ${stats.dateRange[0]} to ${stats.dateRange[1]}`)
    }

    // Platform distribution
    const platforms = db.exec(
      'SELECT platform, COUNT(*) as count FROM posts GROUP BY platform ORDER BY count DESC'
    )[0]

    if (platforms) {
      console.log('\n   Platform distribution:')
      platforms.values.forEach(([platform, count]) => {
        const percentage = ((count / stats.totalPosts) * 100).toFixed(1)
        console.log(`     - ${platform}: ${count} (${percentage}%)`)
      })
    }
  } catch (error) {
    console.error('   ❌ Failed to generate statistics:', error.message)
  }
}

async function main() {
  console.log('🔍 Database Validation Tool')
  console.log('==========================')

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    console.error(`\n❌ Database not found at: ${DB_PATH}`)
    console.log('   Run "npm run db:update --generate" to create a sample database')
    process.exit(1)
  }

  // Get file stats
  const stats = fs.statSync(DB_PATH)
  console.log(`\n📁 Database: ${DB_PATH}`)
  console.log(`   Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`)
  console.log(`   Modified: ${stats.mtime.toLocaleString()}`)

  // Load and validate database
  const db = await loadDatabase()

  const schemaValid = validateSchema(db)
  const dataValid = validateData(db)
  const indexesValid = validateIndexes(db)

  generateReport(db)

  // Summary
  console.log('\n' + '='.repeat(50))
  if (schemaValid && dataValid) {
    console.log('\n✅ Database validation passed!')
    process.exit(0)
  } else {
    console.log('\n❌ Database validation failed!')
    console.log('   Please fix the issues above or regenerate the database')
    process.exit(1)
  }
}

// Run validation
main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
