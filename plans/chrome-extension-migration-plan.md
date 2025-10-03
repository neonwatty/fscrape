# Chrome Extension Migration Plan

**Date:** October 3, 2025
**Objective:** Convert fscrape from CLI + Web frontend to a Chrome Extension for passive Reddit data collection and visualization

---

## Executive Summary

Transform fscrape into a Chrome extension that allows users to:
1. Passively collect Reddit post data while browsing
2. Explicitly "pin" subreddits they want to track
3. Visualize collected data via heatmaps and charts
4. Store all data locally in browser (IndexedDB)

**Key Philosophy:** User manually collects data through normal browsing, enabling multi-week datasets for less active subreddits without automation complexity.

---

## User Experience

### Installation & Setup
1. User installs extension from Chrome Web Store
2. First-time onboarding: "Visit any subreddit and click 'Pin' to start tracking"
3. Extension icon shows badge with total posts collected

### Data Collection Flow
1. User visits r/datascience (or any subreddit)
2. Extension detects Reddit page, shows floating "Pin Subreddit" button
3. User clicks "Pin" → subreddit added to tracking list
4. Extension automatically saves:
   - All posts visible on initial page load
   - Additional posts as user scrolls down
5. User continues browsing normally over days/weeks
6. Data accumulates silently in background

### Visualization
1. User clicks extension icon → popup shows:
   - Total posts: 1,247
   - Pinned subreddits: r/datascience, r/MachineLearning, r/Python
   - Last update: 2 minutes ago
2. Click "Open Dashboard" → sidebar opens with:
   - Subreddit selector dropdown
   - Activity heatmap (by day/hour)
   - Engagement chart (score vs comments)
   - Time series (posts over time)
   - Growth trends

### Settings
- Post limit per subreddit (default: 1000)
- Time-based cleanup (e.g., "keep last 4 weeks")
- Export data as JSON/CSV
- Clear all data

---

## Technical Architecture

### Project Structure

```
chrome-extension/
├── manifest.json                 # Manifest v3 config
├── src/
│   ├── content/                 # Injected into Reddit pages
│   │   ├── reddit-scraper.ts    # DOM extraction logic
│   │   ├── ui-injector.tsx      # "Pin Subreddit" button UI
│   │   ├── scroll-observer.ts   # IntersectionObserver for infinite scroll
│   │   └── index.ts             # Entry point
│   ├── background/              # Service worker (persistent background)
│   │   ├── service-worker.ts    # Main background script
│   │   ├── storage.ts           # IndexedDB wrapper
│   │   ├── data-manager.ts      # Deduplication, cleanup, limits
│   │   └── message-handler.ts   # Content ↔ background communication
│   ├── popup/                   # Extension popup (small UI)
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── Stats.tsx
│   │       ├── SubredditList.tsx
│   │       └── Settings.tsx
│   ├── sidebar/                 # Full visualization dashboard
│   │   ├── index.tsx
│   │   ├── App.tsx
│   │   └── components/
│   │       ├── Dashboard.tsx
│   │       └── charts/          # ← REUSED from packages/web
│   ├── shared/
│   │   ├── types.ts             # Post, Comment, Subreddit interfaces
│   │   ├── db-schema.ts         # IndexedDB schema definition
│   │   ├── constants.ts         # Default limits, settings
│   │   └── utils.ts             # Date formatting, etc.
│   └── ui/                      # ← REUSED from packages/web/components/ui
│       ├── button.tsx
│       ├── card.tsx
│       ├── select.tsx
│       └── ...
├── public/
│   ├── icons/
│   │   ├── icon16.png
│   │   ├── icon48.png
│   │   └── icon128.png
│   └── sidebar.html
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

---

## Data Model

### IndexedDB Stores

#### 1. `posts` Store
```typescript
interface Post {
  id: string;                    // reddit_${postId}
  platform_id: string;           // Reddit post ID (e.g., "t3_abc123")
  subreddit: string;             // e.g., "datascience"
  title: string;
  author: string;
  author_id?: string;
  url: string;
  content?: string;              // Selftext
  score: number;
  comment_count: number;
  created_at: number;            // Unix timestamp (ms)
  scraped_at: number;            // Unix timestamp (ms)
  flair?: string;
  is_nsfw: boolean;
  is_locked: boolean;
  is_stickied: boolean;
  thumbnail_url?: string;
  metadata?: string;             // JSON string
}
```

**Indexes:**
- `by_subreddit` (subreddit, created_at DESC)
- `by_created_at` (created_at DESC)
- `by_score` (score DESC)

#### 2. `subreddits` Store
```typescript
interface Subreddit {
  name: string;                  // Primary key (e.g., "datascience")
  display_name: string;          // With r/ prefix
  is_pinned: boolean;
  post_limit: number;            // Max posts to keep (default 1000)
  time_limit_days?: number;      // Optional time-based limit
  post_count: number;            // Current count
  last_scraped_at: number;
  first_scraped_at: number;
  created_at: number;            // When user pinned
}
```

#### 3. `settings` Store
```typescript
interface Settings {
  key: string;                   // Primary key
  value: any;
}

