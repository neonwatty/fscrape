# fscrape Chrome Extension

A Chrome extension that passively collects Reddit post data while you browse, with powerful visualization tools.

## Features

- 📌 **Pin subreddits** to track posts automatically
- 🔄 **Auto-saves posts** as you browse and scroll
- 💾 **Local storage** (IndexedDB) - all data stays in your browser
- 📊 **Interactive dashboard** with engagement heatmaps and optimal posting times
- 📥 **Export data** as JSON or CSV
- 🎯 **Works with all Reddit UIs** (old, new, sh.reddit.com)
- 👋 **Onboarding flow** for first-time users
- 🔒 **Privacy-first** - no external data collection

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Load in Chrome

1. Build the extension (see above)
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `chrome-extension/dist` folder

### Development Mode

For hot reload during development:

```bash
npm run dev
```

Then load the `dist` folder in Chrome as described above. Changes will auto-reload.

## How to Use

1. Install the extension (see installation instructions below)
2. Visit any subreddit (e.g., https://reddit.com/r/datascience)
3. Click the "Pin Subreddit" button that appears in bottom-right
4. Browse normally - posts are saved automatically as you scroll
5. Click the extension icon to view stats and access the dashboard
6. Explore engagement heatmaps, optimal posting times, and export your data

## Installation

### From Chrome Web Store (Recommended)
*Coming soon - extension is currently in review*

### Manual Installation (Development)
1. Clone this repository
2. Run `npm install` and `npm run build`
3. Open Chrome and navigate to `chrome://extensions/`
4. Enable "Developer mode" (toggle in top right)
5. Click "Load unpacked"
6. Select the `chrome-extension/dist` folder

## Project Structure

```
src/
├── content/              # Content script (runs on Reddit pages)
│   ├── index.ts          # Entry point
│   ├── reddit-scraper.ts # DOM extraction for all Reddit UIs
│   ├── scroll-observer.ts # IntersectionObserver for auto-save
│   ├── ui-injector.tsx   # Pin button UI (React)
│   ├── onboarding.tsx    # First-time user onboarding
│   └── styles.css        # Injected styles
├── background/           # Service worker
│   ├── service-worker.ts # Message handler
│   ├── storage.ts        # IndexedDB wrapper
│   └── data-manager.ts   # Business logic
├── shared/               # Shared code
│   ├── types.ts          # TypeScript interfaces
│   ├── constants.ts      # Constants
│   └── db-schema.ts      # Database schema
├── popup/                # Extension popup UI
│   ├── index.tsx         # Stats, pinned subreddits, actions
│   └── styles.css        # Popup styles
└── sidebar/              # Analytics dashboard
    ├── index.tsx         # Main dashboard component
    ├── components/       # Chart components
    └── styles.css        # Dashboard styles
```

## Technical Details

### Storage

- **IndexedDB** for post data (supports large datasets)
- **chrome.storage.local** for settings
- Default limit: 1000 posts per subreddit (configurable)

### Reddit UI Support

The scraper detects and handles three Reddit UI versions:

1. **Old Reddit** (`old.reddit.com`) - Classic HTML DOM
2. **New Reddit** (`www.reddit.com`) - React-based SPA
3. **Shreddit** (`sh.reddit.com`) - Web Components (custom elements)

### Data Collection

Posts are collected in two ways:

1. **Initial page load** - All visible posts saved immediately
2. **Scroll tracking** - New posts saved as they become visible (via IntersectionObserver)

No background scraping - collection only happens while you actively browse.

## Roadmap

### Phase 1: Foundation ✅
- Vite + React + TypeScript setup
- Manifest v3 configuration
- IndexedDB schema and storage manager
- Background service worker

### Phase 2: Content Script ✅
- Reddit DOM scraper (all UI versions)
- Scroll observer
- Pin button UI
- Content ↔ background messaging

### Phase 3: Popup UI ✅
- Stats display
- Pinned subreddit list
- Data export (JSON/CSV)
- Clear all data functionality

### Phase 4: Sidebar Dashboard ✅
- Engagement heatmap with optimal posting times
- Posts over time chart
- Top subreddits chart
- Most engaged posts
- Advanced filtering and search
- Pagination

### Phase 5: Polish ✅
- Error handling and retry logic
- Loading states
- Onboarding flow for first-time users
- Comprehensive testing checklist

### Phase 6: Chrome Web Store (In Progress)
- Store listing materials
- Privacy policy
- Screenshot guide
- Submission preparation

## License

MIT
