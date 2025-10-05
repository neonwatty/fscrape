# fscrape Chrome Extension - Testing Checklist

## Pre-Test Setup
- [ ] Load unpacked extension from `dist/` folder in Chrome
- [ ] Open Chrome DevTools to monitor console logs
- [ ] Clear all existing extension data (if any)

---

## 1. Fresh Installation Testing

### First Launch
- [ ] Extension icon appears in toolbar
- [ ] No errors in console on installation
- [ ] Navigate to reddit.com - no errors

### Pin Button Display
- [ ] Visit reddit.com/r/programming
- [ ] Pin button appears in bottom-right corner
- [ ] Button shows "📍 Pin Subreddit" (not pinned state)
- [ ] Button is clickable and styled correctly

---

## 2. Data Collection Testing

### Pin a Subreddit
- [ ] Click "Pin" button on r/programming
- [ ] Button changes to "📌 Tracking" (green color)
- [ ] Counter badge appears showing "0"
- [ ] Console shows: "r/programming pinned, starting to track posts..."

### Scroll and Collect Posts
- [ ] Scroll down the page
- [ ] Counter badge increments (e.g., "0" → "5" → "10")
- [ ] Console shows: "Saved post: [title]..." for each new post
- [ ] Console shows: "Skipped duplicate: ..." for already-saved posts
- [ ] Scroll to load 25+ posts total

### Navigate Within Reddit
- [ ] Click on a post to open it
- [ ] Return to r/programming listing
- [ ] Counter should maintain count (not reset)
- [ ] Pin button still shows "Tracking"

### Navigate to Different Subreddit
- [ ] Visit r/datascience
- [ ] Pin button shows "📍 Pin Subreddit" (not pinned)
- [ ] Pin this subreddit
- [ ] Collect 15+ posts by scrolling
- [ ] Counter shows correct count

### Test Small Subreddit
- [ ] Visit a small subreddit (< 100 subscribers)
- [ ] Pin and collect all visible posts
- [ ] No errors when reaching end of posts

---

## 3. Popup UI Testing

### Open Popup
- [ ] Click extension icon in toolbar
- [ ] Popup opens (380px wide)
- [ ] No console errors

### Stats Display
- [ ] "Total Posts" shows combined count from all subreddits
- [ ] "Pinned" shows number of pinned subreddits (should be 2-3)
- [ ] "Last Scrape" shows recent time ("Just now" or "5m ago")
- [ ] "Storage" shows data size (< 1 MB typically)

### Pinned Subreddits List
- [ ] Section shows "Pinned Subreddits"
- [ ] Lists all pinned subreddits (r/programming, r/datascience, etc.)
- [ ] Each shows post count
- [ ] Unpin button (✕) appears for each

### Unpin Functionality
- [ ] Click ✕ next to one subreddit
- [ ] Subreddit disappears from list
- [ ] Visit that subreddit - pin button shows "Pin Subreddit" (not tracking)
- [ ] Posts from that subreddit remain in database (check dashboard)

### Actions - View Dashboard
- [ ] Click "📊 View Dashboard" button
- [ ] Sidebar panel opens on right side
- [ ] Dashboard loads without errors

### Actions - Export JSON
- [ ] Click "📥 Export JSON" button
- [ ] File downloads: `fscrape-export-[timestamp].json`
- [ ] Open file - should be valid JSON array
- [ ] Contains all posts with all fields

### Actions - Export CSV
- [ ] Click "📊 Export CSV" button
- [ ] File downloads: `fscrape-export-[timestamp].csv`
- [ ] Open in spreadsheet app (Excel/Google Sheets)
- [ ] Headers row correct: id, subreddit, title, author, etc.
- [ ] Data rows properly formatted
- [ ] Quotes and commas escaped correctly

### Actions - Clear All Data
- [ ] Click "🗑️ Clear All Data" button
- [ ] Confirmation dialog appears
- [ ] Shows correct count of posts and subreddits
- [ ] Click "Cancel" - nothing happens
- [ ] Click button again, then "OK"
- [ ] Success alert appears: "✅ All data has been cleared"
- [ ] Stats show 0 posts, 0 pinned, 0 storage
- [ ] Pinned subreddits list disappears
- [ ] Clear button no longer visible (no data to clear)

---

## 4. Sidebar Dashboard Testing

### Open Dashboard
- [ ] Re-pin subreddits and collect more posts (50+ total)
- [ ] Open popup and click "View Dashboard"
- [ ] Sidebar opens and loads data

### Stats Overview
- [ ] Shows total posts count
- [ ] Shows total subreddits
- [ ] Shows pinned subreddits count
- [ ] Numbers match popup stats

### Engagement Heatmap
- [ ] Heatmap appears with 7 rows (days) × 24 columns (hours)
- [ ] Cells show color intensity
- [ ] Hover over cell - tooltip shows details (day, hour, posts, score, comments)
- [ ] Metric selector has 4 options: Engagement, Post Count, Avg Score, Avg Comments
- [ ] Change metric - colors update appropriately
- [ ] Click "Show Optimal Times" button
- [ ] Top 5 optimal times panel appears
- [ ] Shows day, hour, performance badge, recommendation
- [ ] Click "Hide Optimal Times" - panel disappears