// Keys:
// - "default_post_limit": 1000
// - "default_time_limit_days": null
// - "theme": "dark" | "light" | "system"
// - "enable_notifications": boolean
```

---

## Implementation Details

### 1. Manifest v3 Configuration

```json
{
  "manifest_version": 3,
  "name": "fscrape - Reddit Data Collector",
  "version": "1.0.0",
  "description": "Collect and visualize Reddit data while browsing",
  "permissions": [
    "storage",
    "unlimitedStorage",
    "tabs",
    "sidePanel"
  ],
  "host_permissions": [
    "*://*.reddit.com/*"
  ],
  "background": {
    "service_worker": "background/service-worker.js",
    "type": "module"
  },
  "content_scripts": [
    {
      "matches": ["*://*.reddit.com/*"],
      "js": ["content/index.js"],
      "css": ["content/styles.css"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/index.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  "side_panel": {
    "default_path": "sidebar/index.html"
  }
}
```

### 2. Content Script: Reddit DOM Scraper

**reddit-scraper.ts**
```typescript
export class RedditScraper {
  // Detect Reddit UI version
  detectRedditUI(): 'new' | 'old' | 'sh' {
    if (window.location.hostname === 'old.reddit.com') return 'old';
    if (document.querySelector('shreddit-post')) return 'sh'; // New new Reddit
    return 'new';
  }

  // Extract posts from current page
  extractPosts(): Post[] {
    const uiVersion = this.detectRedditUI();

    switch (uiVersion) {
      case 'sh':
        return this.extractFromShredditUI();
      case 'new':
        return this.extractFromNewReddit();
      case 'old':
        return this.extractFromOldReddit();
    }
  }

  private extractFromShredditUI(): Post[] {
    const postElements = document.querySelectorAll('shreddit-post');
    return Array.from(postElements).map(el => ({
      platform_id: el.getAttribute('id') || '',
      subreddit: el.getAttribute('subreddit-prefixed-name')?.replace('r/', '') || '',
      title: el.querySelector('h3')?.textContent || '',
      author: el.getAttribute('author') || '',
      score: parseInt(el.getAttribute('score') || '0'),
      comment_count: parseInt(el.getAttribute('comment-count') || '0'),
      created_at: new Date(el.getAttribute('created-timestamp') || '').getTime(),
      url: el.getAttribute('permalink') || '',
      // ... more fields
    }));
  }

  // Similar for old/new Reddit...
}
```

**scroll-observer.ts**
```typescript
export class ScrollObserver {
  private observer: IntersectionObserver;
  private processedPostIds = new Set<string>();

  constructor(private scraper: RedditScraper) {
    this.observer = new IntersectionObserver(
      (entries) => this.handleIntersection(entries),
      { threshold: 0.1 }
    );
  }

  start() {
    // Observe all post elements
    const posts = document.querySelectorAll('shreddit-post, [data-post-click-location]');
    posts.forEach(post => this.observer.observe(post));

    // Watch for new posts added by infinite scroll
    new MutationObserver((mutations) => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node instanceof Element && this.isPostElement(node)) {
            this.observer.observe(node);
          }
        });
      });
    }).observe(document.body, { childList: true, subtree: true });
  }

  private async handleIntersection(entries: IntersectionObserverEntry[]) {
    for (const entry of entries) {
      if (entry.isIntersecting) {
        const post = this.scraper.extractPostFromElement(entry.target);

        if (post && !this.processedPostIds.has(post.platform_id)) {
          this.processedPostIds.add(post.platform_id);

          // Send to background for storage
          chrome.runtime.sendMessage({
            type: 'SAVE_POST',
            post
          });
        }
      }
    }
  }
}
```

**ui-injector.tsx**
```typescript
export class UIInjector {
  async injectPinButton() {
    const subreddit = this.getCurrentSubreddit();
    if (!subreddit) return;

    const isPinned = await this.checkIfPinned(subreddit);

    const button = document.createElement('div');
    button.id = 'fscrape-pin-button';
    button.innerHTML = isPinned
      ? '📌 Tracking'
      : '📍 Pin Subreddit';
    button.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${isPinned ? '#10b981' : '#3b82f6'};
      color: white;
      border-radius: 8px;
      cursor: pointer;
      z-index: 9999;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    button.onclick = () => this.togglePin(subreddit);
    document.body.appendChild(button);
  }

