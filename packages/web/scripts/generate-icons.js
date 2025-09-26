#!/usr/bin/env node

/**
 * Generate PWA icons in multiple sizes
 * Creates placeholder icons with the app initials
 */

const fs = require('fs')
const path = require('path')

// Icon sizes needed for PWA
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512]

// Colors for the icon
const THEME_COLOR = '#6366f1' // Indigo
const BACKGROUND_COLOR = '#ffffff'
const TEXT_COLOR = '#ffffff'

/**
 * Generate SVG icon with app initials
 */
function generateSVG(size, isMaskable = false) {
  const padding = isMaskable ? size * 0.1 : 0 // 10% padding for maskable icons
  const effectiveSize = size - padding * 2
  const fontSize = effectiveSize * 0.35

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background -->
  <rect width="${size}" height="${size}" fill="${BACKGROUND_COLOR}"/>
  
  <!-- Main circle/square -->
  ${
    isMaskable
      ? `<rect x="${padding}" y="${padding}" width="${effectiveSize}" height="${effectiveSize}" rx="${effectiveSize * 0.1}" fill="${THEME_COLOR}"/>`
      : `<circle cx="${size / 2}" cy="${size / 2}" r="${effectiveSize / 2}" fill="${THEME_COLOR}"/>`
  }
  
  <!-- Gradient for depth -->
  <defs>
    <linearGradient id="grad${size}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#818cf8;stop-opacity:0.3" />
      <stop offset="100%" style="stop-color:#4f46e5;stop-opacity:0.3" />
    </linearGradient>
  </defs>
  
  ${
    isMaskable
      ? `<rect x="${padding}" y="${padding}" width="${effectiveSize}" height="${effectiveSize}" rx="${effectiveSize * 0.1}" fill="url(#grad${size})"/>`
      : `<circle cx="${size / 2}" cy="${size / 2}" r="${effectiveSize / 2}" fill="url(#grad${size})"/>`
  }
  
  <!-- Text -->
  <text x="${size / 2}" y="${size / 2}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="${TEXT_COLOR}" text-anchor="middle" dominant-baseline="central">FS</text>
  
  <!-- Subtle border for definition -->
  ${
    isMaskable
      ? `<rect x="${padding}" y="${padding}" width="${effectiveSize}" height="${effectiveSize}" rx="${effectiveSize * 0.1}" fill="none" stroke="${THEME_COLOR}" stroke-width="1" opacity="0.2"/>`
      : `<circle cx="${size / 2}" cy="${size / 2}" r="${effectiveSize / 2 - 1}" fill="none" stroke="${THEME_COLOR}" stroke-width="1" opacity="0.2"/>`
  }
</svg>`

  return svg
}

/**
 * Convert SVG to PNG using canvas (placeholder implementation)
 * In production, you would use a library like sharp or canvas
 */
function saveSVGAsPlaceholder(svg, filepath) {
  // For now, we'll save the SVG content as a placeholder
  // In production, you'd convert this to PNG using a proper library

  // Create a simple HTML file that renders the SVG
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Icon</title>
  <style>
    body { margin: 0; padding: 0; }
    svg { display: block; }
  </style>
</head>
<body>
  ${svg}
</body>
</html>`

  // Save as HTML for now (would be PNG in production)
  const htmlPath = filepath.replace('.png', '.html')
  fs.writeFileSync(htmlPath, html)

  // Also save the SVG directly
  const svgPath = filepath.replace('.png', '.svg')
  fs.writeFileSync(svgPath, svg)

  console.log(`✅ Created placeholder: ${path.basename(svgPath)}`)

  return true
}

/**
 * Generate all required icons
 */
function generateIcons() {
  const iconsDir = path.join(__dirname, '..', 'public')

  console.log('🎨 Generating PWA icons...\n')

  // Generate regular icons
  ICON_SIZES.forEach((size) => {
    const svg = generateSVG(size, false)
    const filepath = path.join(iconsDir, `icon-${size}.png`)
    saveSVGAsPlaceholder(svg, filepath)
  })

  // Generate maskable versions for key sizes
  ;[192, 512].forEach((size) => {
    const svg = generateSVG(size, true)
    const filepath = path.join(iconsDir, `icon-maskable-${size}.png`)
    saveSVGAsPlaceholder(svg, filepath)
  })

  // Generate Apple touch icon
  const appleSvg = generateSVG(180, false)
  saveSVGAsPlaceholder(appleSvg, path.join(iconsDir, 'apple-touch-icon.png'))

  // Generate favicon
  const faviconSvg = generateSVG(32, false)
  saveSVGAsPlaceholder(faviconSvg, path.join(iconsDir, 'favicon.png'))

  console.log('\n✨ Icon generation complete!')
  console.log('\nNote: These are SVG placeholders. For production, convert to PNG using:')
  console.log('  - Sharp (Node.js): npm install sharp')
  console.log('  - ImageMagick: convert icon.svg icon.png')
  console.log('  - Online tools: https://cloudconvert.com/svg-to-png')

  // Create a simple README for the icons
  const readme = `# PWA Icons

## Generated Icons

The following icons have been generated for the PWA:

### Standard Icons
${ICON_SIZES.map((size) => `- icon-${size}.png (${size}x${size})`).join('\n')}

### Maskable Icons
- icon-maskable-192.png (192x192) - For adaptive icons
- icon-maskable-512.png (512x512) - For adaptive icons

### Special Icons
- apple-touch-icon.png (180x180) - For iOS
- favicon.png (32x32) - Browser favicon

## Icon Requirements

- **Minimum Required**: 192x192 and 512x512
- **Maskable Icons**: Include safe zone padding (10% on each side)
- **Format**: PNG with transparency support
- **Purpose**: 
  - "any": Standard icons
  - "maskable": Adaptive icons with safe zone

## Converting SVG to PNG

To convert the SVG placeholders to PNG:

\`\`\`bash
# Using ImageMagick
for file in *.svg; do
  convert "$file" "\${file%.svg}.png"
done

# Using Sharp (Node.js)
npm install sharp
node convert-svg-to-png.js
\`\`\`

## Design Guidelines

- **Safe Zone**: Keep important content within 80% of maskable icons
- **Contrast**: Ensure good contrast for accessibility
- **Simplicity**: Icons should be recognizable at small sizes
- **Consistency**: Maintain brand colors and style
`

  fs.writeFileSync(path.join(iconsDir, 'icons-README.md'), readme)
}

// Run the generator
generateIcons()
