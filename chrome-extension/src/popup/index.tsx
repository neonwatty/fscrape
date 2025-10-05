import { createRoot } from 'react-dom/client';
import { useState, useEffect } from 'react';
import { MessageType, type Stats, type Subreddit } from '../shared/types';
import { Settings } from './components/Settings';
import './styles.css';

interface PopupStats extends Stats {
  subreddits: Subreddit[];
}

type Tab = 'dashboard' | 'settings';

function Popup() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [stats, setStats] = useState<PopupStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get stats
      const statsResponse = await chrome.runtime.sendMessage({
        type: MessageType.GET_STATS,
      });

      // Get subreddits
      const subredditsResponse = await chrome.runtime.sendMessage({
        type: MessageType.GET_SUBREDDITS,
      });

      if (statsResponse?.success && subredditsResponse?.success) {
        setStats({
          ...statsResponse.data,
          subreddits: subredditsResponse.data.subreddits || [],
        });
      } else {
        setError('Failed to load stats');
      }
    } catch (err) {
      console.error('Error loading stats:', err);
      setError('Failed to load stats');
    } finally {
      setLoading(false);
    }
  };

  const openSidebar = async () => {
    try {
      // Get current window
      const window = await chrome.windows.getCurrent();
      if (window.id) {
        // Open sidebar in current window
        await chrome.sidePanel.open({ windowId: window.id });
      }
    } catch (err) {
      console.error('Failed to open sidebar:', err);
      alert('Failed to open dashboard. Please try right-clicking the extension icon.');
    }
  };

  const handleExportJSON = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_POSTS,
        payload: { limit: 999999 },
      });

      if (response?.success) {
        const posts = response.data.posts;
        const dataStr = JSON.stringify(posts, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `fscrape-export-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
      alert('Failed to export data');
    }
  };

  const handleExportCSV = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_POSTS,
        payload: { limit: 999999 },
      });

      if (response?.success) {
        const posts = response.data.posts;

        // CSV headers
        const headers = ['id', 'subreddit', 'title', 'author', 'url', 'score', 'comment_count', 'created_at', 'scraped_at', 'flair', 'is_nsfw', 'is_locked', 'is_stickied'];

        // Convert posts to CSV rows
        const csvRows = [headers.join(',')];
        posts.forEach((post: any) => {
          const row = [
            `"${(post.id || '').replace(/"/g, '""')}"`,
            `"${(post.subreddit || '').replace(/"/g, '""')}"`,
            `"${(post.title || '').replace(/"/g, '""')}"`,
            `"${(post.author || '').replace(/"/g, '""')}"`,
            `"${(post.url || '').replace(/"/g, '""')}"`,
            post.score || 0,
            post.comment_count || 0,
            post.created_at || 0,
            post.scraped_at || 0,
            `"${(post.flair || '').replace(/"/g, '""')}"`,
            post.is_nsfw ? 'true' : 'false',
            post.is_locked ? 'true' : 'false',
            post.is_stickied ? 'true' : 'false',
          ];
          csvRows.push(row.join(','));
        });

        const csvStr = csvRows.join('\n');
        const csvBlob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(csvBlob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `fscrape-export-${Date.now()}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export CSV error:', err);
      alert('Failed to export CSV');
    }
  };

  const handleClearAllData = async () => {
    const confirmed = confirm(
      `⚠️ Are you sure you want to delete ALL tracked data?\n\n` +
      `This will permanently delete:\n` +
      `• ${stats?.total_posts.toLocaleString() || 0} posts\n` +
      `• ${stats?.total_subreddits || 0} subreddit${stats?.total_subreddits === 1 ? '' : 's'}\n\n` +
      `This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.DELETE_ALL_DATA,
      });

      if (response?.success) {
        alert('✅ All data has been cleared successfully');
        await loadStats();
      } else {
        throw new Error(response?.error || 'Unknown error');
      }
    } catch (err) {
      console.error('Clear data error:', err);
      alert('❌ Failed to clear data: ' + (err as Error).message);
    }
  };

  const handleUnpin = async (subreddit: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.TOGGLE_PIN,
        payload: { subreddit },
      });

      // Reload stats
      await loadStats();
    } catch (err) {
      console.error('Unpin error:', err);
    }
  };

  const formatTimestamp = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="popup-container">
        <div className="popup-loading">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="popup-container">
        <div className="popup-error">
          <p>⚠️ {error || 'Failed to load'}</p>
          <button onClick={loadStats} className="btn btn-sm">Retry</button>
        </div>
      </div>
    );
  }

  const pinnedSubreddits = stats.subreddits.filter(s => s.is_pinned);

  return (
    <div className="popup-container">
      {/* Header */}
      <div className="popup-header">
        <h1 className="popup-title">📊 fscrape</h1>
      </div>

      {/* Tab Navigation */}
      <div className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' ? (
        <Settings />
      ) : (
        <>
      {/* Dashboard Stats Content */}

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <div className="stat-value">{stats.total_posts.toLocaleString()}</div>
            <div className="stat-label">Total Posts</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">📌</div>
          <div className="stat-content">
            <div className="stat-value">{stats.pinned_subreddits}</div>
            <div className="stat-label">Pinned</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">🕐</div>
          <div className="stat-content">
            <div className="stat-value">{formatTimestamp(stats.last_scraped_at)}</div>
            <div className="stat-label">Last Scrape</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">💾</div>
          <div className="stat-content">
            <div className="stat-value">{formatBytes(stats.storage_used_mb * 1024 * 1024)}</div>
            <div className="stat-label">Storage</div>
          </div>
        </div>
      </div>

      {/* Pinned Subreddits */}
      {pinnedSubreddits.length > 0 && (
        <div className="section">
          <h2 className="section-title">Pinned Subreddits</h2>
          <div className="subreddit-list">
            {pinnedSubreddits.map((sub) => (
              <div key={sub.name} className="subreddit-item">
                <div className="subreddit-info">
                  <div className="subreddit-name">r/{sub.name}</div>
                  <div className="subreddit-count">{sub.post_count.toLocaleString()} posts</div>
                </div>
                <button
                  onClick={() => handleUnpin(sub.name)}
                  className="btn-unpin"
                  title="Unpin subreddit"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="actions">
        <button onClick={openSidebar} className="btn btn-primary">
          📊 View Dashboard
        </button>

        <div className="export-group">
          <button onClick={handleExportJSON} className="btn btn-secondary">
            📥 Export JSON
          </button>
          <button onClick={handleExportCSV} className="btn btn-secondary">
            📊 Export CSV
          </button>
        </div>

        {stats.total_posts > 0 && (
          <button onClick={handleClearAllData} className="btn btn-danger">
            🗑️ Clear All Data
          </button>
        )}
      </div>

      {/* Footer */}
      <div className="popup-footer">
        <a
          href="https://github.com/neonwatty/fscrape"
          target="_blank"
          rel="noopener noreferrer"
          className="footer-link"
        >
          View on GitHub
        </a>
      </div>
        </>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Popup />);
}