  private async togglePin(subreddit: string) {
    chrome.runtime.sendMessage({
      type: 'TOGGLE_PIN',
      subreddit
    });
  }
}
```

### 3. Background Service Worker

**storage.ts**
```typescript
export class StorageManager {
  private db: IDBDatabase | null = null;

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('fscrape', 1);

      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;

        // Create posts store
        const postsStore = db.createObjectStore('posts', { keyPath: 'id' });
        postsStore.createIndex('by_subreddit', ['subreddit', 'created_at']);
        postsStore.createIndex('by_created_at', 'created_at');
        postsStore.createIndex('by_score', 'score');

        // Create subreddits store
        db.createObjectStore('subreddits', { keyPath: 'name' });

        // Create settings store
        db.createObjectStore('settings', { keyPath: 'key' });
      };

      request.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve(undefined);
      };

      request.onerror = () => reject(request.error);
    });
  }

  async addPost(post: Post): Promise<void> {
    const tx = this.db!.transaction('posts', 'readwrite');
    await tx.objectStore('posts').put(post);
  }

  async getPostsBySubreddit(subreddit: string, limit = 1000): Promise<Post[]> {
    const tx = this.db!.transaction('posts', 'readonly');
    const index = tx.objectStore('posts').index('by_subreddit');
    const range = IDBKeyRange.bound([subreddit, 0], [subreddit, Date.now()]);

    const posts: Post[] = [];
    const cursor = await index.openCursor(range, 'prev');

    return new Promise((resolve) => {
      cursor.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest).result;
        if (cursor && posts.length < limit) {
          posts.push(cursor.value);
          cursor.continue();
        } else {
          resolve(posts);
        }
      };
    });
  }

  // More methods...
}
```

**data-manager.ts**
```typescript
export class DataManager {
  constructor(private storage: StorageManager) {}

  async savePost(post: Post): Promise<void> {
    // Check for duplicates
    const existing = await this.storage.getPostById(post.id);
    if (existing) {
      console.log('Post already exists, skipping:', post.id);
      return;
    }

    // Save post
    await this.storage.addPost(post);

    // Update subreddit stats
    await this.updateSubredditStats(post.subreddit);

    // Enforce limits
    await this.enforceSubredditLimit(post.subreddit);
  }

  private async enforceSubredditLimit(subreddit: string): Promise<void> {
    const sub = await this.storage.getSubreddit(subreddit);
    if (!sub) return;

    const posts = await this.storage.getPostsBySubreddit(subreddit);

    // Remove oldest posts if over limit
    if (posts.length > sub.post_limit) {
      const toDelete = posts
        .sort((a, b) => a.created_at - b.created_at)
        .slice(0, posts.length - sub.post_limit);

      for (const post of toDelete) {
        await this.storage.deletePost(post.id);
      }
    }

    // Remove old posts if time limit set
    if (sub.time_limit_days) {
      const cutoff = Date.now() - (sub.time_limit_days * 24 * 60 * 60 * 1000);
      const oldPosts = posts.filter(p => p.created_at < cutoff);

      for (const post of oldPosts) {
        await this.storage.deletePost(post.id);
      }
    }
  }
}
```

### 4. Code Reuse from Existing Packages

**Chart Components (from packages/web/components/charts/)**

Adapt these files:
- `HeatMap.tsx` - Activity heatmap by day/hour
- `EngagementChart.tsx` - Score vs comment count scatter
- `TimeSeriesChart.tsx` - Posts over time line chart
- `GrowthChart.tsx` - Cumulative posts growth

**Changes needed:**
```typescript
// OLD (packages/web - Next.js + SQL.js)
const db = await initSqlJs();
const result = db.exec('SELECT * FROM posts WHERE subreddit = ?');

