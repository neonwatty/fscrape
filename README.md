# fscrape Monorepo

A monorepo containing the **fscrape CLI tool** and **web frontend** for forum scraping and data visualization.

## 📦 Packages

### [`packages/cli`](./packages/cli) - fscrape CLI Tool
Multi-platform forum scraper for Reddit and Hacker News. Published to npm as `fscrape`.

**Features:**
- Command-line interface for scraping forums
- Support for Reddit and Hacker News
- SQLite database storage
- Export to JSON, CSV, HTML, Markdown
- Rate limiting and error handling

### [`packages/web`](./packages/web) - Web Frontend
Modern Next.js application for visualizing and analyzing scraped forum data.

**Features:**
- Dashboard analytics and visualizations
- Posts explorer with search and filtering
- Comparison tools across platforms
- Static export for GitHub Pages deployment
- Dark mode support

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm 9+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/fscrape.git
cd fscrape

# Install dependencies for all packages
npm install
```

## 💻 Development

### Working with the CLI

```bash
# Run CLI in development mode
npm run dev:cli

# Build CLI
npm run build:cli

# Test CLI
npm run test:cli

# Lint CLI
npm run lint --workspace=packages/cli
```

### Working with the Web Frontend

```bash
# Run web frontend in development mode
npm run dev:web

# Build web frontend
npm run build:web

# Test web
npm run test:web

# Lint web
npm run lint --workspace=packages/web
```

### Run All Tests

```bash
# Run tests for all packages
npm test

# Run typecheck for all packages
npm run typecheck

# Run lint for all packages
npm run lint
```

## 📁 Project Structure

```
fscrape/
├── packages/
│   ├── cli/                      # CLI tool (published to npm)
│   │   ├── src/                  # TypeScript source code
│   │   ├── dist/                 # Build output
│   │   ├── tests/                # Unit tests
│   │   ├── e2e/                  # E2E tests
│   │   └── package.json          # CLI dependencies & scripts
│   │
│   └── web/                      # Web frontend (deployed to GitHub Pages)
│       ├── app/                  # Next.js app router
│       ├── components/           # React components
│       ├── lib/                  # Utilities and hooks
│       ├── public/               # Static assets
│       ├── __tests__/            # Unit tests
│       ├── e2e/                  # E2E tests
│       └── package.json          # Web dependencies & scripts
│
├── .github/
│   └── workflows/
│       ├── cli-publish.yml       # npm publish workflow
│       ├── web-deploy.yml        # GitHub Pages deploy workflow
│       └── ci.yml                # CI testing workflow
│
├── package.json                  # Root workspace config
├── tsconfig.base.json            # Shared TypeScript config
├── .eslintrc.json                # Shared ESLint config
├── .prettierrc                   # Shared Prettier config
└── README.md                     # This file
```

## 📝 Scripts Reference

### Root Level Scripts

```bash
# Build
npm run build              # Build all packages
npm run build:cli          # Build CLI only
npm run build:web          # Build web only

# Development
npm run dev:cli            # Run CLI in dev mode
npm run dev:web            # Run web in dev mode

# Testing
npm test                   # Test all packages
npm run test:cli           # Test CLI only
npm run test:web           # Test web only

# Code Quality
npm run lint               # Lint all packages
npm run lint:fix           # Lint and fix all packages
npm run typecheck          # Type check all packages

# Cleanup
npm run clean              # Clean all packages and root
npm run clean:cli          # Clean CLI only
npm run clean:web          # Clean web only
```

## 🚢 Deployment

### Publishing CLI to npm

The CLI is automatically published to npm when you create a GitHub release:

```bash
# Create and push a new tag
git tag v0.1.1
git push origin v0.1.1

# Create a GitHub release from the tag
# This triggers the cli-publish.yml workflow
```

Or manually trigger the workflow:
1. Go to Actions → "Publish CLI to npm"
2. Click "Run workflow"
3. Enter the tag to publish

**Requirements:**
- Set `NPM_TOKEN` secret in repository settings

### Deploying Web to GitHub Pages

The web frontend is automatically deployed when changes are pushed to master/main:

```bash
# Push to main branch
git push origin main
# This triggers the web-deploy.yml workflow
```

**Requirements:**
- Enable GitHub Pages in repository settings
- Set source to "GitHub Actions"

## 🔗 Data Flow

The typical workflow:

1. **Scrape data** using the CLI:
   ```bash
   cd packages/cli
   npm run dev scrape https://reddit.com/r/programming --limit 100
   ```

2. **Copy database** to web frontend:
   ```bash
   cp packages/cli/fscrape.db packages/web/public/data/sample.db
   ```

3. **View data** in web frontend:
   ```bash
   npm run dev:web
   # Open http://localhost:3000
   ```

4. **Deploy** web frontend to GitHub Pages with the new data

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔧 Troubleshooting

### Installation Issues

```bash
# Clean install
npm run clean
npm install

# If workspace issues persist
rm -rf node_modules package-lock.json
rm -rf packages/*/node_modules packages/*/package-lock.json
npm install
```

### Build Issues

```bash
# Clean build CLI
npm run clean:cli
npm run build:cli

# Clean build web
npm run clean:web
npm run build:web
```

## 📚 Documentation

- [CLI Documentation](./packages/cli/README.md)
- [Web Frontend Documentation](./packages/web/README.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Contributing Guide](./CONTRIBUTING.md)

## 🙋 Support

- Report issues: [GitHub Issues](https://github.com/yourusername/fscrape/issues)
- Discussions: [GitHub Discussions](https://github.com/yourusername/fscrape/discussions)