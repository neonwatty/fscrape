#!/usr/bin/env node

/**
 * Health Check Script for Forum Scraper Frontend
 *
 * This script performs comprehensive health checks including:
 * - System requirements verification
 * - Dependency integrity checks
 * - File system validation
 * - Configuration validation
 * - Database connectivity
 * - Build system verification
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
}

// Check results storage
const results = {
  passed: [],
  warnings: [],
  failed: [],
}

// Helper functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString()
  switch (type) {
    case 'success':
      console.log(`${colors.green}✓${colors.reset} ${message}`)
      results.passed.push({ message, timestamp })
      break
    case 'warning':
      console.log(`${colors.yellow}⚠${colors.reset} ${message}`)
      results.warnings.push({ message, timestamp })
      break
    case 'error':
      console.log(`${colors.red}✗${colors.reset} ${message}`)
      results.failed.push({ message, timestamp })
      break
    case 'info':
      console.log(`${colors.blue}ℹ${colors.reset} ${message}`)
      break
    case 'header':
      console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`)
      console.log(`${colors.cyan}${message}${colors.reset}`)
      console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`)
      break
    default:
      console.log(message)
  }
}

function checkCommand(command, name) {
  try {
    execSync(`which ${command}`, { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

function getVersion(command) {
  try {
    const version = execSync(`${command} --version`, { encoding: 'utf8' }).trim()
    return version.split('\n')[0]
  } catch {
    return 'unknown'
  }
}

function checkFileExists(filePath, description) {
  const fullPath = path.join(process.cwd(), filePath)
  if (fs.existsSync(fullPath)) {
    log(`${description} found: ${filePath}`, 'success')
    return true
  } else {
    log(`${description} missing: ${filePath}`, 'error')
    return false
  }
}

function checkDirectoryExists(dirPath, description) {
  const fullPath = path.join(process.cwd(), dirPath)
  if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
    log(`${description} found: ${dirPath}`, 'success')
    return true
  } else {
    log(`${description} missing: ${dirPath}`, 'error')
    return false
  }
}

// Health check functions
async function checkSystemRequirements() {
  log('SYSTEM REQUIREMENTS', 'header')

  // Check Node.js version
  const nodeVersion = process.version
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0])

  if (majorVersion >= 18) {
    log(`Node.js version: ${nodeVersion} ✓`, 'success')
  } else {
    log(`Node.js version: ${nodeVersion} (requires >= 18.0.0)`, 'error')
  }

  // Check npm version
  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim()
    const majorNpmVersion = parseInt(npmVersion.split('.')[0])

    if (majorNpmVersion >= 9) {
      log(`npm version: ${npmVersion} ✓`, 'success')
    } else {
      log(`npm version: ${npmVersion} (requires >= 9.0.0)`, 'warning')
    }
  } catch (error) {
    log('Failed to check npm version', 'error')
  }

  // Check Git
  if (checkCommand('git', 'Git')) {
    const gitVersion = getVersion('git')
    log(`Git installed: ${gitVersion}`, 'success')
  } else {
    log('Git not found', 'warning')
  }

  // Check available memory
  const totalMemory = require('os').totalmem()
  const freeMemory = require('os').freemem()
  const usedMemoryPercent = (((totalMemory - freeMemory) / totalMemory) * 100).toFixed(1)

  if (freeMemory > 1024 * 1024 * 1024) {
    // More than 1GB free
    log(
      `Memory available: ${(freeMemory / 1024 / 1024 / 1024).toFixed(2)}GB (${100 - usedMemoryPercent}% free)`,
      'success'
    )
  } else {
    log(`Low memory: ${(freeMemory / 1024 / 1024).toFixed(0)}MB free`, 'warning')
  }
}

async function checkDependencies() {
  log('DEPENDENCIES', 'header')

  // Check if node_modules exists
  if (!checkDirectoryExists('node_modules', 'node_modules directory')) {
    log('Run "npm install" to install dependencies', 'error')
    return
  }

  // Check package-lock.json
  checkFileExists('package-lock.json', 'package-lock.json')

  // Verify installed packages match package.json
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies }

    let missingPackages = []
    for (const [pkg, version] of Object.entries(dependencies)) {
      const pkgPath = path.join('node_modules', pkg)
      if (!fs.existsSync(pkgPath)) {
        missingPackages.push(pkg)
      }
    }

    if (missingPackages.length === 0) {
      log('All dependencies installed', 'success')
    } else {
      log(`Missing packages: ${missingPackages.join(', ')}`, 'error')
      log('Run "npm install" to fix', 'info')
    }
  } catch (error) {
    log('Failed to check dependencies', 'error')
  }

  // Check for security vulnerabilities
  try {
    const auditResult = execSync('npm audit --json', { encoding: 'utf8' })
    const audit = JSON.parse(auditResult)
    const vulns = audit.metadata?.vulnerabilities || {}
    const totalVulns = Object.values(vulns).reduce((sum, count) => sum + count, 0)

    if (totalVulns === 0) {
      log('No security vulnerabilities found', 'success')
    } else {
      log(
        `Found ${totalVulns} vulnerabilities (${vulns.critical || 0} critical, ${vulns.high || 0} high, ${vulns.moderate || 0} moderate, ${vulns.low || 0} low)`,
        'warning'
      )
      log('Run "npm audit fix" to fix', 'info')
    }
  } catch (error) {
    // npm audit returns non-zero exit code when vulnerabilities are found
    // This is expected behavior
  }
}

async function checkProjectStructure() {
  log('PROJECT STRUCTURE', 'header')

  // Check required directories
  const requiredDirs = [
    { path: 'app', desc: 'App directory' },
    { path: 'components', desc: 'Components directory' },
    { path: 'lib', desc: 'Library directory' },
    { path: 'public', desc: 'Public directory' },
    { path: 'scripts', desc: 'Scripts directory' },
    { path: '__tests__', desc: 'Tests directory' },
  ]

  let allDirsPresent = true
  for (const dir of requiredDirs) {
    if (!checkDirectoryExists(dir.path, dir.desc)) {
      allDirsPresent = false
    }
  }

  // Check required files (with .js or .ts extensions)
  const requiredFiles = [
    { path: 'package.json', desc: 'package.json' },
    { path: 'tsconfig.json', desc: 'TypeScript config' },
    { path: '.gitignore', desc: 'Git ignore file' },
    { path: 'README.md', desc: 'README' },
  ]

  // Check for config files with either .js or .ts extension
  const configFiles = [
    { paths: ['next.config.js', 'next.config.ts', 'next.config.mjs'], desc: 'Next.js config' },
    { paths: ['tailwind.config.js', 'tailwind.config.ts'], desc: 'Tailwind config' },
  ]

  for (const config of configFiles) {
    const found = config.paths.some((p) => fs.existsSync(path.join(process.cwd(), p)))
    if (found) {
      const existingPath = config.paths.find((p) => fs.existsSync(path.join(process.cwd(), p)))
      log(`${config.desc} found: ${existingPath}`, 'success')
    } else {
      log(`${config.desc} missing: ${config.paths.join(' or ')}`, 'error')
      allFilesPresent = false
    }
  }

  let allFilesPresent = true
  for (const file of requiredFiles) {
    if (!checkFileExists(file.path, file.desc)) {
      allFilesPresent = false
    }
  }

  if (allDirsPresent && allFilesPresent) {
    log('Project structure is complete', 'success')
  }
}

async function checkConfiguration() {
  log('CONFIGURATION', 'header')

  // Check Next.js configuration
  try {
    const nextConfig = require(path.join(process.cwd(), 'next.config.js'))

    if (nextConfig.output === 'export') {
      log('Next.js configured for static export', 'success')
    } else {
      log('Next.js not configured for static export', 'warning')
    }

    if (nextConfig.basePath) {
      log(`Base path configured: ${nextConfig.basePath}`, 'info')
    }
  } catch (error) {
    log('Failed to load Next.js configuration', 'error')
  }

  // Check TypeScript configuration
  try {
    const tsConfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8'))

    if (tsConfig.compilerOptions?.strict) {
      log('TypeScript strict mode enabled', 'success')
    } else {
      log('TypeScript strict mode disabled', 'warning')
    }
  } catch (error) {
    log('Failed to load TypeScript configuration', 'error')
  }

  // Check environment variables
  const envFile = '.env.local'
  if (fs.existsSync(envFile)) {
    log('Environment file found', 'success')
  } else {
    log('No .env.local file found (optional)', 'info')
  }
}

async function checkDatabase() {
  log('DATABASE', 'header')

  // Check for database files
  const dbPath = 'public/data'
  if (checkDirectoryExists(dbPath, 'Database directory')) {
    const dbFiles = fs.readdirSync(dbPath).filter((file) => file.endsWith('.db'))

    if (dbFiles.length > 0) {
      log(`Found ${dbFiles.length} database file(s): ${dbFiles.join(', ')}`, 'success')

      // Check database sizes
      for (const dbFile of dbFiles) {
        const filePath = path.join(dbPath, dbFile)
        const stats = fs.statSync(filePath)
        const sizeMB = (stats.size / 1024 / 1024).toFixed(2)
        log(`  ${dbFile}: ${sizeMB} MB`, 'info')
      }
    } else {
      log('No database files found', 'warning')
      log('Run "npm run db:update" to create sample database', 'info')
    }
  }

  // Test database validation script
  if (checkFileExists('scripts/validate-db.js', 'Database validation script')) {
    try {
      execSync('node scripts/validate-db.js', { stdio: 'ignore' })
      log('Database validation successful', 'success')
    } catch (error) {
      log('Database validation failed', 'warning')
    }
  }
}

async function checkBuildSystem() {
  log('BUILD SYSTEM', 'header')

  // Check if .next directory exists
  if (fs.existsSync('.next')) {
    const stats = fs.statSync('.next')
    const ageHours = (Date.now() - stats.mtime) / 1000 / 60 / 60

    if (ageHours < 24) {
      log('Recent build found (.next directory)', 'success')
    } else {
      log(`.next directory is ${ageHours.toFixed(0)} hours old`, 'warning')
      log('Consider rebuilding with "npm run build"', 'info')
    }
  } else {
    log('No build found (.next directory missing)', 'info')
    log('Run "npm run build" to create a production build', 'info')
  }

  // Check if out directory exists (for static export)
  if (fs.existsSync('out')) {
    log('Static export found (out directory)', 'success')
  } else {
    log('No static export found', 'info')
    log('Run "npm run build" to create static export', 'info')
  }
}

async function checkPerformance() {
  log('PERFORMANCE', 'header')

  // Check bundle size if built
  if (fs.existsSync('.next')) {
    try {
      const buildManifest = require(path.join(process.cwd(), '.next/build-manifest.json'))
      const pageCount = Object.keys(buildManifest.pages || {}).length
      log(`Build contains ${pageCount} pages`, 'info')
    } catch (error) {
      // Build manifest might not exist
    }
  }

  // Check for performance optimizations
  try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'))

    // Check for performance-related scripts
    if (packageJson.scripts?.['build:analyze']) {
      log('Bundle analyzer configured', 'success')
    }

    // Check for PWA support
    if (fs.existsSync('public/manifest.json')) {
      log('PWA manifest found', 'success')
    }

    // Check for service worker
    if (fs.existsSync('public/sw.js') || fs.existsSync('public/service-worker.js')) {
      log('Service worker found', 'success')
    }
  } catch (error) {
    log('Failed to check performance optimizations', 'warning')
  }
}

// Summary function
function printSummary() {
  console.log(`\n${colors.cyan}${'='.repeat(50)}${colors.reset}`)
  console.log(`${colors.cyan}HEALTH CHECK SUMMARY${colors.reset}`)
  console.log(`${colors.cyan}${'='.repeat(50)}${colors.reset}`)

  console.log(`${colors.green}Passed: ${results.passed.length}${colors.reset}`)
  console.log(`${colors.yellow}Warnings: ${results.warnings.length}${colors.reset}`)
  console.log(`${colors.red}Failed: ${results.failed.length}${colors.reset}`)

  // Calculate health score
  const total = results.passed.length + results.warnings.length + results.failed.length
  const score = total > 0 ? Math.round((results.passed.length / total) * 100) : 0

  console.log(`\n${colors.cyan}Health Score: ${score}%${colors.reset}`)

  if (score >= 80) {
    console.log(`${colors.green}✓ System is healthy${colors.reset}`)
  } else if (score >= 60) {
    console.log(`${colors.yellow}⚠ System needs attention${colors.reset}`)
  } else {
    console.log(`${colors.red}✗ System has critical issues${colors.reset}`)
  }

  // Save results to file
  const reportPath = path.join(
    'logs',
    `health-check-${new Date().toISOString().split('T')[0]}.json`
  )
  try {
    if (!fs.existsSync('logs')) {
      fs.mkdirSync('logs')
    }
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
    console.log(`\n${colors.blue}Report saved to: ${reportPath}${colors.reset}`)
  } catch (error) {
    // Couldn't save report
  }
}

// Main execution
async function main() {
  console.log(`${colors.cyan}Forum Scraper Frontend - Health Check${colors.reset}`)
  console.log(`${colors.cyan}Starting at: ${new Date().toISOString()}${colors.reset}`)

  try {
    await checkSystemRequirements()
    await checkDependencies()
    await checkProjectStructure()
    await checkConfiguration()
    await checkDatabase()
    await checkBuildSystem()
    await checkPerformance()
  } catch (error) {
    log(`Unexpected error: ${error.message}`, 'error')
  }

  printSummary()

  // Exit with appropriate code
  if (results.failed.length > 0) {
    process.exit(1)
  } else {
    process.exit(0)
  }
}

// Run health check
main()
