/**
 * Session manager for coordinating scraping operations
 */

import { EventEmitter } from "events";
import { v4 as uuidv4 } from "uuid";
import type { DatabaseManager } from "../database/database.js";
import type { Platform } from "../types/core.js";
import {
  SessionStateManager,
  type SessionState,
  type SessionStatus,
} from "./session-state.js";
import { ProgressTracker } from "./progress-tracker.js";
import type { Logger } from "winston";
import winston from "winston";

export interface SessionConfig {
  platform: Platform;
  queryType?: string;
  queryValue?: string;
  maxItems?: number;
  includeComments?: boolean;
  includeUsers?: boolean;
  resumeFromSession?: string;
}

export interface SessionEvents {
  "session:created": (session: SessionState) => void;
  "session:started": (session: SessionState) => void;
  "session:paused": (session: SessionState) => void;
  "session:resumed": (session: SessionState) => void;
  "session:completed": (session: SessionState) => void;
  "session:failed": (session: SessionState, error: Error) => void;
  "session:cancelled": (session: SessionState) => void;
  "session:progress": (sessionId: string, progress: any) => void;
}

export class SessionManager extends EventEmitter {
  private stateManager: SessionStateManager;
  private progressTracker: ProgressTracker;
  private database?: DatabaseManager;
  private logger: Logger;
  private activeOperations: Map<string, AbortController> = new Map();
  private autoPersistInterval?: NodeJS.Timeout;

  constructor(
    database?: DatabaseManager,
    logger?: Logger,
    options: {
      autoPersistMs?: number;
      progressUpdateMs?: number;
      milestones?: number[];
    } = {},
  ) {
    super();

    this.database = database;
    this.logger =
      logger ||
      winston.createLogger({
        level: "info",
        format: winston.format.simple(),
        transports: [new winston.transports.Console()],
      });

    // Initialize components
    this.stateManager = new SessionStateManager();
    this.progressTracker = new ProgressTracker({
      updateIntervalMs: options.progressUpdateMs,
      milestones: options.milestones,
      enableHistory: true,
    });

    // Set up progress tracking events
    this.setupProgressEvents();

    // Start auto-persist if configured
    if (options.autoPersistMs && this.database) {
      this.startAutoPersist(options.autoPersistMs);
    }

    // Load existing sessions from database
    if (this.database) {
      this.loadExistingSessions();
    }
  }

  /**
   * Create a new scraping session
   */
  async createSession(config: SessionConfig): Promise<SessionState> {
    const sessionId = config.resumeFromSession || uuidv4();

    // Check if resuming
    if (config.resumeFromSession) {
      const existingSession = this.stateManager.getSession(sessionId);
      if (existingSession && this.stateManager.canResume(sessionId)) {
        this.logger.info(`Resuming session ${sessionId}`);
        return this.resumeSession(sessionId);
      }
    }

    // Create new session
    const session = this.stateManager.createSession(
      sessionId,
      config.platform,
      {
        queryType: config.queryType,
        queryValue: config.queryValue,
        maxItems: config.maxItems,
        includeComments: config.includeComments,
        includeUsers: config.includeUsers,
      },
    );

    // Start progress tracking
    this.progressTracker.startTracking(sessionId, config.maxItems);

    // Persist to database if available
    if (this.database) {
      await this.persistSession(session);
    }

    this.logger.info(`Created session ${sessionId} for ${config.platform}`);
    this.emit("session:created", session);

    return session;
  }

  /**
   * Start a session
   */
  async startSession(sessionId: string): Promise<void> {
    const session = this.stateManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status === "running") {
      throw new Error(`Session ${sessionId} is already running`);
    }

    // Create abort controller for this session
    const abortController = new AbortController();
    this.activeOperations.set(sessionId, abortController);

    // Update status
    this.stateManager.updateStatus(sessionId, "running");

    // Get updated session
    const updatedSession = this.stateManager.getSession(sessionId)!;

    // Persist state
    if (this.database) {
      await this.persistSession(updatedSession);
    }

