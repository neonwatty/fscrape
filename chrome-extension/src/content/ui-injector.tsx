/**
 * UI Injector
 * Injects "Pin Subreddit" button into Reddit pages
 */

import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MessageType } from '../shared/types';

interface PinButtonProps {
  subreddit: string;
}

function PinButton({ subreddit }: PinButtonProps) {
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
        setIsPinned(!isPinned);
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
    <button
      className={`fscrape-pin-button ${isPinned ? 'fscrape-pin-button-pinned' : ''}`}
      onClick={handleClick}
      title={isPinned ? `Tracking r/${subreddit}` : `Pin r/${subreddit} to start tracking`}
    >
      <span className="fscrape-pin-icon">{isPinned ? '📌' : '📍'}</span>
      <span className="fscrape-pin-text">{isPinned ? 'Tracking' : 'Pin Subreddit'}</span>
    </button>
  );
}

export class UIInjector {
  private containerElement: HTMLDivElement | null = null;
  private root: any = null;
  private currentSubreddit: string | null = null;

  /**
   * Inject the pin button into the page
   */
  inject(subreddit: string): void {
    // Don't re-inject if same subreddit
    if (this.currentSubreddit === subreddit && this.containerElement) {
      return;
    }

    // Remove existing button if present
    this.remove();

    this.currentSubreddit = subreddit;

    // Create container
    this.containerElement = document.createElement('div');
    this.containerElement.id = 'fscrape-pin-container';
    document.body.appendChild(this.containerElement);

    // Render React component
    this.root = createRoot(this.containerElement);
    this.root.render(<PinButton subreddit={subreddit} />);

    console.log(`Injected pin button for r/${subreddit}`);
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
  update(subreddit: string): void {
    this.inject(subreddit);
  }
}
