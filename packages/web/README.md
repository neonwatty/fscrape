# Forum Scraper Frontend

[![Deploy to GitHub Pages](https://github.com/neonwatty/fscrape-frontend/actions/workflows/deploy.yml/badge.svg)](https://github.com/neonwatty/fscrape-frontend/actions/workflows/deploy.yml)
[![CI Tests](https://github.com/neonwatty/fscrape-frontend/actions/workflows/test.yml/badge.svg)](https://github.com/neonwatty/fscrape-frontend/actions/workflows/test.yml)
[![Pull Request Checks](https://github.com/neonwatty/fscrape-frontend/actions/workflows/pr.yml/badge.svg)](https://github.com/neonwatty/fscrape-frontend/actions/workflows/pr.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org)

A modern, responsive frontend application for analyzing and visualizing forum data scraped from various platforms. Built with Next.js 15, TypeScript, and Tailwind CSS for optimal performance and developer experience.

## 🎯 Quick Start

Get up and running in under 5 minutes:

```bash
# Clone and enter directory
git clone https://github.com/neonwatty/fscrape-frontend.git && cd fscrape-frontend

# Install and start
npm install && npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the app!

## 📸 Screenshots

| Dashboard                                 | Posts Explorer                    | Analytics                                 |
| ----------------------------------------- | --------------------------------- | ----------------------------------------- |
| ![Dashboard](./docs/images/dashboard.png) | ![Posts](./docs/images/posts.png) | ![Analytics](./docs/images/analytics.png) |

## 🚀 Features

- **Dashboard Analytics**: Real-time visualization of forum metrics and trends
- **Posts Explorer**: Browse, search, and filter through scraped forum posts
- **Comparison Tools**: Compare metrics across different platforms and time periods
- **Responsive Design**: Optimized for desktop, tablet, and mobile devices
- **Static Export**: Fully static site generation for optimal performance
- **PWA Support**: Install as app, work offline, background sync
- **Performance Optimized**: Code splitting, lazy loading, virtualized lists
- **Accessibility**: WCAG 2.1 compliant with keyboard navigation
- **Dark Mode**: Full dark mode support with system preference detection
- **Real-time Updates**: Automatic data refresh and live notifications
- **Export Capabilities**: Export data in multiple formats (CSV, JSON, PDF)

## 🛠️ Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI, shadcn/ui
- **Charts**: Recharts
- **Database**: SQL.js (in-browser SQLite)
- **Testing**: Vitest, React Testing Library, Playwright
- **CI/CD**: GitHub Actions
- **PWA**: Service Workers, Web App Manifest
- **Performance**: Web Vitals, Lighthouse CI

## 📦 Installation

### Prerequisites

- Node.js 18+ and npm 9+
- Git
- Modern browser (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/neonwatty/fscrape-frontend.git
cd fscrape-frontend

# Install dependencies
npm install

# Install Playwright browsers (for E2E testing)
npm run test:e2e:install

# Set up database (if needed)
npm run db:update

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Alternative Installation Methods

#### Using npm with specific Node version

```bash
# Using nvm (Node Version Manager)
nvm use 18
npm install
```

#### Clean Installation

```bash
# Remove existing dependencies and reinstall
npm run clean:deps
```

#### CI/CD Installation

```bash
# Installation for CI environments
npm run ci:install
```

## 💻 Usage

### Development Workflow

```bash
# Start development server with hot reload
npm run dev

# Run with Turbopack (faster builds)
npm run dev:turbo

# Run with debugging enabled
npm run dev:debug
```

### Code Quality Checks

```bash
# Run all quality checks before committing
npm run check-all

# Individual checks
npm run lint          # ESLint
npm run type-check    # TypeScript
npm run format:check  # Prettier
```

### Working with Data

```bash
# Update database with latest forum data
npm run db:update

# Validate database integrity
npm run db:validate

# Backup database
npm run db:backup
```

### API Endpoints

The application exposes the following API endpoints when running locally:

- `GET /api/posts` - Fetch forum posts
- `GET /api/analytics` - Get analytics data
- `GET /api/metrics` - Retrieve platform metrics
- `POST /api/export` - Export data in various formats

Example usage:

```javascript
// Fetch posts with filters
fetch('/api/posts?platform=reddit&limit=50')
  .then((res) => res.json())
  .then((data) => console.log(data))
```

## 🧪 Testing

### Unit Testing

```bash
# Run unit tests
npm run test

# Run in watch mode for development
npm run test:watch

# Run with UI interface
npm run test:ui

# Generate coverage report
npm run test:coverage
```

### End-to-End Testing

```bash
# Run E2E tests
npm run test:e2e

# Run with UI for debugging
npm run test:e2e:ui

# Run in headed mode (visible browser)
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug
```

### Continuous Integration

```bash
# Run all CI checks
npm run ci

# Run tests for CI environment
npm run ci:test
```

## 🏗️ Building

```bash
# Build for production
npm run build

# Build with production environment
npm run build:prod

# Validate static export
npm run validate:export

# Preview static build locally
npm run preview:static
```

## 📊 Scripts

| Script            | Description                  |
| ----------------- | ---------------------------- |
| `dev`             | Start development server     |
| `build`           | Build for production         |
| `lint`            | Run ESLint                   |
| `type-check`      | Run TypeScript type checking |
| `format`          | Format code with Prettier    |
| `test`            | Run Vitest tests             |
| `test:e2e`        | Run Playwright E2E tests     |
| `validate:export` | Validate static export       |

## 🚀 Deployment

The application automatically deploys to GitHub Pages when changes are pushed to the main branch.

### Manual Deployment

```bash
# Build and validate
npm run build
npm run validate:export

# Deploy to GitHub Pages
git push origin main
```

## 📁 Project Structure

```
fscrape-frontend/
├── app/                # Next.js app router pages
├── components/         # React components
│   ├── analytics/     # Analytics components
│   ├── charts/        # Chart components
│   ├── dashboard/     # Dashboard components
│   ├── tables/        # Table components
│   └── ui/           # Base UI components
├── lib/               # Utility functions and hooks
├── public/            # Static assets
├── __tests__/         # Test files
├── e2e/              # E2E test specs
└── .github/          # GitHub Actions workflows
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 🎯 Performance

The application is optimized for performance:

- **Lighthouse Score**: 95+ across all metrics
- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3.5s
- **Bundle Size**: < 200KB (gzipped)

## 🔧 Configuration

### Environment Variables

Create a `.env.local` file in the root directory for local development:

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_API_TIMEOUT=30000

# Database Configuration
NEXT_PUBLIC_DB_PATH=/data/forum.db
NEXT_PUBLIC_DB_UPDATE_INTERVAL=3600000

# Feature Flags
NEXT_PUBLIC_ENABLE_PWA=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_EXPORT=true

# Performance
NEXT_PUBLIC_POSTS_PER_PAGE=50
NEXT_PUBLIC_VIRTUALIZATION_THRESHOLD=100
```

### Build Configuration

Configure build settings in `next.config.js`:

```javascript
module.exports = {
  output: 'export',
  basePath: '/fscrape-frontend',
  images: { unoptimized: true },
  // Additional configuration...
}
```

## 🌐 Browser Compatibility

| Browser       | Minimum Version | Notes         |
| ------------- | --------------- | ------------- |
| Chrome        | 90+             | Full support  |
| Firefox       | 88+             | Full support  |
| Safari        | 14+             | Full support  |
| Edge          | 90+             | Full support  |
| Opera         | 76+             | Full support  |
| Mobile Chrome | 90+             | PWA supported |
| Mobile Safari | 14+             | Limited PWA   |

## 🔐 Security

- Content Security Policy (CSP) headers
- HTTPS enforcement
- Regular dependency updates
- Security scanning in CI/CD pipeline
- Input sanitization and validation
- XSS protection
- SQL injection prevention

## 🚑 Troubleshooting

### Common Issues

#### Installation Issues

**Problem**: `npm install` fails with peer dependency errors

```bash
# Solution: Use legacy peer deps flag
npm install --legacy-peer-deps
```

**Problem**: Node version mismatch

```bash
# Solution: Use correct Node version
nvm use 18
# or
nvm install 18 && nvm use 18
```

#### Build Issues

**Problem**: Build fails with memory error

```bash
# Solution: Increase Node memory limit
NODE_OPTIONS="--max-old-space-size=4096" npm run build
```

**Problem**: Static export validation fails

```bash
# Solution: Check for dynamic routes and API calls
npm run validate:export
```

#### Runtime Issues

**Problem**: Database not loading

```bash
# Solution: Update database and verify path
npm run db:update
npm run db:validate
```

**Problem**: PWA not installing

```bash
# Solution: Ensure HTTPS and valid manifest
# Check DevTools > Application > Manifest
```

#### Testing Issues

**Problem**: E2E tests failing

```bash
# Solution: Install Playwright dependencies
npm run test:e2e:install
# Run tests in headed mode for debugging
npm run test:e2e:headed
```

### Getting Help

If you encounter issues not covered here:

1. Check [existing issues](https://github.com/neonwatty/fscrape-frontend/issues)
2. Search [discussions](https://github.com/neonwatty/fscrape-frontend/discussions)
3. Create a [new issue](https://github.com/neonwatty/fscrape-frontend/issues/new) with:
   - Node/npm versions (`node -v`, `npm -v`)
   - Error messages and logs
   - Steps to reproduce
   - Expected vs actual behavior

## 📄 License

This project is licensed under the ISC License. See [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Live Demo](https://neonwatty.github.io/fscrape-frontend)
- [User Guide](./docs/USER_GUIDE.md)
- [Features Overview](./docs/FEATURES.md)
- [API Documentation](./docs/API.md)
- [Architecture Overview](./docs/ARCHITECTURE.md)
- [Contributing Guide](CONTRIBUTING.md)
- [Deployment Guide](DEPLOYMENT.md)
- [Issues](https://github.com/neonwatty/fscrape-frontend/issues)

## 👥 Team

Maintained by the Forum Scraper team. See [CONTRIBUTORS](CONTRIBUTORS.md) for a list of contributors.

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)