### Posts Over Time Chart
- [ ] Line chart appears showing posts by date
- [ ] X-axis shows dates
- [ ] Y-axis shows post counts
- [ ] Area fill under line visible
- [ ] Points on line for each data point

### Top Subreddits Chart
- [ ] Bar chart shows up to 10 subreddits
- [ ] Sorted by post count (highest first)
- [ ] Bars show relative sizes
- [ ] Numbers appear on bars

### Most Engaged Posts
- [ ] Shows top 5 posts by engagement
- [ ] Rank badges (1-5) visible
- [ ] Post titles are clickable links
- [ ] Opens in new tab to Reddit
- [ ] Shows subreddit name
- [ ] Shows upvotes and comment count

### Filters
- [ ] Search box: Type "python" - filters posts containing "python"
- [ ] Search box: Clear search - all posts return
- [ ] Date range: Select "Last 7 Days" - only recent posts show
- [ ] Date range: Select "All Time" - all posts return
- [ ] Subreddit filter: Select specific subreddit - only that sub's posts show
- [ ] Subreddit filter: Select "All Subreddits" - all posts return
- [ ] "Clear filters" button appears when filters active
- [ ] Click "Clear filters" - resets all filters

### Posts Table
- [ ] Table shows up to 50 posts per page
- [ ] Columns: Title, Subreddit, Score, Comments, Date, Author
- [ ] Click column header to sort (Title, Score, Comments, Date)
- [ ] Sort arrow (↑/↓) indicates sort direction
- [ ] Click again to reverse sort
- [ ] Post titles are clickable links
- [ ] Results count shows "Showing X of Y posts"

### Pagination
- [ ] If >50 posts, pagination appears
- [ ] Shows "Page 1 of N"
- [ ] "Previous" button disabled on page 1
- [ ] "Next" button enabled
- [ ] Click "Next" - page 2 loads
- [ ] Click "Previous" - back to page 1
- [ ] "Next" disabled on last page

---

## 5. Edge Cases Testing

### Private Subreddit
- [ ] Visit a private subreddit (if accessible)
- [ ] Extension handles gracefully - no crashes
- [ ] Console may show warning about restricted access

### Deleted/Removed Posts
- [ ] Find posts with [deleted] or [removed] content
- [ ] Extension saves them with "[deleted]" as author
- [ ] No errors in console

### NSFW Subreddit
- [ ] Visit and pin an NSFW subreddit
- [ ] Posts collected correctly
- [ ] `is_nsfw` field set to true

### Old Reddit
- [ ] Visit old.reddit.com/r/programming
- [ ] Pin button appears correctly
- [ ] Collect posts by scrolling
- [ ] Posts saved with all data

### New Reddit (www)
- [ ] Visit www.reddit.com/r/programming
- [ ] Functionality works same as sh.reddit.com

### No Internet / Failed Requests
- [ ] Disconnect internet briefly
- [ ] Extension should not crash
- [ ] Reconnect - functionality resumes

### Very Large Dataset
- [ ] Collect 1000+ posts across multiple subreddits
- [ ] Open dashboard - should load within 2-3 seconds
- [ ] Heatmap renders correctly
- [ ] Table pagination works
- [ ] Filters still performant
- [ ] Export still works (may take a few seconds)

---

## 6. Data Persistence Testing

### Browser Restart
- [ ] Note current post count and pinned subreddits
- [ ] Close Chrome completely
- [ ] Reopen Chrome
- [ ] Open popup - stats should match previous count
- [ ] Open dashboard - all data still present

### Extension Reload
- [ ] Go to chrome://extensions
- [ ] Click reload icon on fscrape
- [ ] Open popup - data persists
- [ ] Functionality still works

---

## 7. Performance Testing

### Memory Usage
- [ ] Open Chrome Task Manager (Shift+Esc)
- [ ] Find fscrape extension process
- [ ] Memory should be reasonable (< 100 MB with 1000+ posts)

### Dashboard Load Time
- [ ] With 1000+ posts, open dashboard
- [ ] Should load in < 3 seconds
- [ ] No lag when interacting with charts

### Export Performance
- [ ] Export 1000+ posts as JSON
- [ ] Should complete in < 5 seconds
- [ ] Export as CSV
- [ ] Should complete in < 5 seconds

---

## 8. Browser Compatibility

This extension is Chrome-only, but test across versions:
- [ ] Chrome Stable (latest)
- [ ] Chrome Beta (if available)

---

## Known Issues / Limitations

Document any issues found:
1.
2.
3.

---

## Testing Results

**Date Tested:** _______________
**Tester:** _______________
**Chrome Version:** _______________

**Overall Result:** ☐ Pass  ☐ Pass with Issues  ☐ Fail

**Critical Issues Found:**
-

**Minor Issues Found:**
-

**Performance Notes:**
-

**Recommendations:**
-
