import { createRoot } from 'react-dom/client';
import { useState, useEffect, useMemo } from 'react';
import { MessageType, type Stats, type Subreddit, type Post } from '../shared/types';
import './styles.css';

interface SidebarData {
  stats: Stats;
  subreddits: Subreddit[];
  posts: Post[];
}

type SortField = 'created_at' | 'score' | 'comment_count' | 'title';
type SortDirection = 'asc' | 'desc';
type DateRange = '7d' | '30d' | '90d' | 'all';

// Simple Bar Chart Component
function BarChart({ data, title }: { data: { label: string; value: number; color?: string }[]; title: string }) {
  if (data.length === 0) return null;
  const maxValue = Math.max(...data.map(d => d.value), 1); // Ensure at least 1 to avoid division by 0

  return (
    <div className="chart-container">
      <h3 className="chart-title">{title}</h3>
      <div className="bar-chart">
        {data.map((item, index) => (
          <div key={index} className="bar-item">
            <div className="bar-label">{item.label}</div>
            <div className="bar-wrapper">
              <div
                className="bar-fill"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color || '#3b82f6',
                }}
              />
              <span className="bar-value">{item.value.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Simple Line Chart Component
function TrendChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length === 0) return null;

  const maxCount = Math.max(...data.map(d => d.count), 1); // Ensure at least 1 to avoid division by 0
  const width = 600;
  const height = 200;
  const padding = 40;

  const points = data.map((d, i) => {
    // Handle single data point case
    const x = data.length === 1
      ? width / 2
      : padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (d.count / maxCount) * (height - padding * 2);
    return `${x},${y}`;
  }).join(' ');

  return (
    <div className="chart-container">
      <h3 className="chart-title">Posts Over Time</h3>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="trend-chart">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
          <line
            key={ratio}
            x1={padding}
            y1={padding + (1 - ratio) * (height - padding * 2)}
            x2={width - padding}
            y2={padding + (1 - ratio) * (height - padding * 2)}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* Area fill */}
        <polygon
          points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
          fill="rgba(59, 130, 246, 0.1)"
        />

        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#3b82f6"
          strokeWidth="2"
        />

        {/* Points */}
        {data.map((d, i) => {
          const x = data.length === 1
            ? width / 2
            : padding + (i / (data.length - 1)) * (width - padding * 2);
          const y = height - padding - (d.count / maxCount) * (height - padding * 2);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              fill="#3b82f6"
            />
          );
        })}
      </svg>
    </div>
  );
}

