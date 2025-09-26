# PWA Icons

## Generated Icons

The following icons have been generated for the PWA:

### Standard Icons

- icon-72.png (72x72)
- icon-96.png (96x96)
- icon-128.png (128x128)
- icon-144.png (144x144)
- icon-152.png (152x152)
- icon-192.png (192x192)
- icon-384.png (384x384)
- icon-512.png (512x512)

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

```bash
# Using ImageMagick
for file in *.svg; do
  convert "$file" "${file%.svg}.png"
done

# Using Sharp (Node.js)
npm install sharp
node convert-svg-to-png.js
```

## Design Guidelines

- **Safe Zone**: Keep important content within 80% of maskable icons
- **Contrast**: Ensure good contrast for accessibility
- **Simplicity**: Icons should be recognizable at small sizes
- **Consistency**: Maintain brand colors and style
