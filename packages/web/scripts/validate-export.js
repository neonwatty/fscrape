#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

/**
 * Validates the static export output
 */
function validateStaticExport() {
  console.log('🔍 Validating static export...\n')

  const outDir = path.join(process.cwd(), 'out')
  let hasErrors = false

  // Check if out directory exists
  if (!fs.existsSync(outDir)) {
    console.error('❌ Output directory "out" does not exist')
    console.error('   Run "npm run build" first')
    process.exit(1)
  }

  // Required files for static export
  const requiredFiles = ['index.html', '404.html', '_next']

  // Check for required files
  console.log('📁 Checking required files...')
  for (const file of requiredFiles) {
    const filePath = path.join(outDir, file)
    if (!fs.existsSync(filePath)) {
      console.error(`  ❌ Missing: ${file}`)
      hasErrors = true
    } else {
      console.log(`  ✅ Found: ${file}`)
    }
  }

  // Check for route exports
  console.log('\n📄 Checking route exports...')
  const expectedRoutes = [
    { file: 'index.html', dir: null },
    { file: 'posts/index.html', dir: 'posts' },
    { file: 'analytics/index.html', dir: 'analytics' },
    { file: 'compare/index.html', dir: 'compare' },
  ]

  for (const route of expectedRoutes) {
    const routePath = path.join(outDir, route.file)
    const routeDir = route.dir ? path.join(outDir, route.dir) : null

    // Check for trailing slash directory structure
    if (routeDir && fs.existsSync(routeDir)) {
      if (fs.existsSync(routePath)) {
        const stats = fs.statSync(routePath)
        console.log(`  ✅ ${route.file} (${(stats.size / 1024).toFixed(2)} KB)`)
      } else {
        console.error(`  ❌ Missing: ${route.file}`)
        hasErrors = true
      }
    } else if (!routeDir && fs.existsSync(routePath)) {
      const stats = fs.statSync(routePath)
      console.log(`  ✅ ${route.file} (${(stats.size / 1024).toFixed(2)} KB)`)
    } else {
      console.error(`  ❌ Missing: ${route.file}`)
      hasErrors = true
    }
  }

  // Check _next directory structure
  console.log('\n📦 Checking _next directory...')
  const nextDir = path.join(outDir, '_next')
  if (fs.existsSync(nextDir)) {
    const nextSubDirs = fs.readdirSync(nextDir)
    const requiredNextDirs = ['static']

    for (const dir of requiredNextDirs) {
      if (nextSubDirs.includes(dir)) {
        console.log(`  ✅ Found: _next/${dir}`)
      } else {
        console.error(`  ❌ Missing: _next/${dir}`)
        hasErrors = true
      }
    }
  }

  // Check for .nojekyll file (GitHub Pages)
  const nojekyllPath = path.join(outDir, '.nojekyll')
  if (process.env.NODE_ENV === 'production' || process.argv.includes('--github-pages')) {
    console.log('\n🐙 GitHub Pages checks...')
    if (!fs.existsSync(nojekyllPath)) {
      console.log('  ⚠️  .nojekyll file not found in out directory')
      console.log('  Creating .nojekyll file...')
      fs.writeFileSync(nojekyllPath, '')
      console.log('  ✅ .nojekyll file created')
    } else {
      console.log('  ✅ .nojekyll file exists')
    }
  }

  // Check for potential issues
  console.log('\n⚠️  Checking for potential issues...')

  // Check for server-only files
  const serverOnlyPatterns = ['api/', 'server/', '.env']

  function checkForServerFiles(dir, relativePath = '') {
    const files = fs.readdirSync(dir)
    for (const file of files) {
      const fullPath = path.join(dir, file)
      const relPath = path.join(relativePath, file)

      if (fs.statSync(fullPath).isDirectory() && !file.startsWith('.')) {
        if (serverOnlyPatterns.some((pattern) => relPath.includes(pattern))) {
          console.error(`  ❌ Found server-only content: ${relPath}`)
          hasErrors = true
        }
        if (file !== 'node_modules' && file !== '.git') {
          checkForServerFiles(fullPath, relPath)
        }
      }
    }
  }

  checkForServerFiles(outDir)

  // Summary
  console.log('\n' + '='.repeat(50))
  if (hasErrors) {
    console.error('\n❌ Static export validation failed!')
    console.error('   Please fix the issues above and rebuild.\n')
    process.exit(1)
  } else {
    console.log('\n✅ Static export validation passed!')
    console.log('   Your app is ready for static hosting.\n')

    // Output size information
    const getDirSize = (dirPath) => {
      let size = 0
      const files = fs.readdirSync(dirPath)
      for (const file of files) {
        const filePath = path.join(dirPath, file)
        const stats = fs.statSync(filePath)
        if (stats.isDirectory()) {
          size += getDirSize(filePath)
        } else {
          size += stats.size
        }
      }
      return size
    }

    const totalSize = getDirSize(outDir)
    console.log(`📊 Total export size: ${(totalSize / 1024 / 1024).toFixed(2)} MB`)

    console.log('\n💡 Next steps:')
    console.log('   - Test locally: npm run preview:static')
    console.log('   - Deploy to GitHub Pages: git push origin main')
    console.log('   - Or deploy to any static hosting service\n')
  }
}

// Run validation
validateStaticExport()
