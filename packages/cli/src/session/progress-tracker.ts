/**
 * Progress tracking for scraping sessions
 */

import { EventEmitter } from 'events';
import ora, { type Ora } from 'ora';

export interface ProgressUpdate {
  sessionId: string;
  timestamp: Date;
  type: 'item' | 'page' | 'batch' | 'milestone';
  current: number;
  total?: number;
  percentage?: number;
  itemsPerSecond?: number;
  estimatedTimeRemaining?: number;
  message?: string;
  details?: any;
}

export interface ProgressMilestone {
  threshold: number; // Percentage (0-100)
  reached: boolean;
  reachedAt?: Date;
  message?: string;
}

export class ProgressTracker extends EventEmitter {
  private sessions: Map<
    string,
    {
      startTime: Date;
      lastUpdate: Date;
      itemsProcessed: number;
      totalItems?: number;
      milestones: ProgressMilestone[];
      history: ProgressUpdate[];
      spinner?: Ora;
      etaWindow: number[]; // Moving window for ETA calculation
    }
  > = new Map();

  private updateInterval: NodeJS.Timeout | null = null;
  private readonly maxHistorySize = 100;
  private readonly etaWindowSize = 10; // Use last 10 updates for ETA

  constructor(
    private readonly options: {
      updateIntervalMs?: number;
      milestones?: number[]; // Percentage thresholds
      enableHistory?: boolean;
      useSpinner?: boolean; // Enable ora spinner display
      spinnerText?: string; // Default spinner text
    } = {}
  ) {
    super();

    // Start periodic update emitter if interval specified
    if (options.updateIntervalMs) {
      this.startPeriodicUpdates(options.updateIntervalMs);
    }
  }

  /**
   * Start tracking a session
   */
  startTracking(sessionId: string, totalItems?: number): void {
    const milestones = (this.options.milestones || [25, 50, 75, 90, 100]).map((threshold) => ({
      threshold,
      reached: false,
    }));

    // Create spinner if enabled
    let spinner: Ora | undefined;
    if (this.options.useSpinner) {
      spinner = ora({
        text: this.options.spinnerText || `Processing session ${sessionId}...`,
        spinner: 'dots',
      }).start();
    }

    this.sessions.set(sessionId, {
      startTime: new Date(),
      lastUpdate: new Date(),
      itemsProcessed: 0,
      totalItems,
      milestones,
      history: [],
      spinner,
      etaWindow: [],
    });

    this.emit('tracking:started', { sessionId, totalItems });
  }

