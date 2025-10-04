/**
 * UI Injector
 * Injects "Pin Subreddit" button into Reddit pages
 */

import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageType } from '../shared/types';

interface PinButtonProps {
  subreddit: string;
  onPinChange?: (isPinned: boolean) => void;
  postCount?: number;
}

function PinButton({ subreddit, onPinChange, postCount = 0 }: PinButtonProps) {
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    checkPinnedStatus();
  }, [subreddit]);

  const checkPinnedStatus = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.GET_PINNED_STATUS,
        payload: { subreddit },
      });

      if (response?.success) {
        setIsPinned(response.data.isPinned);
      }
    } catch (error) {
      console.error('Error checking pinned status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClick = async () => {
    setIsLoading(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.TOGGLE_PIN,
        payload: { subreddit },
      });

      if (response?.success) {
        const newPinnedState = !isPinned;
        setIsPinned(newPinnedState);

        // Notify parent component of pin state change
        if (onPinChange) {
          onPinChange(newPinnedState);
        }
      }
    } catch (error) {
      console.error('Error toggling pin:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fscrape-pin-button fscrape-pin-button-loading">
        <span className="fscrape-spinner"></span>
      </div>
    );
  }

  return (
    <div className="fscrape-button-group">
      <button
        className={`fscrape-pin-button ${isPinned ? 'fscrape-pin-button-pinned' : ''}`}
        onClick={handleClick}
        title={isPinned ? `Tracking r/${subreddit}` : `Pin r/${subreddit} to start tracking`}
      >
        <span className="fscrape-pin-icon">{isPinned ? '📌' : '📍'}</span>
        <span className="fscrape-pin-text">{isPinned ? 'Tracking' : 'Pin Subreddit'}</span>
      </button>
      {isPinned && postCount > 0 && (
        <div className="fscrape-counter" title={`${postCount} post${postCount === 1 ? '' : 's'} saved`}>
          <span className="fscrape-counter-value">{postCount}</span>
        </div>
      )}
    </div>
  );
}

export class UIInjector {
  private containerElement: HTMLDivElement | null = null;
  private root: any = null;
  private currentSubreddit: string | null = null;
  private onPinChange?: (isPinned: boolean) => void;
  private postCount: number = 0;

  /**
   * Inject the pin button into the page
   */
  inject(subreddit: string, onPinChange?: (isPinned: boolean) => void): void {
    this.currentSubreddit = subreddit;
    this.onPinChange = onPinChange;

    // Create container if it doesn't exist
    if (!this.containerElement) {
      this.containerElement = document.createElement('div');
      this.containerElement.id = 'fscrape-pin-container';
      document.body.appendChild(this.containerElement);
      this.root = createRoot(this.containerElement);
    }

    // Render component
    this.render();

    console.log(`Injected pin button for r/${subreddit}`);
  }

  /**
   * Update the post count and re-render
   */
  updatePostCount(count: number): void {
    this.postCount = count;
    this.render();
  }

  /**
   * Render the component with current state
   */
  private render(): void {
    if (this.root && this.currentSubreddit) {
      this.root.render(
        <PinButton
          subreddit={this.currentSubreddit}
          onPinChange={this.onPinChange}
          postCount={this.postCount}
        />
      );
    }
  }

  /**
   * Remove the pin button from the page
   */
  remove(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }

    if (this.containerElement) {
      this.containerElement.remove();
      this.containerElement = null;
    }

    this.currentSubreddit = null;
  }

  /**
   * Update button for new subreddit
   */
  update(subreddit: string, onPinChange?: (isPinned: boolean) => void): void {
    this.inject(subreddit, onPinChange);
  }
}