// NEW (extension - IndexedDB)
const storage = await StorageManager.getInstance();
const posts = await storage.getPostsBySubreddit(subreddit);
```

**UI Components (from packages/web/components/ui/)**

Copy directly (no changes needed):
- `button.tsx`
- `card.tsx`
- `select.tsx`
- `tabs.tsx`
- `dialog.tsx`
- `tooltip.tsx`
- All other shadcn/ui components

### 5. Build Configuration

**vite.config.ts**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest })
  ],
  build: {
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        sidebar: 'src/sidebar/index.html',
      }
    }
  }
});
```

---

## Migration Checklist

### Phase 1: Foundation (Est. 4-6 hours)
- [ ] Initialize Vite project with Chrome extension template
- [ ] Configure Manifest v3
- [ ] Set up TypeScript + React + Tailwind
- [ ] Create IndexedDB schema and wrapper
- [ ] Build storage manager with basic CRUD operations
- [ ] Test IndexedDB persistence

### Phase 2: Content Script (Est. 6-8 hours)
- [ ] Build Reddit DOM scraper for new Reddit UI
- [ ] Build Reddit DOM scraper for old Reddit UI
- [ ] Build Reddit DOM scraper for sh.reddit.com UI
- [ ] Implement scroll observer with IntersectionObserver
- [ ] Create "Pin Subreddit" button UI
- [ ] Set up content ↔ background messaging
- [ ] Test data collection on various subreddits

### Phase 3: Background Worker (Est. 4-5 hours)
- [ ] Build message handler for content script events
- [ ] Implement deduplication logic
- [ ] Build data cleanup/limit enforcement
- [ ] Add subreddit tracking state management
- [ ] Test limits and cleanup logic

### Phase 4: Popup UI (Est. 3-4 hours)
- [ ] Design popup layout
- [ ] Show stats (total posts, subreddits)
- [ ] Display pinned subreddit list
- [ ] Add settings panel
- [ ] Wire up to IndexedDB
- [ ] Add "Open Dashboard" button

### Phase 5: Sidebar Dashboard (Est. 8-10 hours)
- [ ] Port chart components from packages/web
- [ ] Adapt data fetching layer (SQL.js → IndexedDB)
- [ ] Build subreddit selector
- [ ] Create dashboard layout
- [ ] Implement date range filters
- [ ] Test visualizations with real data
- [ ] Polish responsive design

### Phase 6: UI Components (Est. 2-3 hours)
- [ ] Copy shadcn/ui components from packages/web
- [ ] Configure Tailwind theme
- [ ] Test component rendering
- [ ] Adjust any styling for extension context

### Phase 7: Testing & Polish (Est. 4-6 hours)
- [ ] Test on multiple subreddits (small, medium, large)
- [ ] Test data persistence across browser restarts
- [ ] Verify storage limits work correctly
- [ ] Test on old vs new Reddit
- [ ] Handle edge cases (private subs, deleted posts, quarantined)
- [ ] Add loading states
- [ ] Add error handling
- [ ] Create onboarding flow
- [ ] Add data export (JSON/CSV)

### Phase 8: Distribution (Est. 2-3 hours)
- [ ] Create extension icons (16px, 48px, 128px)
- [ ] Write Chrome Web Store description
- [ ] Take screenshots for listing
- [ ] Create privacy policy
- [ ] Submit to Chrome Web Store
- [ ] Test published version

**Total Estimated Time:** 35-47 hours

---

## Key Design Decisions

### 1. **Explicit Subreddit Pinning**
**Decision:** Require users to click "Pin" button to track a subreddit
**Rationale:** Privacy-conscious, intentional, prevents accidental data collection
**Alternative considered:** Auto-track all visited subreddits (rejected: too aggressive)

### 2. **Save All Visible + Scroll**
**Decision:** Save posts visible on load + continue as user scrolls
**Rationale:** Balances completeness with performance
**Alternative considered:** Only save on scroll (rejected: misses initial posts)

### 3. **IndexedDB vs chrome.storage**
**Decision:** Use IndexedDB for posts, chrome.storage for settings
**Rationale:** IndexedDB has higher storage quota, better for large datasets
**Alternative considered:** chrome.storage.local (rejected: 10MB limit)

### 4. **Default 1000 Post Limit**
**Decision:** Keep last 1000 posts per subreddit
**Rationale:** ~2-4 weeks for moderately active subs, fits in ~50MB
**User-configurable:** Yes, can increase/decrease

### 5. **No Automated Scraping**
**Decision:** Only collect data when user actively browses
**Rationale:** Respects Reddit ToS, no background API calls, privacy-first
**Alternative considered:** Background scraping (rejected: ethical/legal concerns)

