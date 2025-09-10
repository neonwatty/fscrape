/**
 * Session state management for scraping operations
 */

import type { Platform } from "../types/core.js";
import type { SessionInfo } from "../database/database.js";

export type SessionStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface SessionState {
  id: string;
  platform: Platform;
  status: SessionStatus;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  
  // Progress tracking
  progress: {
    totalItems: number;
    processedItems: number;
    failedItems: number;
    currentPage?: number;
    totalPages?: number;
    lastItemId?: string;
  };
  
  // Resume information
  resumeData?: {
    token?: string;
    checkpoint?: any;
    lastSuccessfulItem?: string;
    nextUrl?: string;
  };
  
  // Error tracking
  errors: Array<{
    timestamp: Date;
    message: string;
    itemId?: string;
    stack?: string;
  }>;
  
  // Performance metrics
  metrics: {
    averageItemTime: number;
    totalTime: number;
    requestCount: number;
    rateLimitHits: number;
  };
  
  // Configuration snapshot
  config?: {
    queryType?: string;
    queryValue?: string;
    maxItems?: number;
    includeComments?: boolean;
    includeUsers?: boolean;
  };
}

export class SessionStateManager {
  private states: Map<string, SessionState> = new Map();
  
  /**
   * Create a new session state
   */
  createSession(
    id: string,
    platform: Platform,
    config?: SessionState["config"]
  ): SessionState {
    const state: SessionState = {
      id,
      platform,
      status: "pending",
      startedAt: new Date(),
      updatedAt: new Date(),
      progress: {
        totalItems: 0,
        processedItems: 0,
        failedItems: 0,
      },
      errors: [],
      metrics: {
        averageItemTime: 0,
        totalTime: 0,
        requestCount: 0,
        rateLimitHits: 0,
      },
      config,
    };
    
    this.states.set(id, state);
    return state;
  }
  
  /**
   * Get session state by ID
   */
  getSession(id: string): SessionState | undefined {
    return this.states.get(id);
  }
  
  /**
   * Update session status
   */
  updateStatus(id: string, status: SessionStatus): void {
    const state = this.states.get(id);
    if (state) {
      state.status = status;
      state.updatedAt = new Date();
      
      if (status === "completed" || status === "failed" || status === "cancelled") {
        state.completedAt = new Date();
      }
    }
  }
  
  /**
   * Update session progress
   */
  updateProgress(
    id: string,
    update: Partial<SessionState["progress"]>
  ): void {
    const state = this.states.get(id);
    if (state) {
      state.progress = { ...state.progress, ...update };
      state.updatedAt = new Date();
      
      // Update average item time
      if (state.progress.processedItems > 0) {
        state.metrics.averageItemTime = 
          state.metrics.totalTime / state.progress.processedItems;
      }
    }
  }
  
  /**
   * Add error to session
   */
  addError(
    id: string,
    error: Error | string,
    itemId?: string
  ): void {
    const state = this.states.get(id);
    if (state) {
      const errorEntry = {
        timestamp: new Date(),
        message: typeof error === "string" ? error : error.message,
        itemId,
        stack: typeof error === "object" ? error.stack : undefined,
      };
      
      state.errors.push(errorEntry);
      state.progress.failedItems++;
      state.updatedAt = new Date();
    }
  }
  
  /**
   * Update resume data for session
   */
  updateResumeData(
    id: string,
    resumeData: SessionState["resumeData"]
  ): void {
    const state = this.states.get(id);
    if (state) {
      state.resumeData = { ...state.resumeData, ...resumeData };
      state.updatedAt = new Date();
    }
  }
  
  /**
   * Update metrics
   */
  updateMetrics(
    id: string,
    metrics: Partial<SessionState["metrics"]>
  ): void {
    const state = this.states.get(id);
    if (state) {
      state.metrics = { ...state.metrics, ...metrics };
      state.updatedAt = new Date();
    }
  }
  
  /**
   * Check if session can be resumed
   */
  canResume(id: string): boolean {
    const state = this.states.get(id);
    if (!state) return false;
    
    return (
      state.status === "paused" ||
      (state.status === "failed" && state.resumeData?.token !== undefined)
    );
  }
  
  /**
   * Get all active sessions
   */
  getActiveSessions(): SessionState[] {
    return Array.from(this.states.values()).filter(
      s => s.status === "running" || s.status === "paused"
    );
  }
  
  /**
   * Get sessions by status
   */
  getSessionsByStatus(status: SessionStatus): SessionState[] {
    return Array.from(this.states.values()).filter(s => s.status === status);
  }
  
  /**
   * Clear completed sessions older than specified time
   */
  clearOldSessions(olderThanMs: number): number {
    const cutoff = Date.now() - olderThanMs;
    let cleared = 0;
    
    for (const [id, state] of this.states) {
      if (
        state.completedAt &&
        state.completedAt.getTime() < cutoff &&
        (state.status === "completed" || state.status === "cancelled")
      ) {
        this.states.delete(id);
        cleared++;
      }
    }
    
    return cleared;
  }
  
  /**
   * Convert to database SessionInfo format
   */
  toDatabaseFormat(state: SessionState): Partial<SessionInfo> {
    return {
      sessionId: state.id,
      platform: state.platform,
      queryType: state.config?.queryType,
      queryValue: state.config?.queryValue,
      status: state.status as SessionInfo["status"],
      totalItemsTarget: state.config?.maxItems,
      totalItemsScraped: state.progress.processedItems,
      totalPosts: state.progress.totalItems,
      lastItemId: state.progress.lastItemId,
      resumeToken: state.resumeData?.token,
    };
  }
  
  /**
   * Create from database SessionInfo format
   */
  fromDatabaseFormat(info: SessionInfo): SessionState {
    const state: SessionState = {
      id: info.sessionId,
      platform: info.platform,
      status: info.status as SessionStatus,
      startedAt: info.startedAt || new Date(),
      updatedAt: info.updatedAt || new Date(),
      completedAt: info.completedAt,
      progress: {
        totalItems: info.totalPosts || 0,
        processedItems: info.totalItemsScraped,
        failedItems: 0,
        lastItemId: info.lastItemId,
      },
      errors: [],
      metrics: {
        averageItemTime: 0,
        totalTime: info.elapsedTime || 0,
        requestCount: 0,
        rateLimitHits: 0,
      },
      config: {
        queryType: info.queryType,
        queryValue: info.queryValue,
        maxItems: info.totalItemsTarget,
      },
      resumeData: info.resumeToken ? {
        token: info.resumeToken,
      } : undefined,
    };
    
    this.states.set(state.id, state);
    return state;
  }
  
  /**
   * Export all sessions for persistence
   */
  exportSessions(): SessionState[] {
    return Array.from(this.states.values());
  }
  
  /**
   * Import sessions from persistence
   */
  importSessions(sessions: SessionState[]): void {
    for (const session of sessions) {
      this.states.set(session.id, session);
    }
  }
}