  /**
   * Update progress for a session
   */
  updateProgress(sessionId: string, itemsProcessed: number, totalItems?: number): ProgressUpdate {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not being tracked`);
    }

    const now = new Date();
    const elapsedMs = now.getTime() - session.startTime.getTime();

    // Calculate instant rate
    const timeSinceLastUpdate = now.getTime() - session.lastUpdate.getTime();
    const itemsSinceLastUpdate = itemsProcessed - session.itemsProcessed;
    const instantRate =
      timeSinceLastUpdate > 0 ? (itemsSinceLastUpdate / timeSinceLastUpdate) * 1000 : 0;

    // Update ETA window with instant rate
    if (instantRate > 0) {
      session.etaWindow.push(instantRate);
      if (session.etaWindow.length > this.etaWindowSize) {
        session.etaWindow.shift();
      }
    }

    // Calculate smoothed items per second using moving average
    let itemsPerSecond: number;
    if (session.etaWindow.length > 0) {
      const avgRate = session.etaWindow.reduce((a, b) => a + b, 0) / session.etaWindow.length;
      itemsPerSecond = avgRate;
    } else {
      // Fallback to overall average
      itemsPerSecond = elapsedMs > 0 ? (itemsProcessed / elapsedMs) * 1000 : 0;
    }

    // Update session data
    session.itemsProcessed = itemsProcessed;
    if (totalItems !== undefined) {
      session.totalItems = totalItems;
    }
    session.lastUpdate = now;

    // Calculate percentage and estimated time
    let percentage: number | undefined;
    let estimatedTimeRemaining: number | undefined;

    if (session.totalItems) {
      percentage = (itemsProcessed / session.totalItems) * 100;

      if (itemsPerSecond > 0) {
        const remainingItems = session.totalItems - itemsProcessed;
        estimatedTimeRemaining = remainingItems / itemsPerSecond;
      }

      // Check milestones
      this.checkMilestones(sessionId, percentage);
    }

    // Update spinner if present
    if (session.spinner) {
      const progressText = this.formatProgress(sessionId);
      session.spinner.text = progressText;
    }

    // Create progress update
    const update: ProgressUpdate = {
      sessionId,
      timestamp: now,
      type: 'item',
      current: itemsProcessed,
      total: session.totalItems,
      percentage,
      itemsPerSecond,
      estimatedTimeRemaining,
    };

    // Add to history if enabled
    if (this.options.enableHistory) {
      session.history.push(update);

      // Trim history if too large
      if (session.history.length > this.maxHistorySize) {
        session.history = session.history.slice(-this.maxHistorySize);
      }
    }

    // Emit progress event
    this.emit('progress:update', update);

    return update;
  }

  /**
   * Update with a custom message
   */
  updateMessage(sessionId: string, message: string, details?: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    const update: ProgressUpdate = {
      sessionId,
      timestamp: new Date(),
      type: 'item',
      current: session.itemsProcessed,
      total: session.totalItems,
      message,
      details,
    };

    this.emit('progress:message', update);

    if (this.options.enableHistory) {
      session.history.push(update);
    }
  }

  /**
   * Mark a batch as completed
   */
  completeBatch(sessionId: string, batchSize: number, batchDetails?: any): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.itemsProcessed += batchSize;
    session.lastUpdate = new Date();

    const update: ProgressUpdate = {
      sessionId,
      timestamp: session.lastUpdate,
      type: 'batch',
      current: session.itemsProcessed,
      total: session.totalItems,
      details: batchDetails,
    };

    this.emit('progress:batch', update);

    if (this.options.enableHistory) {
      session.history.push(update);
    }
  }

  /**
   * Stop tracking a session
   */
  stopTracking(sessionId: string, success: boolean = true): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Stop spinner if present
    if (session.spinner) {
      if (success) {
        if (session.itemsProcessed === session.totalItems) {
          session.spinner.succeed(`Completed: ${session.itemsProcessed} items processed`);
        } else {
          session.spinner.warn(
            `Stopped: ${session.itemsProcessed}/${session.totalItems || '?'} items processed`
          );
        }
      } else {
        session.spinner.fail(`Failed: ${session.itemsProcessed} items processed`);
      }
    }

    const finalUpdate: ProgressUpdate = {
      sessionId,
      timestamp: new Date(),
      type: 'item',
      current: session.itemsProcessed,
      total: session.totalItems,
      percentage: session.totalItems
        ? (session.itemsProcessed / session.totalItems) * 100
        : undefined,
    };

    this.emit('tracking:stopped', finalUpdate);
    this.sessions.delete(sessionId);
  }

  /**
   * Get current progress for a session
   */
  getProgress(sessionId: string): ProgressUpdate | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const now = new Date();
    const elapsedMs = now.getTime() - session.startTime.getTime();
    const itemsPerSecond = elapsedMs > 0 ? (session.itemsProcessed / elapsedMs) * 1000 : 0;

    let percentage: number | undefined;
    let estimatedTimeRemaining: number | undefined;

    if (session.totalItems) {
      percentage = (session.itemsProcessed / session.totalItems) * 100;

      if (itemsPerSecond > 0) {
        const remainingItems = session.totalItems - session.itemsProcessed;
        estimatedTimeRemaining = remainingItems / itemsPerSecond;
      }
    }

    return {
      sessionId,
      timestamp: now,
      type: 'item',
      current: session.itemsProcessed,
      total: session.totalItems,
      percentage,
      itemsPerSecond,
      estimatedTimeRemaining,
    };
  }

  /**
   * Get progress history for a session
   */
  getHistory(sessionId: string): ProgressUpdate[] {
    const session = this.sessions.get(sessionId);
    return session?.history || [];
  }

  /**
   * Get all active sessions progress
   */
  getAllProgress(): Map<string, ProgressUpdate | null> {
    const allProgress = new Map<string, ProgressUpdate | null>();

    for (const sessionId of this.sessions.keys()) {
      allProgress.set(sessionId, this.getProgress(sessionId));
    }

    return allProgress;
  }

  /**
   * Check and emit milestone events
   */
  private checkMilestones(sessionId: string, percentage: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    for (const milestone of session.milestones) {
      if (!milestone.reached && percentage >= milestone.threshold) {
        milestone.reached = true;
        milestone.reachedAt = new Date();

        this.emit('progress:milestone', {
          sessionId,
          milestone: milestone.threshold,
          timestamp: milestone.reachedAt,
          current: session.itemsProcessed,
          total: session.totalItems,
        });
      }
    }
  }

  /**
   * Start periodic progress updates
   */
  private startPeriodicUpdates(intervalMs: number): void {
    this.updateInterval = setInterval(() => {
      for (const [sessionId] of this.sessions) {
        const progress = this.getProgress(sessionId);
        if (progress) {
          this.emit('progress:periodic', progress);
        }
      }
    }, intervalMs);
  }

  /**
   * Stop periodic updates
   */
  stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Get estimated completion time
   */
  getEstimatedCompletion(sessionId: string): Date | null {
    const progress = this.getProgress(sessionId);
    if (!progress || !progress.estimatedTimeRemaining) return null;

    const completionTime = new Date();
    completionTime.setSeconds(completionTime.getSeconds() + progress.estimatedTimeRemaining);

    return completionTime;
  }

  /**
   * Format progress for display
   */
  formatProgress(sessionId: string): string {
    const progress = this.getProgress(sessionId);
    if (!progress) return 'No progress data';

    const parts = [`${progress.current} items processed`];

    if (progress.total) {
      parts.push(`of ${progress.total}`);
    }

    if (progress.percentage !== undefined) {
      parts.push(`(${progress.percentage.toFixed(1)}%)`);
    }

    if (progress.itemsPerSecond) {
      parts.push(`- ${progress.itemsPerSecond.toFixed(1)} items/sec`);
    }

    if (progress.estimatedTimeRemaining) {
      const formatted = this.formatTime(progress.estimatedTimeRemaining);
      parts.push(`- ${formatted} remaining`);
    }

    return parts.join(' ');
  }

  /**
   * Format time in seconds to human-readable format
   */
  formatTime(seconds: number): string {
    if (seconds < 60) {
      return `${Math.ceil(seconds)}s`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const secs = Math.ceil(seconds % 60);
      return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
  }

  /**
   * Get a progress bar string
   */
  getProgressBar(sessionId: string, width: number = 20): string {
    const session = this.sessions.get(sessionId);
    if (!session || !session.totalItems) return '';

    const percentage = (session.itemsProcessed / session.totalItems) * 100;
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;

    return `[${'█'.repeat(filled)}${' '.repeat(empty)}]`;
  }

  /**
   * Update spinner with custom text
   */
  updateSpinnerText(sessionId: string, text: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.spinner) {
      session.spinner.text = text;
    }
  }

  /**
   * Pause spinner
   */
  pauseSpinner(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.spinner) {
      session.spinner.stop();
    }
  }

  /**
   * Resume spinner
   */
  resumeSpinner(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session?.spinner) {
      session.spinner.start();
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.stopPeriodicUpdates();
    this.removeAllListeners();
    this.sessions.clear();
  }
}
