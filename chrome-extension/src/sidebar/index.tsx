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

function Sidebar() {
  const [data, setData] = useState<SidebarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>('all');
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
  }, [data, searchQuery, selectedSubreddit, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * postsPerPage,
    currentPage * postsPerPage
  );

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
