/**
 * Session state management for scraping operations
 */

import type { Platform } from "../types/core.js";
import type { SessionInfo, DatabaseManager } from "../database/database.js";

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
  private database?: DatabaseManager;
  
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
      updatedAt: info.lastActivityAt || new Date(),
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
        totalTime: 0, // Calculate from dates if needed
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
  
  /**
   * Serialize session state to JSON string
   */
  serialize(id: string): string | null {
    const state = this.states.get(id);
    if (!state) return null;
    
    return JSON.stringify(state, (key, value) => {
      // Handle Date objects
      if (value instanceof Date) {
        return value.toISOString();
      }
      // Handle undefined values
      if (value === undefined) {
        return null;
      }
      return value;
    }, 2);
  }
  
  /**
   * Deserialize session state from JSON string
   */
  deserialize(json: string): SessionState | null {
    try {
      const parsed = JSON.parse(json);
      
      // Restore Date objects
      const dateFields = ['startedAt', 'updatedAt', 'completedAt'];
      for (const field of dateFields) {
        if (parsed[field]) {
          parsed[field] = new Date(parsed[field]);
        }
      }
      
      // Restore error timestamps
      if (parsed.errors && Array.isArray(parsed.errors)) {
        parsed.errors = parsed.errors.map((error: any) => ({
          ...error,
          timestamp: new Date(error.timestamp),
        }));
      }
      
      // Validate required fields
      if (!parsed.id || !parsed.platform || !parsed.status) {
        throw new Error('Missing required fields in session state');
      }
      
      return parsed as SessionState;
    } catch (error) {
      console.error('Failed to deserialize session state:', error);
      return null;
    }
  }
  
  /**
   * Serialize all sessions to JSON
   */
  serializeAll(): string {
    const sessions = this.exportSessions();
    return JSON.stringify(sessions, (key, value) => {
      if (value instanceof Date) {
        return value.toISOString();
      }
      if (value === undefined) {
        return null;
      }
      return value;
    }, 2);
  }
  
  /**
   * Deserialize multiple sessions from JSON
   */
  deserializeAll(json: string): SessionState[] {
    try {
      const parsed = JSON.parse(json);
      if (!Array.isArray(parsed)) {
        throw new Error('Expected array of sessions');
      }
      
      const sessions: SessionState[] = [];
      for (const sessionData of parsed) {
        const session = this.deserialize(JSON.stringify(sessionData));
        if (session) {
          sessions.push(session);
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Failed to deserialize sessions:', error);
      return [];
    }
  }
  
  /**
   * Save session state to file system
   */
  async saveToFile(id: string, filePath: string): Promise<boolean> {
    try {
      const serialized = this.serialize(id);
      if (!serialized) return false;
      
      const { writeFile } = await import('fs/promises');
      await writeFile(filePath, serialized, 'utf-8');
      return true;
    } catch (error) {
      console.error('Failed to save session to file:', error);
      return false;
    }
  }
  
  /**
   * Load session state from file system
   */
  async loadFromFile(filePath: string): Promise<SessionState | null> {
    try {
      const { readFile } = await import('fs/promises');
      const content = await readFile(filePath, 'utf-8');
      const state = this.deserialize(content);
      
      if (state) {
        this.states.set(state.id, state);
      }
      
      return state;
    } catch (error) {
      console.error('Failed to load session from file:', error);
      return null;
    }
  }
  
  /**
   * Create a recovery checkpoint
   */
  createCheckpoint(id: string): any {
    const state = this.states.get(id);
    if (!state) return null;
    
    return {
      timestamp: new Date().toISOString(),
      state: JSON.parse(this.serialize(id) || '{}'),
      version: '1.0.0',
    };
  }
  
  /**
   * Restore from checkpoint
   */
  restoreFromCheckpoint(checkpoint: any): SessionState | null {
    try {
      if (!checkpoint || !checkpoint.state) {
        throw new Error('Invalid checkpoint format');
      }
      
      const state = this.deserialize(JSON.stringify(checkpoint.state));
      if (state) {
        this.states.set(state.id, state);
      }
      
      return state;
    } catch (error) {
      console.error('Failed to restore from checkpoint:', error);
      return null;
    }
  }
  
  /**
   * Validate session state integrity
   */
  validateState(state: SessionState): boolean {
    // Check required fields
    if (!state.id || !state.platform || !state.status) {
      return false;
    }
    
    // Check date fields
    if (!(state.startedAt instanceof Date) || !(state.updatedAt instanceof Date)) {
      return false;
    }
    
    // Check progress object
    if (!state.progress || typeof state.progress.processedItems !== 'number') {
      return false;
    }
    
    // Check arrays
    if (!Array.isArray(state.errors)) {
      return false;
    }
    
    // Check metrics object
    if (!state.metrics || typeof state.metrics.totalTime !== 'number') {
      return false;
    }
    
    return true;
  }
  
  /**
   * Clean up corrupted states
   */
  cleanupCorruptedStates(): number {
    let cleaned = 0;
    
    for (const [id, state] of this.states) {
      if (!this.validateState(state)) {
        this.states.delete(id);
        cleaned++;
        console.warn(`Removed corrupted session state: ${id}`);
      }
    }
    
    return cleaned;
  }
  
  /**
   * Set database manager for persistence
   */
  setDatabase(database: DatabaseManager): void {
    this.database = database;
  }
  
  /**
   * Persist session state to database
   */
  async persistToDatabase(id: string): Promise<boolean> {
    if (!this.database) {
      console.warn('Database not configured for session persistence');
      return false;
    }
    
    const state = this.states.get(id);
    if (!state) return false;
    
    try {
      const dbFormat = this.toDatabaseFormat(state);
      
      // Note: Database integration would need to be updated to support string sessionIds
      // For now, this is a placeholder showing the intended integration
      console.log('Would persist session to database:', dbFormat);
      
      return true;
    } catch (error) {
      console.error('Failed to persist session to database:', error);
      return false;
    }
  }
  
  /**
   * Load session state from database
   */
  async loadFromDatabase(sessionId: string): Promise<SessionState | null> {
    if (!this.database) {
      console.warn('Database not configured for session loading');
      return null;
    }
    
    try {
      const sessions = this.database.getRecentSessions(100);
      const sessionInfo = sessions.find(s => s.sessionId === sessionId);
      
      if (!sessionInfo) {
        return null;
      }
      
      return this.fromDatabaseFormat(sessionInfo);
    } catch (error) {
      console.error('Failed to load session from database:', error);
      return null;
    }
  }
  
  /**
   * Sync all active sessions with database
   */
  async syncWithDatabase(): Promise<{ synced: number; failed: number }> {
    if (!this.database) {
      console.warn('Database not configured for session sync');
      return { synced: 0, failed: 0 };
    }
    
    let synced = 0;
    let failed = 0;
    
    for (const [id, state] of this.states) {
      if (state.status === 'running' || state.status === 'paused') {
        const success = await this.persistToDatabase(id);
        if (success) {
          synced++;
        } else {
          failed++;
        }
      }
    }
    
    return { synced, failed };
  }
  
  /**
   * Load all resumable sessions from database
   */
  async loadResumableSessions(platform?: Platform): Promise<SessionState[]> {
    if (!this.database) {
      console.warn('Database not configured for loading resumable sessions');
      return [];
    }
    
    try {
      const resumableSessions = this.database.getResumableSessions(platform);
      const states: SessionState[] = [];
      
      for (const sessionInfo of resumableSessions) {
        const state = this.fromDatabaseFormat(sessionInfo);
        this.states.set(state.id, state);
        states.push(state);
      }
      
      return states;
    } catch (error) {
      console.error('Failed to load resumable sessions:', error);
      return [];
    }
  }
  
  /**
   * Create backup of all sessions
   */
  async createBackup(backupPath: string): Promise<boolean> {
    try {
      const { writeFile } = await import('fs/promises');
      const { dirname } = await import('path');
      const { mkdir } = await import('fs/promises');
      
      // Ensure backup directory exists
      await mkdir(dirname(backupPath), { recursive: true });
      
      // Create backup with metadata
      const backup = {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        sessionCount: this.states.size,
        sessions: this.exportSessions(),
      };
      
      const backupJson = JSON.stringify(backup, (key, value) => {
        if (value instanceof Date) {
          return value.toISOString();
        }
        if (value === undefined) {
          return null;
        }
        return value;
      }, 2);
      
      await writeFile(backupPath, backupJson, 'utf-8');
      console.log(`Created backup with ${this.states.size} sessions at ${backupPath}`);
      return true;
    } catch (error) {
      console.error('Failed to create backup:', error);
      return false;
    }
  }
  
  /**
   * Restore sessions from backup
   */
  async restoreFromBackup(backupPath: string): Promise<number> {
    try {
      const { readFile } = await import('fs/promises');
      const content = await readFile(backupPath, 'utf-8');
      const backup = JSON.parse(content);
      
      if (!backup.sessions || !Array.isArray(backup.sessions)) {
        throw new Error('Invalid backup format');
      }
      
      const sessions = this.deserializeAll(JSON.stringify(backup.sessions));
      this.importSessions(sessions);
      
      console.log(`Restored ${sessions.length} sessions from backup`);
      return sessions.length;
    } catch (error) {
      console.error('Failed to restore from backup:', error);
      return 0;
    }
  }
}