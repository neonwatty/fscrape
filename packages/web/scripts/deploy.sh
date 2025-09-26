#!/bin/bash

# Deployment script for GitHub Pages

set -e

echo "Starting deployment process..."

# Check if we're on the main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "Error: Deployment should only run from main branch"
  echo "Current branch: $CURRENT_BRANCH"
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo "Error: You have uncommitted changes"
  echo "Please commit or stash your changes before deploying"
  exit 1
fi

# Run tests
echo "Running tests..."
npm run test:run

# Run type check and lint
echo "Running type check and lint..."
npm run check-all

# Build the application
echo "Building application for production..."
NODE_ENV=production npm run build

# Check if build was successful
if [ ! -d "out" ]; then
  echo "Error: Build failed - 'out' directory not found"
  exit 1
fi

# Add .nojekyll file to out directory
cp .nojekyll out/

echo "Build completed successfully!"
echo "The 'out' directory is ready for deployment"
echo ""
echo "To deploy to GitHub Pages:"
echo "1. Push to main branch"
echo "2. GitHub Actions will automatically deploy"
echo ""
echo "Or manually deploy using:"
echo "npx gh-pages -d out -b gh-pages"