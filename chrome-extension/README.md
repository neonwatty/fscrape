# fscrape Chrome Extension

A Chrome extension that passively collects Reddit post data while you browse, with powerful visualization tools.

## Features

- 📌 Pin subreddits to track
- 🔄 Auto-saves posts as you browse and scroll
- 💾 Local storage (IndexedDB) - all data stays in your browser
- 📊 Rich visualizations (coming soon: popup and sidebar)
- 🎯 Works with all Reddit UI versions (old, new, sh.reddit.com)

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

1. Install the extension
2. Visit any subreddit (e.g., https://reddit.com/r/datascience)
3. Click the "Pin Subreddit" button that appears in bottom-right
4. Browse normally - posts are saved automatically as you scroll
5. After collecting data, click the extension icon to view stats

## Project Structure

```
src/
├── content/           # Content script (runs on Reddit pages)
│   ├── index.ts       # Entry point
│   ├── reddit-scraper.ts  # DOM extraction for all Reddit UIs
│   ├── scroll-observer.ts # IntersectionObserver for auto-save
│   ├── ui-injector.tsx    # Pin button UI (React)
│   └── styles.css     # Injected styles
├── background/        # Service worker
│   ├── service-worker.ts  # Message handler
│   ├── storage.ts     # IndexedDB wrapper
│   └── data-manager.ts    # Business logic
├── shared/            # Shared code
│   ├── types.ts       # TypeScript interfaces
│   ├── constants.ts   # Constants
│   └── db-schema.ts   # Database schema
├── popup/             # Extension popup (TODO)
└── sidebar/           # Visualization dashboard (TODO)
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

### Phase 3: Popup UI (In Progress)
- Stats display
- Pinned subreddit list
- Settings panel

### Phase 4: Sidebar Dashboard
- Activity heatmap
- Engagement charts
- Time series visualization
- Subreddit comparison

### Phase 5: Polish
- Error handling
- Loading states
- Onboarding flow
- Data export (JSON/CSV)

## License

MIT