    this.logger.info(`Started session ${sessionId}`);
    this.emit("session:started", updatedSession);
  }

  /**
   * Pause a running session
   */
  async pauseSession(sessionId: string): Promise<void> {
    const session = this.stateManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.status !== "running") {
      throw new Error(`Session ${sessionId} is not running`);
    }

    // Abort any active operations
    const controller = this.activeOperations.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeOperations.delete(sessionId);
    }

    // Save current progress before pausing
    const progress = this.progressTracker.getProgress(sessionId);
    if (progress) {
      this.stateManager.updateProgress(sessionId, {
        processedItems: progress.current,
        totalItems: progress.total,
      });
    }

    // Update status using the new pauseSession method
    this.stateManager.pauseSession(sessionId);

    // Stop progress tracking
    this.progressTracker.stopTracking(sessionId);

    // Get updated session
    const updatedSession = this.stateManager.getSession(sessionId)!;

    // Persist state
    if (this.database) {
      await this.persistSession(updatedSession);
    }

    this.logger.info(`Paused session ${sessionId}`);
    this.emit("session:paused", updatedSession);
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<SessionState> {
    const session = this.stateManager.getSession(sessionId);
    if (!session) {
      // Try to load from database
      if (this.database) {
        const dbSession = this.database.getSession(parseInt(sessionId, 10));
        if (dbSession) {
          return this.stateManager.fromDatabaseFormat(dbSession);
        }
      }
      throw new Error(`Session not found`);
    }

    if (!this.stateManager.canResume(sessionId)) {
      throw new Error(`Cannot resume session`);
    }

    // Create new abort controller
    const abortController = new AbortController();
    this.activeOperations.set(sessionId, abortController);

    // Update status using setStatus method
    this.stateManager.setStatus(sessionId, "running");

    // Resume progress tracking
    this.progressTracker.startTracking(sessionId, session.config?.maxItems);

    // Get updated session
    const updatedSession = this.stateManager.getSession(sessionId)!;

    // Persist state
    if (this.database) {
      await this.persistSession(updatedSession);
    }

    this.logger.info(`Resumed session ${sessionId}`);
    this.emit("session:resumed", updatedSession);

    return updatedSession;
  }

  /**
   * Complete a session
   */
  async completeSession(sessionId: string): Promise<void> {
    const session = this.stateManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Clean up abort controller
    const controller = this.activeOperations.get(sessionId);
    if (controller) {
      this.activeOperations.delete(sessionId);
    }

    // Update status using the new completeSession method
    this.stateManager.completeSession(sessionId);

    // Stop progress tracking
    this.progressTracker.stopTracking(sessionId);

    // Persist final state
    if (this.database) {
      await this.persistSession(session);
    }

    this.logger.info(`Completed session ${sessionId}`);
    this.emit("session:completed", this.stateManager.getSession(sessionId));
  }

  /**
   * Fail a session with error
   */
  async failSession(sessionId: string, error: Error): Promise<void> {
    const session = this.stateManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Clean up abort controller
    const controller = this.activeOperations.get(sessionId);
    if (controller) {
      this.activeOperations.delete(sessionId);
    }

    // Use the new failSession method
    this.stateManager.failSession(sessionId, error);

    // Stop progress tracking
    this.progressTracker.stopTracking(sessionId);

    // Persist state
    if (this.database) {
      await this.persistSession(session);
    }

    this.logger.error(`Session ${sessionId} failed:`, error);
    this.emit("session:failed", this.stateManager.getSession(sessionId), error);
  }

  /**
   * Cancel a session
   */
  async cancelSession(sessionId: string): Promise<void> {
    const session = this.stateManager.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Abort any active operations
    const controller = this.activeOperations.get(sessionId);
    if (controller) {
      controller.abort();
      this.activeOperations.delete(sessionId);
    }

    // Update status
    this.stateManager.updateStatus(sessionId, "cancelled");

    // Stop progress tracking
    this.progressTracker.stopTracking(sessionId);

    // Persist state
    if (this.database) {
      await this.persistSession(session);
    }

    this.logger.info(`Cancelled session ${sessionId}`);
    this.emit("session:cancelled", session);
  }

  /**
   * Update session progress
   */
  updateProgress(
    sessionId: string,
    processedItems: number,
    totalItems?: number,
  ): void {
    this.stateManager.updateProgress(sessionId, {
      processedItems,
      totalItems:
        totalItems ||
        this.stateManager.getSession(sessionId)?.progress.totalItems ||
        0,
    });

    const progress = this.progressTracker.updateProgress(
      sessionId,
      processedItems,
      totalItems,
    );

    this.emit("session:progress", sessionId, progress);
  }

  /**
   * Update session metrics
   */
  updateMetrics(
    sessionId: string,
    metrics: Partial<SessionState["metrics"]>,
  ): void {
    this.stateManager.updateMetrics(sessionId, metrics);
  }

  /**
   * Update resume data for session
   */
  updateResumeData(
    sessionId: string,
    resumeData: SessionState["resumeData"],
  ): void {
    this.stateManager.updateResumeData(sessionId, resumeData);
  }

  /**
   * Get session state
   */
  getSession(sessionId: string): SessionState | undefined {
    return this.stateManager.getSession(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionState[] {
    return this.stateManager.getActiveSessions();
  }

  /**
   * Get sessions by status
   */
  getSessionsByStatus(status: SessionStatus): SessionState[] {
    return this.stateManager.getSessionsByStatus(status);
  }

  /**
   * Get abort signal for a session
   */
  getAbortSignal(sessionId: string): AbortSignal | undefined {
    return this.activeOperations.get(sessionId)?.signal;
  }

  /**
   * Get progress for a session
   */
  getProgress(sessionId: string): string {
    return this.progressTracker.formatProgress(sessionId);
  }

  /**
   * Get estimated completion time
   */
  getEstimatedCompletion(sessionId: string): Date | null {
    return this.progressTracker.getEstimatedCompletion(sessionId);
  }

  /**
   * Set up progress tracking events
   */
  private setupProgressEvents(): void {
    this.progressTracker.on("progress:update", (update) => {
      this.emit("session:progress", update.sessionId, update);
    });

    this.progressTracker.on("progress:milestone", (milestone) => {
      this.logger.info(
        `Session ${milestone.sessionId} reached ${milestone.milestone}% milestone`,
      );
    });
  }

  /**
   * Load existing sessions from database
   */
  private async loadExistingSessions(): Promise<void> {
    if (!this.database) return;

    try {
      const activeSessions = this.database.getActiveSessions(100);

      for (const dbSession of activeSessions) {
        if (dbSession.status === "running" || dbSession.status === "pending") {
          // Convert active sessions to paused state for recovery
          const session = this.stateManager.fromDatabaseFormat({
            ...dbSession,
            status: "paused",
          });

          this.logger.info(
            `Loaded session ${session.id} from database (was ${dbSession.status}, now paused)`,
          );
        }
      }
    } catch (error) {
      this.logger.error("Failed to load existing sessions:", error);
    }
  }

  /**
   * Persist session to database
   */
  private async persistSession(session: SessionState): Promise<void> {
    if (!this.database) return;

    try {
      const dbFormat = this.stateManager.toDatabaseFormat(session);

      // Update session in database
      this.database.updateSession(parseInt(session.id, 10), {
        status: dbFormat.status!,
        totalItemsScraped: dbFormat.totalItemsScraped!,
        lastItemId: dbFormat.lastItemId,
        resumeToken: dbFormat.resumeToken,
      });
    } catch (error) {
      this.logger.error(`Failed to persist session ${session.id}:`, error);
    }
  }

  /**
   * Start auto-persist timer
   */
  private startAutoPersist(intervalMs: number): void {
    this.autoPersistInterval = setInterval(() => {
      this.persistAllSessions();
    }, intervalMs);
  }

  /**
   * Persist all active sessions
   */
  private async persistAllSessions(): Promise<void> {
    const activeSessions = this.stateManager.getActiveSessions();

    for (const session of activeSessions) {
      await this.persistSession(session);
    }
  }

  /**
   * Clean up old completed sessions
   */
  cleanupOldSessions(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    return this.stateManager.clearOldSessions(olderThanMs);
  }

  /**
   * Export session data for backup
   */
  exportSessions(): SessionState[] {
    return this.stateManager.exportSessions();
  }

  /**
   * Get all sessions
   */
  getAllSessions(): SessionState[] {
    return this.stateManager.exportSessions();
  }

  /**
   * Get session metrics
   */
  getSessionMetrics(sessionId: string): {
    session: SessionState | undefined;
    progress: any;
  } {
    const session = this.stateManager.getSession(sessionId);
    const progress = this.progressTracker.getProgress(sessionId);
    return { session, progress };
  }

  /**
   * Import session data from backup
   */
  importSessions(sessions: SessionState[]): void {
    this.stateManager.importSessions(sessions);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Cancel all active operations
    for (const [sessionId, controller] of this.activeOperations) {
      controller.abort();
      this.logger.info(`Aborted active operation for session ${sessionId}`);
    }
    this.activeOperations.clear();

    // Stop auto-persist
    if (this.autoPersistInterval) {
      clearInterval(this.autoPersistInterval);
    }

    // Clean up progress tracker
    this.progressTracker.destroy();

    // Remove all listeners
    this.removeAllListeners();
  }
}
