/**
 * Save Button Component
 * Injected next to individual Reddit posts for manual saving
 */

import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageType } from '../shared/types';
import type { Post } from '../shared/types';

interface SaveButtonProps {
  post: Post;
  onSaveClick?: (post: Post, isSaved: boolean) => void;
}

function SaveButton({ post, onSaveClick }: SaveButtonProps) {
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    checkSavedStatus();
  }, [post.id]);

  const checkSavedStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_SAVED_POST,
        payload: { id: `saved_${post.platform_id}` },
      });

      if (response?.success && response.data) {
        setIsSaved(true);
      } else {
        setIsSaved(false);
      }
    } catch (error) {
      console.error('Error checking saved status:', error);
      setIsSaved(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isLoading) return;

    // If not saved, notify parent to show modal
    // If saved, just unsave directly
    if (!isSaved) {
      // Notify parent component to show modal
      if (onSaveClick) {
        onSaveClick(post, false);
      }
    } else {
      // Unsave directly
      setIsLoading(true);
      try {
        const response = await chrome.runtime.sendMessage({
          type: MessageType.DELETE_SAVED_POST,
          payload: { id: `saved_${post.platform_id}` },
        });

        if (response?.success) {
          setIsSaved(false);
          if (onSaveClick) {
            onSaveClick(post, true);
          }
        }
      } catch (error) {
        console.error('Error unsaving post:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (isLoading) {
    return (
      <button className="fscrape-save-button fscrape-save-button-loading" disabled>
        <span className="fscrape-spinner-sm"></span>
      </button>
    );
  }

  return (
    <button
      className={`fscrape-save-button ${isSaved ? 'fscrape-save-button-saved' : ''}`}
      onClick={handleClick}
      title={isSaved ? 'Remove from Library' : 'Save to Library'}
    >
      <span className="fscrape-save-icon">{isSaved ? '🔖' : '🏷️'}</span>
      <span className="fscrape-save-text">{isSaved ? 'Saved' : 'Save'}</span>
    </button>
  );
}

/**
 * SaveButton Injector Class
 * Manages injecting save buttons onto individual posts
 */
export class SaveButtonInjector {
  private injectedPosts: Set<string> = new Set();
  private observers: Map<string, any> = new Map();

  /**
   * Inject save button into a specific post element
   */
  inject(
    postElement: Element,
    post: Post,
    onSaveClick?: (post: Post, wasAlreadySaved: boolean) => void
  ): void {
    // Don't inject twice
    if (this.injectedPosts.has(post.id)) {
      return;
    }

    // Find where to inject the button based on Reddit UI version
    const targetLocation = this.findInjectionPoint(postElement);

    if (!targetLocation) {
      console.warn('Could not find injection point for post:', post.id);
      return;
    }

    // Create container
    const container = document.createElement('div');
    container.className = 'fscrape-save-container';
    container.dataset.postId = post.id;

    // Insert into DOM
    targetLocation.appendChild(container);

    // Render React component
    const root = createRoot(container);
    root.render(<SaveButton post={post} onSaveClick={onSaveClick} />);

    // Track injection
    this.injectedPosts.add(post.id);
    this.observers.set(post.id, root);

    console.log(`Injected save button for post: ${post.id}`);
  }

  /**
   * Find the best location to inject the save button
   */
  private findInjectionPoint(postElement: Element): Element | null {
    // Strategy: Find the post's action bar / footer area

    // Shreddit UI (sh.reddit.com)
    if (postElement.tagName.toLowerCase() === 'shreddit-post') {
      // Look for the footer with share/save buttons
      const footer = postElement.querySelector('footer, [slot="footer"]');
      if (footer) return footer;

      // Fallback: look for any action bar
      const actionBar = postElement.querySelector('[class*="action"]');
      if (actionBar) return actionBar;
    }

    // New Reddit (www.reddit.com)
    if (postElement.getAttribute('data-testid') === 'post-container') {
      // Look for the bottom action row (where share/save/etc buttons are)
      const actionRow = postElement.querySelector('[data-testid="post-footer"]');
      if (actionRow) return actionRow;

      // Alternative: look for any div containing buttons
      const buttonContainer = postElement.querySelector('div[class*="PostFooter"]');
      if (buttonContainer) return buttonContainer;
    }

    // Old Reddit (old.reddit.com)
    if (postElement.classList.contains('thing') && postElement.classList.contains('link')) {
      // Look for .flat-list.buttons (the comment/share/save row)
      const buttons = postElement.querySelector('.flat-list.buttons');
      if (buttons) return buttons;

      // Fallback: look for .entry
      const entry = postElement.querySelector('.entry');
      if (entry) return entry;
    }

    // Last resort: just use the post element itself
    return postElement;
  }

  /**
   * Remove save button from a specific post
   */
  remove(postId: string): void {
    const root = this.observers.get(postId);
    if (root) {
      root.unmount();
      this.observers.delete(postId);
    }

    const container = document.querySelector(`[data-post-id="${postId}"]`);
    if (container) {
      container.remove();
    }

    this.injectedPosts.delete(postId);
  }

  /**
   * Remove all injected save buttons
   */
  removeAll(): void {
    this.observers.forEach((root) => {
      root.unmount();
    });

    const containers = document.querySelectorAll('.fscrape-save-container');
    containers.forEach((container) => container.remove());

    this.observers.clear();
    this.injectedPosts.clear();
  }

  /**
   * Check if a post already has a save button
   */
  hasButton(postId: string): boolean {
    return this.injectedPosts.has(postId);
  }
}
