/**
 * Save Modal Component
 * Modal UI for saving posts to library with tags, folders, notes
 */

import { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageType } from '../shared/types';
import type { Post, SavedPost, Tag, Folder } from '../shared/types';

interface SaveModalProps {
  post: Post;
  onClose: () => void;
  onSave: (savedPost: SavedPost) => void;
}

function SaveModal({ post, onClose, onSave }: SaveModalProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [availableFolders, setAvailableFolders] = useState<Folder[]>([]);
  const [notes, setNotes] = useState<string>('');
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [newTagName, setNewTagName] = useState<string>('');
  const [newTagColor, setNewTagColor] = useState<string>('#3b82f6');
  const [showTagInput, setShowTagInput] = useState<boolean>(false);
  const [showFolderInput, setShowFolderInput] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [newFolderDescription, setNewFolderDescription] = useState<string>('');

  const tagInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const TAG_COLORS = [
    '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#06b6d4', '#6366f1', '#f97316',
    '#ef4444', '#14b8a6', '#f43f5e', '#84cc16',
  ];

  useEffect(() => {
    loadTagsAndFolders();
  }, []);

  useEffect(() => {
    if (showTagInput && tagInputRef.current) {
      tagInputRef.current.focus();
    }
  }, [showTagInput]);

  useEffect(() => {
    if (showFolderInput && folderInputRef.current) {
      folderInputRef.current.focus();
    }
  }, [showFolderInput]);

  const loadTagsAndFolders = async () => {
    try {
      // Load existing tags
      const tagsResponse = await chrome.runtime.sendMessage({
        type: MessageType.GET_ALL_TAGS,
      });
      if (tagsResponse?.success && tagsResponse.data) {
        setAvailableTags(tagsResponse.data);
      }

      // Load existing folders
      const foldersResponse = await chrome.runtime.sendMessage({
        type: MessageType.GET_ALL_FOLDERS,
      });
      if (foldersResponse?.success && foldersResponse.data) {
        setAvailableFolders(foldersResponse.data);
      }
    } catch (error) {
      console.error('Error loading tags/folders:', error);
    }
  };

  const handleAddTag = (tagName: string) => {
    const normalized = tagName.toLowerCase().trim();
    if (normalized && !tags.includes(normalized)) {
      setTags([...tags, normalized]);
    }
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(tags.filter((t) => t !== tagName));
  };

  const handleCreateNewTag = async () => {
    const normalized = newTagName.toLowerCase().trim();
    if (!normalized) return;

    // Check if tag already exists
    if (availableTags.some((t) => t.name === normalized)) {
      handleAddTag(normalized);
      setNewTagName('');
      setNewTagColor('#3b82f6');
      setShowTagInput(false);
      return;
    }

    // Create new tag
    const newTag: Tag = {
      name: normalized,
      display_name: newTagName.trim(),
      color: newTagColor,
      post_count: 0,
      created_at: Date.now(),
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.CREATE_TAG,
        payload: newTag,
      });

      if (response?.success) {
        setAvailableTags([...availableTags, newTag]);
        handleAddTag(normalized);
        setNewTagName('');
        setNewTagColor('#3b82f6');
        setShowTagInput(false);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const handleCreateNewFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;

    // Check if folder already exists
    if (availableFolders.some((f) => f.name.toLowerCase() === name.toLowerCase())) {
      const existing = availableFolders.find((f) => f.name.toLowerCase() === name.toLowerCase());
      if (existing) {
        setFolderId(existing.id);
      }
      setNewFolderName('');
      setNewFolderDescription('');
      setShowFolderInput(false);
      return;
    }

    // Create new folder
    const newFolder: Folder = {
      id: crypto.randomUUID(),
      name: name,
      description: newFolderDescription.trim(),
      post_count: 0,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.CREATE_FOLDER,
        payload: newFolder,
      });

      if (response?.success) {
        setAvailableFolders([...availableFolders, newFolder]);
        setFolderId(newFolder.id);
        setNewFolderName('');
        setNewFolderDescription('');
        setShowFolderInput(false);
      }
    } catch (error) {
      console.error('Error creating folder:', error);
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const savedPost: SavedPost = {
        id: `saved_${post.platform_id}`,
        platform_id: post.platform_id,
        subreddit: post.subreddit,
        title: post.title,
        author: post.author,
        url: post.url,
        content: post.content,
        score: post.score,
        comment_count: post.comment_count,
        created_at: post.created_at,
        saved_at: Date.now(),
        tags,
        folder_id: folderId,
        notes,
        is_favorited: isFavorited,
        is_read: false,
        flair: post.flair,
        is_nsfw: post.is_nsfw,
        is_locked: post.is_locked,
        is_stickied: post.is_stickied,
        thumbnail_url: post.thumbnail_url,
        author_id: post.author_id,
      };

      const response = await chrome.runtime.sendMessage({
        type: MessageType.SAVE_POST_TO_LIBRARY,
        payload: savedPost,
      });

      if (response?.success) {
        onSave(savedPost);
        onClose();
      }
    } catch (error) {
      console.error('Error saving post:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fscrape-modal-overlay" onClick={onClose}>
      <div className="fscrape-modal fscrape-save-modal" onClick={(e) => e.stopPropagation()}>
        <div className="fscrape-modal-header">
          <h2 className="fscrape-modal-title">Save to Library</h2>
          <button className="fscrape-modal-close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="fscrape-modal-content">
          {/* Post Preview */}
          <div className="fscrape-save-modal-preview">
            <h3>{post.title}</h3>
            <div className="fscrape-save-modal-meta">
              r/{post.subreddit} • by u/{post.author}
            </div>
          </div>

          {/* Tags Section */}
          <div className="fscrape-save-modal-section">
            <label className="fscrape-save-modal-label">Tags</label>

            {/* Selected Tags */}
            {tags.length > 0 && (
              <div className="fscrape-save-modal-tags-selected">
                {tags.map((tagName) => {
                  const tag = availableTags.find((t) => t.name === tagName);
                  return (
                    <span
                      key={tagName}
                      className="fscrape-tag-pill"
                      style={{ background: tag?.color || '#6b7280' }}
                    >
                      {tag?.display_name || tagName}
                      <button
                        className="fscrape-tag-pill-remove"
                        onClick={() => handleRemoveTag(tagName)}
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}

            {/* Tag Selector */}
            <div className="fscrape-save-modal-tags-picker">
              {availableTags.map((tag) => (
                <button
                  key={tag.name}
                  className={`fscrape-tag-option ${tags.includes(tag.name) ? 'fscrape-tag-option-selected' : ''}`}
                  style={{ borderColor: tag.color }}
                  onClick={() =>
                    tags.includes(tag.name)
                      ? handleRemoveTag(tag.name)
                      : handleAddTag(tag.name)
                  }
                >
                  {tag.display_name}
                </button>
              ))}

              {/* New Tag Input */}
              {showTagInput ? (
                <div className="fscrape-tag-new-container">
                  <div className="fscrape-tag-new-input">
                    <input
                      ref={tagInputRef}
                      type="text"
                      placeholder="New tag name..."
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleCreateNewTag();
                        } else if (e.key === 'Escape') {
                          setNewTagName('');
                          setNewTagColor('#3b82f6');
                          setShowTagInput(false);
                        }
                      }}
                    />
                    <button onClick={handleCreateNewTag}>✓</button>
                    <button onClick={() => {
                      setNewTagName('');
                      setNewTagColor('#3b82f6');
                      setShowTagInput(false);
                    }}>×</button>
                  </div>
                  <div className="fscrape-tag-color-picker">
                    {TAG_COLORS.map((color) => (
                      <button
                        key={color}
                        className={`fscrape-tag-color-option ${newTagColor === color ? 'fscrape-tag-color-selected' : ''}`}
                        style={{ background: color }}
                        onClick={() => setNewTagColor(color)}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <button
                  className="fscrape-tag-add-btn"
                  onClick={() => setShowTagInput(true)}
                >
                  + New Tag
                </button>
              )}
            </div>
          </div>

          {/* Folder Section */}
          <div className="fscrape-save-modal-section">
            <label className="fscrape-save-modal-label">Folder</label>

            {showFolderInput ? (
              <div className="fscrape-folder-create-inline">
                <input
                  ref={folderInputRef}
                  type="text"
                  placeholder="Folder name..."
                  className="fscrape-folder-input"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateNewFolder();
                    } else if (e.key === 'Escape') {
                      setNewFolderName('');
                      setNewFolderDescription('');
                      setShowFolderInput(false);
                    }
                  }}
                />
                <input
                  type="text"
                  placeholder="Description (optional)..."
                  className="fscrape-folder-input"
                  value={newFolderDescription}
                  onChange={(e) => setNewFolderDescription(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateNewFolder();
                    } else if (e.key === 'Escape') {
                      setNewFolderName('');
                      setNewFolderDescription('');
                      setShowFolderInput(false);
                    }
                  }}
                />
                <div className="fscrape-folder-create-buttons">
                  <button
                    type="button"
                    className="fscrape-folder-btn-create"
                    onClick={handleCreateNewFolder}
                  >
                    ✓ Create
                  </button>
                  <button
                    type="button"
                    className="fscrape-folder-btn-cancel"
                    onClick={() => {
                      setNewFolderName('');
                      setNewFolderDescription('');
                      setShowFolderInput(false);
                    }}
                  >
                    × Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="fscrape-folder-select-wrapper">
                <select
                  className="fscrape-save-modal-select"
                  value={folderId || ''}
                  onChange={(e) => setFolderId(e.target.value || null)}
                >
                  <option value="">No folder</option>
                  {availableFolders.map((folder) => (
                    <option key={folder.id} value={folder.id}>
                      {folder.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="fscrape-folder-add-btn"
                  onClick={() => setShowFolderInput(true)}
                >
                  + New Folder
                </button>
              </div>
            )}
          </div>

          {/* Notes Section */}
          <div className="fscrape-save-modal-section">
            <label className="fscrape-save-modal-label">Notes</label>
            <textarea
              className="fscrape-save-modal-textarea"
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Favorite Checkbox */}
          <div className="fscrape-save-modal-section">
            <label className="fscrape-save-modal-checkbox">
              <input
                type="checkbox"
                checked={isFavorited}
                onChange={(e) => setIsFavorited(e.target.checked)}
              />
              <span>Mark as favorite ⭐</span>
            </label>
          </div>
        </div>

        <div className="fscrape-modal-footer">
          <button className="fscrape-modal-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="fscrape-modal-btn-primary"
            onClick={handleSave}
            disabled={isLoading}
          >
            {isLoading ? 'Saving...' : 'Save to Library'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * SaveModalManager
 * Manages the save modal lifecycle
 */
export class SaveModalManager {
  private container: HTMLDivElement | null = null;
  private root: any = null;

  /**
   * Show save modal for a post
   */
  show(post: Post, onSave?: (savedPost: SavedPost) => void): void {
    // Remove existing modal if any
    this.hide();

    // Create container
    this.container = document.createElement('div');
    this.container.id = 'fscrape-save-modal-root';
    document.body.appendChild(this.container);

    // Render modal
    this.root = createRoot(this.container);
    this.root.render(
      <SaveModal
        post={post}
        onClose={() => this.hide()}
        onSave={(savedPost) => {
          if (onSave) {
            onSave(savedPost);
          }
          this.hide();
        }}
      />
    );
  }

  /**
   * Hide the modal
   */
  hide(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
