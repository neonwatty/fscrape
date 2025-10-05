/**
 * Onboarding module for first-time users
 * Shows welcome modal and highlights pin button
 */

import { createRoot } from 'react-dom/client';

export class Onboarding {
  private static readonly STORAGE_KEYS = {
    HAS_SEEN_WELCOME: 'onboarding_has_seen_welcome',
    HAS_SEEN_PIN_PROMPT: 'onboarding_has_seen_pin_prompt',
  };

  /**
   * Show welcome modal on first install
   */
  static async showWelcomeIfNeeded(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.HAS_SEEN_WELCOME);

      if (result[this.STORAGE_KEYS.HAS_SEEN_WELCOME]) {
        return false; // Already seen
      }

      // Show welcome modal
      this.renderWelcomeModal();
      return true;
    } catch (error) {
      console.error('Error checking welcome status:', error);
      return false;
    }
  }

  /**
   * Show pin button highlight on first Reddit visit
   */
  static async showPinPromptIfNeeded(): Promise<boolean> {
    try {
      const result = await chrome.storage.local.get(this.STORAGE_KEYS.HAS_SEEN_PIN_PROMPT);

      if (result[this.STORAGE_KEYS.HAS_SEEN_PIN_PROMPT]) {
        return false; // Already seen
      }

      return true; // Should show prompt
    } catch (error) {
      console.error('Error checking pin prompt status:', error);
      return false;
    }
  }

  /**
   * Mark welcome as seen
   */
  static async markWelcomeSeen(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.HAS_SEEN_WELCOME]: true,
      });
    } catch (error) {
      console.error('Error saving welcome status:', error);
    }
  }

  /**
   * Mark pin prompt as seen
   */
  static async markPinPromptSeen(): Promise<void> {
    try {
      await chrome.storage.local.set({
        [this.STORAGE_KEYS.HAS_SEEN_PIN_PROMPT]: true,
      });
    } catch (error) {
      console.error('Error saving pin prompt status:', error);
    }
  }

  /**
   * Render welcome modal
   */
  private static renderWelcomeModal(): void {
    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.id = 'fscrape-welcome-modal';
    document.body.appendChild(modalContainer);

    // Render React component
    const root = createRoot(modalContainer);
    root.render(<WelcomeModal onClose={() => this.handleWelcomeClose(root, modalContainer)} />);
  }

  /**
   * Handle welcome modal close
   */
  private static handleWelcomeClose(root: any, container: HTMLElement): void {
    this.markWelcomeSeen();
    root.unmount();
    container.remove();
  }

  /**
   * Add pulse animation to pin button
   */
  static addPinButtonHighlight(buttonElement: HTMLElement): void {
    buttonElement.classList.add('fscrape-pulse');

    // Add tooltip
    const tooltip = document.createElement('div');
    tooltip.className = 'fscrape-onboarding-tooltip';
    tooltip.textContent = 'Click to start tracking this subreddit';
    buttonElement.appendChild(tooltip);

    // Remove highlight after first click
    const removeHighlight = () => {
      buttonElement.classList.remove('fscrape-pulse');
      tooltip.remove();
      buttonElement.removeEventListener('click', removeHighlight);
      this.markPinPromptSeen();
    };

    buttonElement.addEventListener('click', removeHighlight);

    // Auto-remove after 10 seconds
    setTimeout(removeHighlight, 10000);
  }
}

/**
 * Welcome Modal Component
 */
function WelcomeModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fscrape-modal-overlay">
      <div className="fscrape-modal">
        <div className="fscrape-modal-header">
          <h2 className="fscrape-modal-title">👋 Welcome to fscrape!</h2>
          <button onClick={onClose} className="fscrape-modal-close" aria-label="Close">
            ✕
          </button>
        </div>

        <div className="fscrape-modal-content">
          <p className="fscrape-modal-intro">
            Track Reddit posts effortlessly while you browse and analyze engagement patterns.
          </p>

          <div className="fscrape-modal-steps">
            <div className="fscrape-modal-step">
              <div className="fscrape-modal-step-number">1</div>
              <div className="fscrape-modal-step-content">
                <h3>Pin a Subreddit</h3>
                <p>Click the pin button on any subreddit page to start tracking</p>
              </div>
            </div>

            <div className="fscrape-modal-step">
              <div className="fscrape-modal-step-number">2</div>
              <div className="fscrape-modal-step-content">
                <h3>Browse Normally</h3>
                <p>Posts are automatically saved as you scroll through Reddit</p>
              </div>
            </div>

            <div className="fscrape-modal-step">
              <div className="fscrape-modal-step-number">3</div>
              <div className="fscrape-modal-step-content">
                <h3>Analyze Data</h3>
                <p>View heatmaps, trends, and optimal posting times in the dashboard</p>
              </div>
            </div>
          </div>

          <div className="fscrape-modal-features">
            <h4>Key Features:</h4>
            <ul>
              <li>📊 Engagement heatmaps by day/hour</li>
              <li>⏰ Discover optimal posting times</li>
              <li>📥 Export data as JSON or CSV</li>
              <li>🔒 All data stored locally in your browser</li>
            </ul>
          </div>
        </div>

        <div className="fscrape-modal-footer">
          <button onClick={onClose} className="fscrape-modal-btn-primary">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