### 6. **Sidebar vs Popup for Viz**
**Decision:** Use Chrome's side panel API for visualizations
**Rationale:** More screen space for charts, persists across tabs
**Alternative considered:** Full-page dashboard (rejected: less convenient)

---

## Data Migration Strategy

**Not applicable** - This is a greenfield extension, existing CLI/web users won't migrate data.

If future data import is needed:
1. Export posts from CLI as JSON
2. Add "Import Data" button in extension settings
3. Parse JSON and insert into IndexedDB
4. Deduplicate by post ID

---

## Testing Strategy

### Manual Testing
1. **Subreddit types:**
   - High activity (r/AskReddit)
   - Medium activity (r/datascience)
   - Low activity (r/obscure_hobby)
   - NSFW subreddit
   - Quarantined subreddit

2. **User flows:**
   - Install → pin subreddit → browse → view dashboard
   - Pin multiple subreddits → compare in dashboard
   - Reach storage limit → verify cleanup
   - Unpin subreddit → verify data retained

3. **Edge cases:**
   - Private subreddit (no access)
   - Deleted posts
   - Removed posts
   - Locked threads
   - Archived posts

### Automated Testing
- Unit tests for storage manager (add/get/delete)
- Unit tests for data cleanup logic
- Unit tests for Reddit parsers
- E2E tests with Playwright (if feasible for extensions)

---

## Privacy & Ethics

### Data Storage
- All data stored locally in user's browser
- No data sent to external servers
- No analytics/tracking
- User can delete all data anytime

### Reddit ToS Compliance
- No automated scraping
- No background requests
- Only collect publicly visible data
- Respect rate limits (none needed since manual)
- User-initiated data collection only

### Privacy Policy
- Disclose data collection methods
- Explain local storage only
- List permissions and why needed
- Provide data deletion instructions

---

## Future Enhancements (Post-MVP)

### v1.1
- Comment scraping (in addition to posts)
- User profile tracking
- Multi-subreddit comparison views
- Dark/light theme toggle

### v1.2
- Export data as CSV/JSON
- Import data from CLI version
- Trend detection (rising posts)
- Notification for specific keywords

### v1.3
- Firefox extension port
- Custom filters (by flair, score threshold)
- Advanced analytics (sentiment analysis)
- Sharing dashboard links (via export)

---

## Files to Delete After Migration

Once extension is complete and tested:

```bash
# Delete CLI package
rm -rf packages/cli/

# Delete web frontend package
rm -rf packages/web/

# Delete monorepo config (no longer needed)
rm -rf package.json
rm -rf package-lock.json
rm -rf node_modules/

# Keep for reference
# - plans/ (archive this plan)
# - README.md (update to reflect extension)
```

---

## Success Metrics

**MVP Success Criteria:**
- [ ] Extension installs without errors
- [ ] Successfully collects posts from Reddit
- [ ] Data persists across browser restarts
- [ ] Visualizations render correctly
- [ ] Storage limits enforced properly
- [ ] Works on old + new Reddit
- [ ] No console errors during normal use

**User Experience Goals:**
- Setup time < 1 minute
- Data collection completely passive
- Dashboard loads in < 2 seconds
- Visualizations update in < 500ms

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Reddit changes DOM structure | High | High | Maintain parsers for multiple UI versions, add version detection |
| Storage quota exceeded | Medium | Medium | Implement aggressive cleanup, warn user before limit |
| Chrome Web Store rejection | Low | High | Follow all guidelines, clear privacy policy, test thoroughly |
| Extension conflicts with Reddit Enhancement Suite | Medium | Low | Use unique CSS classes, avoid global state pollution |
| Performance issues on large datasets | Medium | Medium | Virtualize lists, lazy load charts, add pagination |

---

## Timeline

**Conservative estimate:** 6-8 days of focused work
**Aggressive estimate:** 4-5 days with experience

**Recommended approach:**
- **Week 1:** Foundation + content script + background worker
- **Week 2:** UI (popup + sidebar) + chart porting
- **Week 3:** Testing + polish + Chrome Web Store submission

---

## Conclusion

This migration transforms fscrape from a technical CLI tool into an accessible browser extension that fits naturally into users' Reddit browsing habits. The passive collection model respects user agency and Reddit's terms while enabling rich data analysis over time.

**Next steps:**
1. Review and approve plan
2. Initialize extension project structure
3. Begin Phase 1 (Foundation)
