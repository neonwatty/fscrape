/**
 * Analytics Dashboard Component
 * Shows analytics for passively tracked Reddit posts
 */

import { useState, useEffect, useMemo } from 'react';
import { MessageType, type Stats, type Subreddit, type Post } from '../../shared/types';
import {
  generateEngagementHeatmap,
  getOptimalPostingTimes,
  getHeatmapColorValue,
  type HeatmapFilters,
} from '../lib/heatmap-utils';

interface AnalyticsDashboardProps {
  onRefresh?: () => void;
}

interface DashboardData {
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
  const maxValue = Math.max(...data.map(d => d.value), 1);

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

  const maxCount = Math.max(...data.map(d => d.count), 1);
  const width = 600;
  const height = 200;
  const padding = 40;

  const points = data.map((d, i) => {
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

// Engagement Heatmap Component
function HeatMapChart({ posts }: { posts: Post[] }) {
  const [metric, setMetric] = useState<HeatmapFilters['metric']>('avgEngagement');
  const [showOptimal, setShowOptimal] = useState(false);

  const heatmapData = useMemo(() => {
    return generateEngagementHeatmap(posts, { metric, minPosts: 0 });
  }, [posts, metric]);

  const optimalTimes = useMemo(() => {
    return getOptimalPostingTimes(heatmapData, metric, 5);
  }, [heatmapData, metric]);

  const maxValue = useMemo(() => {
    return Math.max(
      ...heatmapData.map((d) =>
        metric === 'posts' ? d.posts :
        metric === 'avgScore' ? d.avgScore :
        metric === 'avgComments' ? d.avgComments : d.avgEngagement
      ),
      1
    );
  }, [heatmapData, metric]);

  if (posts.length === 0) return null;

  const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hourLabels = Array.from({ length: 24 }, (_, i) => i);

  const formatHour = (hour: number) => {
    if (hour === 0) return '12a';
    if (hour < 12) return `${hour}a`;
    if (hour === 12) return '12p';
    return `${hour - 12}p`;
  };

  const getCellData = (day: number, hour: number) => {
    return heatmapData.find((d) => d.day === day && d.hour === hour);
  };

  const cellSize = 16;
  const labelWidth = 40;
  const topMargin = 20;

  return (
    <div className="chart-container">
      <div className="heatmap-header">
        <h3 className="chart-title">Engagement Heatmap</h3>
        <div className="heatmap-controls">
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as HeatmapFilters['metric'])}
            className="heatmap-select"
          >
            <option value="avgEngagement">Engagement</option>
            <option value="posts">Post Count</option>
            <option value="avgScore">Avg Score</option>
            <option value="avgComments">Avg Comments</option>
          </select>
          <button
            onClick={() => setShowOptimal(!showOptimal)}
            className={`heatmap-toggle ${showOptimal ? 'active' : ''}`}
          >
            {showOptimal ? 'Hide' : 'Show'} Optimal Times
          </button>
        </div>
      </div>

      {showOptimal && optimalTimes.length > 0 && (
        <div className="optimal-times">
          <h4 className="optimal-times-title">Top 5 Optimal Posting Times</h4>
          {optimalTimes.map((slot, index) => (
            <div key={`${slot.day}-${slot.hour}`} className="optimal-time-slot">
              <div className="optimal-rank">{index + 1}</div>
              <div className="optimal-info">
                <div className="optimal-time">
                  {slot.day} at {slot.hour}
                </div>
                <div className="optimal-desc">{slot.recommendation}</div>
              </div>
              <div className={`optimal-badge ${slot.performance}`}>
                {slot.performance}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="heatmap-scroll">
        <svg
          width={labelWidth + hourLabels.length * cellSize}
          height={topMargin + dayLabels.length * cellSize}
          className="heatmap-svg"
        >
          {/* Hour labels */}
          {hourLabels.map((hour) => (
            <text
              key={`hour-${hour}`}
              x={labelWidth + hour * cellSize + cellSize / 2}
              y={topMargin - 5}
              textAnchor="middle"
              fontSize="10"
              fill="#6b7280"
            >
              {hour % 3 === 0 ? formatHour(hour) : ''}
            </text>
          ))}

          {/* Day labels and cells */}
          {dayLabels.map((day, dayIndex) => (
            <g key={`day-${dayIndex}`}>
              {/* Day label */}
              <text
                x={labelWidth - 5}
                y={topMargin + dayIndex * cellSize + cellSize / 2 + 4}
                textAnchor="end"
                fontSize="12"
                fill="#374151"
                fontWeight="500"
              >
                {day}
              </text>

              {/* Hour cells */}
              {hourLabels.map((hour) => {
                const cellData = getCellData(dayIndex, hour);
                const value = cellData
                  ? metric === 'posts' ? cellData.posts :
                    metric === 'avgScore' ? cellData.avgScore :
                    metric === 'avgComments' ? cellData.avgComments : cellData.avgEngagement
                  : 0;
                const color = getHeatmapColorValue(value, maxValue, metric);

                return (
                  <g key={`cell-${dayIndex}-${hour}`}>
                    <rect
                      x={labelWidth + hour * cellSize}
                      y={topMargin + dayIndex * cellSize}
                      width={cellSize - 1}
                      height={cellSize - 1}
                      fill={color}
                      rx="2"
                      className="heatmap-cell"
                    >
                      <title>
                        {cellData
                          ? `${day} ${formatHour(hour)}\nPosts: ${cellData.posts}\nAvg Score: ${cellData.avgScore.toFixed(0)}\nAvg Comments: ${cellData.avgComments.toFixed(0)}`
                          : `${day} ${formatHour(hour)}: No data`}
                      </title>
                    </rect>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
      </div>

      <div className="heatmap-legend">
        <span className="heatmap-legend-label">Less</span>
        <div className="heatmap-legend-colors">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
            <div
              key={i}
              className="heatmap-legend-color"
              style={{ backgroundColor: getHeatmapColorValue(ratio * maxValue, maxValue, metric) }}
            />
          ))}
        </div>
        <span className="heatmap-legend-label">More</span>
      </div>
    </div>
  );
}

// Multi-Select Subreddit Filter Component
function SubredditMultiSelect({
  subreddits,
  selected,
  onChange,
}: {
  subreddits: Subreddit[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const toggleSubreddit = (subredditName: string) => {
    if (selected.includes(subredditName)) {
      onChange(selected.filter((s) => s !== subredditName));
    } else {
      onChange([...selected, subredditName]);
    }
  };

  const selectAll = () => {
    onChange(subreddits.map((s) => s.name));
  };

  const clearAll = () => {
    onChange([]);
  };

  const displayText =
    selected.length === 0
      ? 'All Subreddits'
      : selected.length === 1
      ? `r/${selected[0]}`
      : `${selected.length} subreddits selected`;

  return (
    <div className="subreddit-multiselect">
      <button
        className="multiselect-trigger"
        onClick={() => setIsOpen(!isOpen)}
        type="button"
      >
        {displayText}
        <span className="multiselect-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <>
          <div className="multiselect-backdrop" onClick={() => setIsOpen(false)} />
          <div className="multiselect-dropdown">
            <div className="multiselect-header">
              <button onClick={selectAll} className="multiselect-action" type="button">
                Select All
              </button>
              <button onClick={clearAll} className="multiselect-action" type="button">
                Clear All
              </button>
            </div>
            <div className="multiselect-list">
              {subreddits.map((sub) => (
                <label key={sub.name} className="multiselect-option">
                  <input
                    type="checkbox"
                    checked={selected.includes(sub.name)}
                    onChange={() => toggleSubreddit(sub.name)}
                  />
                  <span className="multiselect-label">
                    r/{sub.name} ({sub.post_count})
                  </span>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {selected.length > 0 && (
        <div className="multiselect-pills">
          {selected.map((name) => (
            <span key={name} className="subreddit-pill">
              r/{name}
              <button
                onClick={() => toggleSubreddit(name)}
                className="pill-remove"
                type="button"
                aria-label={`Remove r/${name}`}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function AnalyticsDashboard({ onRefresh }: AnalyticsDashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubreddits, setSelectedSubreddits] = useState<string[]>([]);
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

    if (onRefresh) {
      onRefresh();
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
    if (selectedSubreddits.length > 0) {
      filtered = filtered.filter((post) => selectedSubreddits.includes(post.subreddit));
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
  }, [data, searchQuery, selectedSubreddits, dateRange, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * postsPerPage,
    currentPage * postsPerPage
  );

  // Chart data calculations
  const chartData = useMemo(() => {
    if (!data) return null;

    const subredditPostCounts = new Map<string, number>();
    filteredPosts.forEach(post => {
      subredditPostCounts.set(post.subreddit, (subredditPostCounts.get(post.subreddit) || 0) + 1);
    });

    const subredditCounts = Array.from(subredditPostCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({
        label: `r/${name}`,
        value: count,
      }));

    const now = Date.now();
    const thirtyDaysAgo = now - (30 * 24 * 60 * 60 * 1000);
    const postsByDay = new Map<string, number>();

    filteredPosts.forEach(post => {
      if (post.created_at >= thirtyDaysAgo) {
        const date = new Date(post.created_at).toLocaleDateString();
        postsByDay.set(date, (postsByDay.get(date) || 0) + 1);
      }
    });

    const trendData = Array.from(postsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14);

    const topPosts = [...filteredPosts]
      .sort((a, b) => (b.score + b.comment_count) - (a.score + a.comment_count))
      .slice(0, 5);

    return { subredditCounts, trendData, topPosts };
  }, [data, filteredPosts]);

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
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>Loading analytics...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="dashboard-error">
        <p>⚠️ {error || 'Failed to load'}</p>
        <button onClick={loadData} className="btn btn-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
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
          {filteredPosts.length > 0 && <HeatMapChart posts={filteredPosts} />}

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

        <SubredditMultiSelect
          subreddits={data.subreddits}
          selected={selectedSubreddits}
          onChange={(selected) => {
            setSelectedSubreddits(selected);
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Results Count */}
      <div className="results-info">
        Showing {paginatedPosts.length} of {filteredPosts.length} posts
        {filteredPosts.length !== data.posts.length && (
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedSubreddits([]);
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
