#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

// Script to update manifest.json for GitHub Pages deployment
const basePath = process.env.NODE_ENV === 'production' ? '/fscrape' : '';

const manifestPath = path.join(__dirname, '../public/manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Update URLs with base path
manifest.start_url = basePath + '/';
manifest.scope = basePath + '/';

// Update icons
manifest.icons = manifest.icons.map(icon => ({
  ...icon,
  src: basePath + icon.src
}));

// Update screenshots
if (manifest.screenshots) {
  manifest.screenshots = manifest.screenshots.map(screenshot => ({
    ...screenshot,
    src: basePath + screenshot.src
  }));
}

// Update shortcuts
if (manifest.shortcuts) {
  manifest.shortcuts = manifest.shortcuts.map(shortcut => ({
    ...shortcut,
    url: basePath + shortcut.url,
    icons: shortcut.icons?.map(icon => ({
      ...icon,
      src: basePath + icon.src
    }))
  }));
}

// Update share_target
if (manifest.share_target) {
  manifest.share_target.action = basePath + manifest.share_target.action;
}

// Write updated manifest
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ Updated manifest.json with base path:', basePath);