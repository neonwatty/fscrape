/**
 * Library View Component
 * Shows manually saved posts with tags, folders, and filters
 */

import { useState, useEffect, useMemo } from 'react';
import { MessageType, type SavedPost, type Tag, type Folder, type LibraryStats } from '../../shared/types';

interface LibraryViewProps {
  onRefresh?: () => void;
}

type FilterType = 'all' | 'favorites' | 'unread' | 'folder' | 'tag';
type SortField = 'saved_at' | 'created_at' | 'score' | 'comment_count' | 'title';
type SortDirection = 'asc' | 'desc';

export function LibraryView({ onRefresh }: LibraryViewProps) {
  const [posts, setPosts] = useState<SavedPost[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<LibraryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('saved_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showTagManager, setShowTagManager] = useState(false);
  const [editingTagColor, setEditingTagColor] = useState<{name: string, color: string} | null>(null);
  const [showFolderManager, setShowFolderManager] = useState(false);
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDescription, setNewFolderDescription] = useState('');
  const postsPerPage = 20;

  const TAG_COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#6366f1', '#f97316',
    '#ef4444', '#14b8a6', '#f43f5e', '#84cc16',
  ];

  useEffect(() => {
    loadData();
  }, [filterType, selectedFolder, selectedTag]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load stats, tags, and folders
      const [statsResponse, tagsResponse, foldersResponse] = await Promise.all([
        chrome.runtime.sendMessage({ type: MessageType.GET_LIBRARY_STATS }),
        chrome.runtime.sendMessage({ type: MessageType.GET_ALL_TAGS }),
        chrome.runtime.sendMessage({ type: MessageType.GET_ALL_FOLDERS }),
      ]);

      if (statsResponse?.success) {
        setStats(statsResponse.data);
      }

      if (tagsResponse?.success) {
        setTags(tagsResponse.data || []);
      }

      if (foldersResponse?.success) {
        setFolders(foldersResponse.data || []);
      }

      // Load posts based on filter
      let postsResponse;
      switch (filterType) {
        case 'favorites':
          postsResponse = await chrome.runtime.sendMessage({
            type: MessageType.GET_FAVORITED_POSTS,
            payload: { limit: 999999 },
          });
          break;
        case 'unread':
          postsResponse = await chrome.runtime.sendMessage({
            type: MessageType.GET_UNREAD_POSTS,
            payload: { limit: 999999 },
          });
          break;
        case 'folder':
          if (selectedFolder) {
            postsResponse = await chrome.runtime.sendMessage({
              type: MessageType.GET_SAVED_POSTS_BY_FOLDER,
              payload: { folderId: selectedFolder, limit: 999999 },
            });
          } else {
            postsResponse = await chrome.runtime.sendMessage({
              type: MessageType.GET_ALL_SAVED_POSTS,
              payload: { limit: 999999 },
            });
          }
          break;
        case 'tag':
          if (selectedTag) {
            postsResponse = await chrome.runtime.sendMessage({
              type: MessageType.GET_SAVED_POSTS_BY_TAG,
              payload: { tag: selectedTag, limit: 999999 },
            });
          } else {
            postsResponse = await chrome.runtime.sendMessage({
              type: MessageType.GET_ALL_SAVED_POSTS,
              payload: { limit: 999999 },
            });
          }
          break;
        default:
          postsResponse = await chrome.runtime.sendMessage({
            type: MessageType.GET_ALL_SAVED_POSTS,
            payload: { limit: 999999 },
          });
      }

      if (postsResponse?.success) {
        setPosts(postsResponse.data || []);
      }
    } catch (err) {
      console.error('Error loading library:', err);
      setError('Failed to load library');
    } finally {
      setLoading(false);
    }

    if (onRefresh) {
      onRefresh();
    }
  };

  // Filter and sort posts
  const filteredPosts = useMemo(() => {
    let filtered = [...posts];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post) =>
          post.title.toLowerCase().includes(query) ||
          post.author.toLowerCase().includes(query) ||
          post.subreddit.toLowerCase().includes(query) ||
          post.notes?.toLowerCase().includes(query) ||
          post.content?.toLowerCase().includes(query)
      );
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
        case 'saved_at':
          aVal = a.saved_at;
          bVal = b.saved_at;
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
          aVal = a.saved_at;
          bVal = b.saved_at;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [posts, searchQuery, sortField, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(filteredPosts.length / postsPerPage);
  const paginatedPosts = filteredPosts.slice(
    (currentPage - 1) * postsPerPage,
    currentPage * postsPerPage
  );

  const handleToggleFavorite = async (post: SavedPost) => {
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.TOGGLE_FAVORITE,
        payload: { id: post.id },
      });
      await loadData();
    } catch (err) {
      console.error('Error toggling favorite:', err);
    }
  };

  const handleUpdateTagColor = async (tagName: string, newColor: string) => {
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.UPDATE_TAG,
        payload: {
          name: tagName,
          updates: { color: newColor },
        },
      });

      // Update local state
      setTags(tags.map(t => t.name === tagName ? { ...t, color: newColor } : t));
      setEditingTagColor(null);
    } catch (err) {
      console.error('Error updating tag color:', err);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const newFolder: Folder = {
        id: crypto.randomUUID(),
        name: newFolderName.trim(),
        description: newFolderDescription.trim(),
        post_count: 0,
        created_at: Date.now(),
        updated_at: Date.now(),
      };

      await chrome.runtime.sendMessage({
        type: MessageType.CREATE_FOLDER,
        payload: newFolder,
      });

      setFolders([...folders, newFolder]);
      setNewFolderName('');
      setNewFolderDescription('');
      setShowFolderModal(false);
      setEditingFolder(null);
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  const handleUpdateFolder = async () => {
    if (!editingFolder || !newFolderName.trim()) return;

    try {
      await chrome.runtime.sendMessage({
        type: MessageType.UPDATE_FOLDER,
        payload: {
          id: editingFolder.id,
          updates: {
            name: newFolderName.trim(),
            description: newFolderDescription.trim(),
            updated_at: Date.now(),
          },
        },
      });

      setFolders(folders.map(f =>
        f.id === editingFolder.id
          ? { ...f, name: newFolderName.trim(), description: newFolderDescription.trim(), updated_at: Date.now() }
          : f
      ));
      setNewFolderName('');
      setNewFolderDescription('');
      setShowFolderModal(false);
      setEditingFolder(null);
    } catch (err) {
      console.error('Error updating folder:', err);
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (!folder) return;

    if (!confirm(`Delete folder "${folder.name}"? Posts in this folder will not be deleted.`)) return;

    try {
      await chrome.runtime.sendMessage({
        type: MessageType.DELETE_FOLDER,
        payload: { id: folderId },
      });

      setFolders(folders.filter(f => f.id !== folderId));
      if (selectedFolder === folderId) {
        setSelectedFolder(null);
        setFilterType('all');
      }
    } catch (err) {
      console.error('Error deleting folder:', err);
    }
  };

  const openFolderModal = (folder?: Folder) => {
    if (folder) {
      setEditingFolder(folder);
      setNewFolderName(folder.name);
      setNewFolderDescription(folder.description);
    } else {
      setEditingFolder(null);
      setNewFolderName('');
      setNewFolderDescription('');
    }
    setShowFolderModal(true);
  };

  const handleToggleRead = async (post: SavedPost) => {
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.TOGGLE_READ,
        payload: { id: post.id },
      });
      await loadData();
    } catch (err) {
      console.error('Error toggling read:', err);
    }
  };

  const handleDelete = async (post: SavedPost) => {
    if (!confirm(`Delete "${post.title}"?`)) return;

    try {
      await chrome.runtime.sendMessage({
        type: MessageType.DELETE_SAVED_POST,
        payload: { id: post.id },
      });
      await loadData();
    } catch (err) {
      console.error('Error deleting post:', err);
    }
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

  const getTagColor = (tagName: string): string => {
    const tag = tags.find((t) => t.name === tagName);
    return tag?.color || '#6b7280';
  };

  const getFolderName = (folderId: string | null): string => {
    if (!folderId) return '';
    const folder = folders.find((f) => f.id === folderId);
    return folder?.name || '';
  };

  if (loading) {
    return (
      <div className="library-loading">
        <div className="spinner"></div>
        <p>Loading library...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="library-error">
        <p>⚠️ {error}</p>
        <button onClick={loadData} className="btn btn-sm">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="library-view">
      {/* Stats Overview */}
      {stats && (
        <div className="stats-overview">
          <div className="stat-box">
            <div className="stat-label">Saved Posts</div>
            <div className="stat-value">{stats.total_saved}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Tags</div>
            <div className="stat-value">{stats.total_tags}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Folders</div>
            <div className="stat-value">{stats.total_folders}</div>
          </div>
          <div className="stat-box">
            <div className="stat-label">Unread</div>
            <div className="stat-value">{stats.unread}</div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="library-filters">
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => {
              setFilterType('all');
              setSelectedFolder(null);
              setSelectedTag(null);
              setCurrentPage(1);
            }}
          >
            All Posts
          </button>
          <button
            className={`filter-tab ${filterType === 'favorites' ? 'active' : ''}`}
            onClick={() => {
              setFilterType('favorites');
              setSelectedFolder(null);
              setSelectedTag(null);
              setCurrentPage(1);
            }}
          >
            ⭐ Favorites
          </button>
          <button
            className={`filter-tab ${filterType === 'unread' ? 'active' : ''}`}
            onClick={() => {
              setFilterType('unread');
              setSelectedFolder(null);
              setSelectedTag(null);
              setCurrentPage(1);
            }}
          >
            📖 Unread
          </button>
        </div>

        {/* Tag Filter */}
        {tags.length > 0 && (
          <div className="tag-filter">
            <div className="filter-header">
              <label className="filter-label">Filter by Tag:</label>
              <button
                className="manage-tags-btn"
                onClick={() => setShowTagManager(!showTagManager)}
              >
                {showTagManager ? '✓ Done' : '🎨 Manage Colors'}
              </button>
            </div>
            <div className="tag-pills">
              <button
                className={`tag-pill ${filterType === 'all' || filterType === 'favorites' || filterType === 'unread' ? '' : selectedTag === null ? 'active' : ''}`}
                onClick={() => {
                  setFilterType('all');
                  setSelectedTag(null);
                  setCurrentPage(1);
                }}
              >
                All
              </button>
              {tags.map((tag) => (
                <button
                  key={tag.name}
                  className={`tag-pill ${filterType === 'tag' && selectedTag === tag.name ? 'active' : ''}`}
                  style={{
                    backgroundColor: filterType === 'tag' && selectedTag === tag.name ? tag.color : 'transparent',
                    borderColor: tag.color,
                    color: filterType === 'tag' && selectedTag === tag.name ? 'white' : tag.color,
                  }}
                  onClick={() => {
                    setFilterType('tag');
                    setSelectedTag(tag.name);
                    setSelectedFolder(null);
                    setCurrentPage(1);
                  }}
                >
                  {tag.display_name} ({tag.post_count})
                </button>
              ))}
            </div>

            {/* Tag Manager */}
            {showTagManager && (
              <div className="tag-manager">
                <div className="tag-manager-list">
                  {tags.map((tag) => (
                    <div key={tag.name} className="tag-manager-item">
                      <div className="tag-manager-info">
                        <div
                          className="tag-manager-color-preview"
                          style={{ background: tag.color }}
                        />
                        <span className="tag-manager-name">{tag.display_name}</span>
                        <span className="tag-manager-count">({tag.post_count} posts)</span>
                      </div>
                      <button
                        className="tag-manager-edit-btn"
                        onClick={() => setEditingTagColor({ name: tag.name, color: tag.color })}
                      >
                        Edit Color
                      </button>
                    </div>
                  ))}
                </div>

                {/* Color Picker Modal */}
                {editingTagColor && (
                  <div className="tag-color-modal">
                    <div className="tag-color-modal-content">
                      <h3>Choose Color for {tags.find(t => t.name === editingTagColor.name)?.display_name}</h3>
                      <div className="tag-color-grid">
                        {TAG_COLORS.map((color) => (
                          <button
                            key={color}
                            className={`tag-color-option ${editingTagColor.color === color ? 'selected' : ''}`}
                            style={{ background: color }}
                            onClick={() => setEditingTagColor({ ...editingTagColor, color })}
                          />
                        ))}
                      </div>
                      <div className="tag-color-modal-actions">
                        <button
                          className="btn-save"
                          onClick={() => handleUpdateTagColor(editingTagColor.name, editingTagColor.color)}
                        >
                          Save
                        </button>
                        <button
                          className="btn-cancel"
                          onClick={() => setEditingTagColor(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Folder Filter */}
        <div className="folder-filter">
          <div className="filter-header">
            <label className="filter-label">Filter by Folder:</label>
            <button
              className="manage-folders-btn"
              onClick={() => setShowFolderManager(!showFolderManager)}
            >
              {showFolderManager ? '✓ Done' : '📁 Manage Folders'}
            </button>
          </div>

          {folders.length > 0 && (
            <div className="folder-pills">
              <button
                className={`folder-pill ${filterType === 'all' || filterType === 'favorites' || filterType === 'unread' || filterType === 'tag' ? '' : selectedFolder === null ? 'active' : ''}`}
                onClick={() => {
                  setFilterType('all');
                  setSelectedFolder(null);
                  setCurrentPage(1);
                }}
              >
                All
              </button>
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  className={`folder-pill ${filterType === 'folder' && selectedFolder === folder.id ? 'active' : ''}`}
                  onClick={() => {
                    setFilterType('folder');
                    setSelectedFolder(folder.id);
                    setSelectedTag(null);
                    setCurrentPage(1);
                  }}
                >
                  📁 {folder.name} ({folder.post_count})
                </button>
              ))}
            </div>
          )}

          {/* Folder Manager */}
          {showFolderManager && (
            <div className="folder-manager">
              <div className="folder-manager-header">
                <h3>Manage Folders</h3>
                <button
                  className="btn-create-folder"
                  onClick={() => openFolderModal()}
                >
                  + New Folder
                </button>
              </div>

              {folders.length === 0 ? (
                <div className="folder-manager-empty">
                  <p>No folders yet. Create one to organize your saved posts.</p>
                </div>
              ) : (
                <div className="folder-manager-list">
                  {folders.map((folder) => (
                    <div key={folder.id} className="folder-manager-item">
                      <div className="folder-manager-info">
                        <div className="folder-manager-icon">📁</div>
                        <div className="folder-manager-details">
                          <span className="folder-manager-name">{folder.name}</span>
                          {folder.description && (
                            <span className="folder-manager-description">{folder.description}</span>
                          )}
                          <span className="folder-manager-meta">
                            {folder.post_count} posts • Created {formatDate(folder.created_at)}
                          </span>
                        </div>
                      </div>
                      <div className="folder-manager-actions">
                        <button
                          className="folder-manager-edit-btn"
                          onClick={() => openFolderModal(folder)}
                        >
                          Edit
                        </button>
                        <button
                          className="folder-manager-delete-btn"
                          onClick={() => handleDeleteFolder(folder.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Folder Create/Edit Modal */}
          {showFolderModal && (
            <div className="folder-modal-overlay" onClick={() => setShowFolderModal(false)}>
              <div className="folder-modal" onClick={(e) => e.stopPropagation()}>
                <div className="folder-modal-header">
                  <h3>{editingFolder ? 'Edit Folder' : 'Create New Folder'}</h3>
                  <button
                    className="folder-modal-close"
                    onClick={() => setShowFolderModal(false)}
                  >
                    ×
                  </button>
                </div>
                <div className="folder-modal-content">
                  <div className="folder-modal-field">
                    <label>Folder Name *</label>
                    <input
                      type="text"
                      placeholder="e.g., Python Tutorials"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="folder-modal-field">
                    <label>Description (optional)</label>
                    <textarea
                      placeholder="Add a description for this folder..."
                      value={newFolderDescription}
                      onChange={(e) => setNewFolderDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                <div className="folder-modal-actions">
                  <button
                    className="btn-cancel"
                    onClick={() => setShowFolderModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-save"
                    onClick={editingFolder ? handleUpdateFolder : handleCreateFolder}
                    disabled={!newFolderName.trim()}
                  >
                    {editingFolder ? 'Update' : 'Create'} Folder
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Search and Sort */}
      <div className="library-controls">
        <input
          type="text"
          placeholder="Search saved posts..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setCurrentPage(1);
          }}
          className="search-input"
        />

        <select
          value={sortField}
          onChange={(e) => {
            setSortField(e.target.value as SortField);
            setCurrentPage(1);
          }}
          className="filter-select"
        >
          <option value="saved_at">Sort by: Saved Date</option>
          <option value="created_at">Sort by: Post Date</option>
          <option value="score">Sort by: Score</option>
          <option value="comment_count">Sort by: Comments</option>
          <option value="title">Sort by: Title</option>
        </select>

        <button
          className="sort-direction-btn"
          onClick={() => setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')}
          title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortDirection === 'asc' ? '↑' : '↓'}
        </button>
      </div>

      {/* Results Count */}
      <div className="results-info">
        {filteredPosts.length} post{filteredPosts.length !== 1 ? 's' : ''}
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="btn-clear">
            Clear search
          </button>
        )}
      </div>

      {/* Posts List */}
      <div className="library-posts">
        {paginatedPosts.length === 0 ? (
          <div className="empty-state">
            <p>📚 No saved posts yet</p>
            <p className="empty-state-hint">
              Click the "Save" button on any Reddit post to add it to your library
            </p>
          </div>
        ) : (
          paginatedPosts.map((post) => (
            <div key={post.id} className="library-post-card">
              <div className="post-card-header">
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="post-card-title"
                >
                  {post.title}
                </a>
                <div className="post-card-actions">
                  <button
                    className={`action-btn ${post.is_favorited ? 'active' : ''}`}
                    onClick={() => handleToggleFavorite(post)}
                    title={post.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    {post.is_favorited ? '⭐' : '☆'}
                  </button>
                  <button
                    className={`action-btn ${post.is_read ? 'active' : ''}`}
                    onClick={() => handleToggleRead(post)}
                    title={post.is_read ? 'Mark as unread' : 'Mark as read'}
                  >
                    {post.is_read ? '✓' : '○'}
                  </button>
                  <button
                    className="action-btn delete"
                    onClick={() => handleDelete(post)}
                    title="Delete from library"
                  >
                    🗑️
                  </button>
                </div>
              </div>

              <div className="post-card-meta">
                <span className="post-meta-item">r/{post.subreddit}</span>
                <span className="post-meta-item">by u/{post.author}</span>
                <span className="post-meta-item">↑ {formatNumber(post.score)}</span>
                <span className="post-meta-item">💬 {formatNumber(post.comment_count)}</span>
                <span className="post-meta-item">Saved {formatDate(post.saved_at)}</span>
              </div>

              {post.tags.length > 0 && (
                <div className="post-card-tags">
                  {post.tags.map((tagName) => (
                    <span
                      key={tagName}
                      className="post-tag"
                      style={{ backgroundColor: getTagColor(tagName) }}
                    >
                      {tags.find((t) => t.name === tagName)?.display_name || tagName}
                    </span>
                  ))}
                </div>
              )}

              {post.folder_id && (
                <div className="post-card-folder">
                  📁 {getFolderName(post.folder_id)}
                </div>
              )}

              {post.notes && (
                <div className="post-card-notes">
                  <strong>Notes:</strong> {post.notes}
                </div>
              )}
            </div>
          ))
        )}
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