function Sidebar() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 50;

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [statsResponse, subredditsResponse, postsResponse] = await Promise.all([
        chrome.runtime.sendMessage({ type: MessageType.GET_STATS }),
        chrome.runtime.sendMessage({ type: MessageType.GET_SUBREDDITS }),
        chrome.runtime.sendMessage({ type: MessageType.GET_POSTS, payload: { limit: 999999 } }),
      ]);

      if (statsResponse?.success && subredditsResponse?.success && postsResponse?.success) {
        setData({
          stats: statsResponse.data,
          subreddits: subredditsResponse.data.subreddits || [],
          posts: postsResponse.data.posts || [],
        });
      } else {
        setError('Failed to load data');
      }
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort posts
  const filteredPosts = useMemo(() => {
    if (!data) return [];

    let filtered = [...data.posts];

    // Date range filter
    if (dateRange !== 'all') {
      const now = Date.now();
      const cutoff = (() => {
        switch (dateRange) {
          case '7d':
            return now - 7 * 24 * 60 * 60 * 1000;
          case '30d':
            return now - 30 * 24 * 60 * 60 * 1000;
          case '90d':
            return now - 90 * 24 * 60 * 60 * 1000;
          default:
            return 0;
        }
      })();
      filtered = filtered.filter((post) => post.created_at >= cutoff);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.author.toLowerCase().includes(query) ||
          post.subreddit.toLowerCase().includes(query) ||
          post.content?.toLowerCase().includes(query)
      );
    }

    // Subreddit filter
    if (selectedSubreddit !== 'all') {
      filtered = filtered.filter((post) => post.subreddit === selectedSubreddit);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal: any;
      let bVal: any;

      switch (sortField) {
        case 'title':
          aVal = a.title.toLowerCase();
          bVal = b.title.toLowerCase();
          break;
        case 'created_at':
          aVal = a.created_at;
          bVal = b.created_at;
          break;
        case 'score':
          aVal = a.score;
          bVal = b.score;
          break;
        case 'comment_count':
          aVal = a.comment_count;
          bVal = b.comment_count;
          break;
        default:
          aVal = a.created_at;
          bVal = b.created_at;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [data, searchQuery, selectedSubreddit, dateRange, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * postsPerPage,
    currentPage * postsPerPage
  );

  // Chart data calculations
  const chartData = useMemo(() => {
    if (!data) return null;

    // Subreddit breakdown (top 10)
    const subredditCounts = data.subreddits
      .sort((a, b) => b.post_count - a.post_count)
      .slice(0, 10)
      .map(sub => ({
        label: `r/${sub.name}`,
        value: sub.post_count,
      }));

    // Posts over time (group by day, last 30 days)
    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const postsByDay = new Map<string, number>();

    data.posts.forEach(post => {
      if (post.created_at >= thirtyDaysAgo) {
        const date = new Date(post.created_at).toLocaleDateString();
        postsByDay.set(date, (postsByDay.get(date) || 0) + 1);
      }
    });

    const trendData = Array.from(postsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14); // Last 14 days

    // Top posts by engagement
    const topPosts = [...data.posts]
      .sort((a, b) => (b.score + b.comment_count) - (a.score + a.comment_count))
      .slice(0, 5);

    return { subredditCounts, trendData, topPosts };
  }, [data]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  if (loading) {
    return (
      <div className="sidebar-container">
        <div className="sidebar-loading">
          <div className="spinner"></div>
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="sidebar-container">
        <div className="sidebar-error">
          <p>⚠️ {error || 'Failed to load'}</p>
          <button onClick={loadData} className="btn btn-sm">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="sidebar-container">
      {/* Header */}
      <div className="sidebar-header">
        <h1 className="sidebar-title">📊 fscrape Dashboard</h1>
        <button onClick={loadData} className="btn-refresh" title="Refresh data">
          🔄
        </button>
      </div>

      {/* Stats Overview */}
      <div className="stats-overview">
        <div className="stat-box">
          <div className="stat-label">Total Posts</div>
          <div className="stat-value">{data.stats.total_posts.toLocaleString()}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Subreddits</div>
          <div className="stat-value">{data.stats.total_subreddits}</div>
        </div>
        <div className="stat-box">
          <div className="stat-label">Pinned</div>
          <div className="stat-value">{data.stats.pinned_subreddits}</div>
        </div>
      </div>

      {/* Charts */}
      {chartData && (
        <div className="charts-section">
          {chartData.trendData.length > 0 && <TrendChart data={chartData.trendData} />}

          {chartData.subredditCounts.length > 0 && (
            <BarChart data={chartData.subredditCounts} title="Top Subreddits" />
          )}

          {chartData.topPosts.length > 0 && (
            <div className="chart-container">
              <h3 className="chart-title">Most Engaged Posts</h3>
              <div className="top-posts-list">
                {chartData.topPosts.map((post, index) => (
                  <div key={post.id} className="top-post-item">
                    <div className="top-post-rank">{index + 1}</div>
                    <div className="top-post-content">
                      <a
                        href={post.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="top-post-title"
                      >
                        {post.title}
                      </a>
                      <div className="top-post-meta">
                        <span className="top-post-subreddit">r/{post.subreddit}</span>
                        <span className="top-post-engagement">
                          ↑ {formatNumber(post.score)} · 💬 {formatNumber(post.comment_count)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="filters">
        <input
          type="text"
          placeholder="Search posts..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="search-input"
        />

        <select
          value={dateRange}
          onChange={(e) => {
            setDateRange(e.target.value as DateRange);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="all">All Time</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>

        <select
          value={selectedSubreddit}
          onChange={(e) => {
            setSelectedSubreddit(e.target.value);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="all">All Subreddits</option>
          {data.subreddits.map((sub) => (
            <option key={sub.name} value={sub.name}>
              r/{sub.name} ({sub.post_count})
            </option>
          ))}
        </select>
      </div>

      {/* Results Count */}
      <div className="results-info">
        Showing {paginatedPosts.length} of {filteredPosts.length} posts
        {filteredPosts.length !== data.posts.length && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSubreddit('all');
              setDateRange('all');
            }}
            className="btn-clear"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Posts Table */}
      <div className="table-container">
        <table className="posts-table">
          <thead>
            <tr>
              <th onClick={() => handleSort('title')} className="sortable">
                Title {sortField === 'title' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>Subreddit</th>
              <th onClick={() => handleSort('score')} className="sortable">
                Score {sortField === 'score' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('comment_count')} className="sortable">
                Comments {sortField === 'comment_count' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th onClick={() => handleSort('created_at')} className="sortable">
                Date {sortField === 'created_at' && (sortDirection === 'asc' ? '↑' : '↓')}
              </th>
              <th>Author</th>
            </tr>
          </thead>
          <tbody>
            {paginatedPosts.length === 0 ? (
              <tr>
                <td colSpan={6} className="no-results">
                  No posts found
                </td>
              </tr>
            ) : (
              paginatedPosts.map((post) => (
                <tr key={post.id}>
                  <td className="post-title">
                    <a href={post.url} target="_blank" rel="noopener noreferrer" title={post.title}>
                      {post.title}
                    </a>
                  </td>
                  <td className="post-subreddit">r/{post.subreddit}</td>
                  <td className="post-score">{formatNumber(post.score)}</td>
                  <td className="post-comments">{formatNumber(post.comment_count)}</td>
                  <td className="post-date">{formatDate(post.created_at)}</td>
                  <td className="post-author">u/{post.author}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn-page"
          >
            ← Previous
          </button>

          <span className="page-info">
            Page {currentPage} of {totalPages}
          </span>

          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="btn-page"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<Sidebar />);
}
