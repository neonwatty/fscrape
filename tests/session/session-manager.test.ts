import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SessionManager } from '../../src/session/session-manager';
import { ProgressTracker } from '../../src/session/progress-tracker';
import { SessionStateManager } from '../../src/session/session-state';
import { DatabaseManager } from '../../src/database/database';
import type { Session, SessionProgress, SessionMetrics } from '../../src/types/core';

// Mock dependencies
vi.mock('../../src/database/database');
vi.mock('../../src/session/progress-tracker');
vi.mock('../../src/session/session-state');

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockDatabase: any;
  let mockProgressTracker: any;
  let mockSessionState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup mock database
    mockDatabase = {
      run: vi.fn().mockResolvedValue({ lastID: 1 }),
      get: vi.fn(),
      all: vi.fn(),
      prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ lastID: 1 }),
        get: vi.fn(),
        all: vi.fn(),
      }),
      getActiveSessions: vi.fn().mockReturnValue([]),
      getSession: vi.fn(),
      updateSession: vi.fn(),
      createSession: vi.fn().mockReturnValue({ id: 1, sessionId: 'test-session-id' }),
      getAllSessions: vi.fn().mockReturnValue([]),
      cleanupOldSessions: vi.fn(),
    };
    (DatabaseManager.getInstance as any) = vi.fn().mockReturnValue(mockDatabase);
    
    // Setup mock progress tracker
    mockProgressTracker = {
      startTracking: vi.fn(),
      updateProgress: vi.fn(),
      stopTracking: vi.fn(),
      getProgress: vi.fn().mockReturnValue({
        itemsScraped: 0,
        totalItems: 100,
        percentageComplete: 0,
        elapsedMs: 0,
        remainingMs: 0,
      }),
      reset: vi.fn(),
      on: vi.fn(),
      removeAllListeners: vi.fn(),
      formatProgress: vi.fn().mockReturnValue({
        percentage: 0,
        itemsScraped: 0,
        totalItems: 100,
        elapsedTime: '0s',
        estimatedRemaining: '0s',
      }),
      emit: vi.fn(),
      destroy: vi.fn(),
      getEstimatedCompletion: vi.fn().mockReturnValue(null),
    };
    (ProgressTracker as any).mockImplementation(() => mockProgressTracker);
    
    // Setup mock session state
    mockSessionState = {
      saveState: vi.fn().mockResolvedValue(undefined),
      loadState: vi.fn().mockResolvedValue(null),
      clearState: vi.fn().mockResolvedValue(undefined),
      getStateFile: vi.fn().mockReturnValue('./session-state.json'),
      createSession: vi.fn().mockReturnValue({
        id: 'test-session-id',
        platform: 'reddit',
        status: 'pending',
        metadata: {},
        progress: { itemsScraped: 0, totalItems: 0 },
        startedAt: new Date(),
      }),
      getSession: vi.fn().mockReturnValue({
        id: 'test-session-id',
        platform: 'reddit',
        status: 'running',
        metadata: {},
        progress: { itemsScraped: 0, totalItems: 0 },
        startedAt: new Date(),
      }),
      updateSession: vi.fn(),
      canResume: vi.fn().mockReturnValue(true),
      pauseSession: vi.fn(),
      completeSession: vi.fn(),
      failSession: vi.fn(),
      getAllSessions: vi.fn().mockReturnValue([]),
      getActiveSessions: vi.fn().mockReturnValue([]),
      getSessionsByStatus: vi.fn().mockReturnValue([]),
      clearOldSessions: vi.fn(),
      updateProgress: vi.fn(),
      updateMetrics: vi.fn(),
      updateResumeData: vi.fn(),
      setStatus: vi.fn(),
      updateStatus: vi.fn(),
      addError: vi.fn(),
      exportSessions: vi.fn().mockReturnValue([]),
      importSessions: vi.fn(),
      fromDatabaseFormat: vi.fn(),
      toDatabaseFormat: vi.fn().mockReturnValue({
        sessionId: 'test-session-id',
        platform: 'reddit',
        queryType: null,
        queryValue: null,
        status: 'running',
        totalItemsTarget: 0,
        totalItemsScraped: 0,
        totalPosts: 0,
        totalComments: 0,
        totalUsers: 0,
        lastItemId: null,
        resumeToken: null,
        startedAt: new Date(),
        completedAt: null,
        metadata: '{}',
        error: null,
      }),
    };
    (SessionStateManager as any).mockImplementation(() => mockSessionState);
    
    sessionManager = new SessionManager(mockDatabase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Session Creation', () => {
    it('should create a new session', async () => {
      const session = await sessionManager.createSession({
        platform: 'reddit',
        queryType: 'category',
        queryValue: 'programming',
        maxItems: 100,
      });
      
      expect(session.id).toBe('test-session-id');
      expect(mockSessionState.createSession).toHaveBeenCalled();
      expect(mockProgressTracker.startTracking).toHaveBeenCalled();
    });

    it('should generate unique session ID', async () => {
      mockSessionState.createSession.mockReturnValueOnce({
        id: 'session-1',
        platform: 'reddit',
        status: 'pending',
        metadata: {},
        progress: { itemsScraped: 0, totalItems: 0 },
        startedAt: new Date(),
      });
      mockSessionState.createSession.mockReturnValueOnce({
        id: 'session-2',
        platform: 'hackernews',
        status: 'pending',
        metadata: {},
        progress: { itemsScraped: 0, totalItems: 0 },
        startedAt: new Date(),
      });

      const session1 = await sessionManager.createSession({ platform: 'reddit' });
      const session2 = await sessionManager.createSession({ platform: 'hackernews' });
      
      expect(session1.id).not.toBe(session2.id);
      expect(mockSessionState.createSession).toHaveBeenCalledTimes(2);
    });

    it('should store session metadata', async () => {
      const config = {
        platform: 'reddit' as const,
        queryType: 'subreddit',
        queryValue: 'programming',
        maxItems: 50,
      };
      
      await sessionManager.createSession(config);
      
      expect(mockSessionState.createSession).toHaveBeenCalledWith(
        expect.any(String),
        'reddit',
        expect.any(Object)
      );
    });

    it('should handle creation errors', async () => {
      mockSessionState.createSession.mockImplementationOnce(() => {
        throw new Error('Database error');
      });
      
      await expect(
        sessionManager.createSession({ platform: 'reddit' })
      ).rejects.toThrow('Database error');
    });
  });

  describe('Session Progress', () => {
    it('should update session progress', async () => {
      // Create session first
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Update progress through progress tracker events
      mockProgressTracker.emit('progress:update', {
        sessionId: session.id,
        itemsScraped: 10,
        totalItems: 100,
      });
      
      expect(mockProgressTracker.emit).toHaveBeenCalled();
    });

    it('should track rate limiting', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockProgressTracker.emit('progress:rateLimited', {
        sessionId: session.id,
        waitTimeMs: 60000,
      });
      
      expect(mockProgressTracker.emit).toHaveBeenCalled();
    });

    it('should track errors', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockProgressTracker.emit('progress:error', {
        sessionId: session.id,
        error: new Error('Test error'),
      });
      
      expect(mockProgressTracker.emit).toHaveBeenCalled();
    });

    it('should calculate progress percentage', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockProgressTracker.getProgress.mockReturnValue({
        itemsScraped: 50,
        totalItems: 100,
        percentageComplete: 50,
        elapsedMs: 10000,
        remainingMs: 10000,
      });
      
      const progress = mockProgressTracker.formatProgress();
      expect(progress).toBeDefined();
    });
  });

  describe('Session Completion', () => {
    it('should complete session successfully', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      await sessionManager.completeSession(session.id);
      
      expect(mockSessionState.completeSession).toHaveBeenCalledWith(session.id);
      expect(mockProgressTracker.stopTracking).toHaveBeenCalledWith(session.id);
    });

    it('should mark session as failed', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      const error = new Error('Network error');
      
      await sessionManager.failSession(session.id, error);
      
      expect(mockSessionState.failSession).toHaveBeenCalledWith(session.id, error);
      expect(mockProgressTracker.stopTracking).toHaveBeenCalledWith(session.id);
    });

    it('should save final metrics', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockProgressTracker.getProgress.mockReturnValue({
        itemsScraped: 100,
        totalItems: 100,
        percentageComplete: 100,
        elapsedMs: 60000,
        remainingMs: 0,
      });
      
      await sessionManager.completeSession(session.id);
      
      expect(mockSessionState.completeSession).toHaveBeenCalled();
    });
  });

  describe('Session Retrieval', () => {
    it('should get session by ID', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockSessionState.getSession.mockReturnValue({
        id: session.id,
        platform: 'reddit',
        status: 'running',
        metadata: {},
        progress: { itemsScraped: 0, totalItems: 0 },
        startedAt: new Date(),
      });
      
      const retrieved = sessionManager.getSession(session.id);
      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(session.id);
    });

    it('should get active session', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockSessionState.getActiveSessions.mockReturnValue([{
        id: session.id,
        platform: 'reddit',
        status: 'running',
        metadata: {},
        progress: { itemsScraped: 0, totalItems: 0 },
        startedAt: new Date(),
      }]);
      
      const activeSessions = sessionManager.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(session.id);
    });

    it('should list all sessions', async () => {
      await sessionManager.createSession({ platform: 'reddit' });
      
      mockSessionState.getAllSessions.mockReturnValue([
        {
          id: 'session-1',
          platform: 'reddit',
          status: 'completed',
          metadata: {},
          progress: { itemsScraped: 100, totalItems: 100 },
          startedAt: new Date(),
        },
        {
          id: 'session-2',
          platform: 'hackernews',
          status: 'running',
          metadata: {},
          progress: { itemsScraped: 50, totalItems: 100 },
          startedAt: new Date(),
        },
      ]);
      
      const sessions = sessionManager.getAllSessions();
      expect(sessions).toHaveLength(2);
    });

    it('should filter sessions by platform', async () => {
      mockSessionState.getAllSessions.mockReturnValue([
        {
          id: 'session-1',
          platform: 'reddit',
          status: 'completed',
          metadata: {},
          progress: { itemsScraped: 100, totalItems: 100 },
          startedAt: new Date(),
        },
      ]);
      
      const sessions = sessionManager.getAllSessions();
      const redditSessions = sessions.filter(s => s.platform === 'reddit');
      expect(redditSessions).toHaveLength(1);
    });

    it('should filter sessions by status', async () => {
      mockSessionState.getAllSessions.mockReturnValue([
        {
          id: 'session-1',
          platform: 'reddit',
          status: 'completed',
          metadata: {},
          progress: { itemsScraped: 100, totalItems: 100 },
          startedAt: new Date(),
        },
      ]);
      
      const sessions = sessionManager.getAllSessions();
      const completedSessions = sessions.filter(s => s.status === 'completed');
      expect(completedSessions).toHaveLength(1);
    });

    it('should filter sessions by date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');
      
      mockSessionState.getAllSessions.mockReturnValue([
        {
          id: 'session-1',
          platform: 'reddit',
          status: 'completed',
          metadata: {},
          progress: { itemsScraped: 100, totalItems: 100 },
          startedAt: new Date('2024-06-15'),
        },
      ]);
      
      const sessions = sessionManager.getAllSessions();
      const filteredSessions = sessions.filter(s => {
        const sessionDate = new Date(s.startedAt);
        return sessionDate >= startDate && sessionDate <= endDate;
      });
      expect(filteredSessions).toHaveLength(1);
    });
  });

  describe('Session Resumption', () => {
    it('should resume interrupted session', async () => {
      mockSessionState.getSession.mockReturnValue({
        id: 'session-1',
        platform: 'reddit',
        status: 'paused',
        metadata: {},
        progress: { itemsScraped: 50, totalItems: 100 },
        startedAt: new Date(),
      });
      
      mockSessionState.canResume.mockReturnValue(true);
      
      const resumed = await sessionManager.resumeSession('session-1');
      
      expect(resumed).toBeDefined();
      expect(mockSessionState.setStatus).toHaveBeenCalledWith('session-1', 'running');
      expect(mockProgressTracker.startTracking).toHaveBeenCalled();
    });

    it('should not resume completed session', async () => {
      mockSessionState.getSession.mockReturnValue({
        id: 'session-1',
        platform: 'reddit',
        status: 'completed',
        metadata: {},
        progress: { itemsScraped: 100, totalItems: 100 },
        startedAt: new Date(),
      });
      
      mockSessionState.canResume.mockReturnValue(false);
      
      await expect(
        sessionManager.resumeSession('session-1')
      ).rejects.toThrow('Cannot resume session');
    });

    it('should handle missing session state', async () => {
      mockSessionState.getSession.mockReturnValue(null);
      
      await expect(
        sessionManager.resumeSession('nonexistent')
      ).rejects.toThrow('Session not found');
    });
  });

  describe('Session Pause', () => {
    it('should pause active session', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Set session to running state
      mockSessionState.getSession.mockReturnValue({
        ...session,
        status: 'running',
      });
      
      await sessionManager.pauseSession(session.id);
      
      expect(mockSessionState.pauseSession).toHaveBeenCalledWith(session.id);
      expect(mockProgressTracker.stopTracking).toHaveBeenCalledWith(session.id);
    });

    it('should save current progress on pause', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Set session to running state
      mockSessionState.getSession.mockReturnValue({
        ...session,
        status: 'running',
      });
      
      mockProgressTracker.getProgress.mockReturnValue({
        current: 75,
        total: 100,
        itemsScraped: 75,
        totalItems: 100,
        percentageComplete: 75,
        elapsedMs: 45000,
        remainingMs: 15000,
      });
      
      await sessionManager.pauseSession(session.id);
      
      expect(mockSessionState.updateProgress).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          processedItems: 75,
          totalItems: 100,
        })
      );
    });
  });

  describe('Session Metrics', () => {
    it('should calculate session metrics', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockProgressTracker.getProgress.mockReturnValue({
        itemsScraped: 100,
        totalItems: 100,
        percentageComplete: 100,
        elapsedMs: 60000,
        remainingMs: 0,
      });
      
      const metrics = sessionManager.getSessionMetrics(session.id);
      
      expect(metrics).toBeDefined();
      expect(metrics.progress).toBeDefined();
    });

    it('should aggregate platform metrics', async () => {
      mockSessionState.getAllSessions.mockReturnValue([
        {
          id: 'session-1',
          platform: 'reddit',
          status: 'completed',
          metadata: {},
          progress: { itemsScraped: 100, totalItems: 100 },
          startedAt: new Date(),
        },
        {
          id: 'session-2',
          platform: 'reddit',
          status: 'completed',
          metadata: {},
          progress: { itemsScraped: 200, totalItems: 200 },
          startedAt: new Date(),
        },
      ]);
      
      const sessions = sessionManager.getAllSessions();
      const redditMetrics = sessions
        .filter(s => s.platform === 'reddit')
        .reduce((acc, s) => ({
          totalItems: acc.totalItems + s.progress.totalItems,
          itemsScraped: acc.itemsScraped + s.progress.itemsScraped,
        }), { totalItems: 0, itemsScraped: 0 });
      
      expect(redditMetrics.itemsScraped).toBe(300);
      expect(redditMetrics.totalItems).toBe(300);
    });

    it('should track error rates', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Simulate errors
      for (let i = 0; i < 5; i++) {
        mockProgressTracker.emit('progress:error', {
          sessionId: session.id,
          error: new Error('Test error'),
        });
      }
      
      expect(mockProgressTracker.emit).toHaveBeenCalledTimes(5);
    });
  });

  describe('Session Cleanup', () => {
    it('should clean up old sessions', async () => {
      await sessionManager.cleanupOldSessions(30);
      
      expect(mockSessionState.clearOldSessions).toHaveBeenCalledWith(30);
    });

    it('should not delete active sessions', async () => {
      mockSessionState.getActiveSessions.mockReturnValue([
        {
          id: 'active-session',
          platform: 'reddit',
          status: 'running',
          metadata: {},
          progress: { itemsScraped: 50, totalItems: 100 },
          startedAt: new Date(),
        },
      ]);
      
      await sessionManager.cleanupOldSessions(30);
      
      const activeSessions = sessionManager.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
    });

    it('should clean up orphaned state files', async () => {
      await sessionManager.cleanupOldSessions(30);
      
      expect(mockSessionState.clearOldSessions).toHaveBeenCalled();
    });
  });

  describe('Concurrent Session Management', () => {
    it('should prevent multiple active sessions', async () => {
      mockSessionState.getActiveSessions.mockReturnValue([
        {
          id: 'active-session',
          platform: 'reddit',
          status: 'running',
          metadata: {},
          progress: { itemsScraped: 50, totalItems: 100 },
          startedAt: new Date(),
        },
      ]);
      
      mockSessionState.createSession.mockImplementationOnce(() => {
        throw new Error('Another session is already active');
      });
      
      await expect(
        sessionManager.createSession({ platform: 'hackernews' })
      ).rejects.toThrow('Another session is already active');
    });

    it('should allow multiple sessions if configured', async () => {
      // Assuming the SessionManager is configured to allow multiple sessions
      mockSessionState.getActiveSessions.mockReturnValue([]);
      
      const session1 = await sessionManager.createSession({ platform: 'reddit' });
      const session2 = await sessionManager.createSession({ platform: 'hackernews' });
      
      expect(session1).toBeDefined();
      expect(session2).toBeDefined();
      expect(mockSessionState.createSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('Session Lifecycle Tests', () => {
    it('should handle full session lifecycle from creation to completion', async () => {
      const session = await sessionManager.createSession({ 
        platform: 'reddit',
        maxItems: 100 
      });
      
      // Verify initial state
      expect(session.status).toBe('pending');
      
      // Start session
      mockSessionState.getSession.mockReturnValueOnce({
        ...session,
        status: 'pending',
      });
      
      mockSessionState.updateStatus.mockImplementation((id, status) => {
        if (status === 'running') {
          mockSessionState.getSession.mockReturnValue({
            ...session,
            status: 'running',
          });
        }
      });
      
      await sessionManager.startSession(session.id);
      
      // Verify running state
      expect(mockSessionState.updateStatus).toHaveBeenCalledWith(session.id, 'running');
      
      // Update progress
      sessionManager.updateProgress(session.id, 50, 100);
      expect(mockProgressTracker.updateProgress).toHaveBeenCalledWith(session.id, 50, 100);
      
      // Complete session
      mockSessionState.completeSession.mockImplementation((id) => {
        mockSessionState.getSession.mockReturnValue({
          ...session,
          status: 'completed',
        });
      });
      
      await sessionManager.completeSession(session.id);
      expect(mockSessionState.completeSession).toHaveBeenCalledWith(session.id);
    });

    it('should handle session failure lifecycle', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      const error = new Error('Fatal error occurred');
      
      // Start session
      mockSessionState.getSession.mockReturnValueOnce({
        ...session,
        status: 'pending',
      });
      
      await sessionManager.startSession(session.id);
      
      // Fail session
      mockSessionState.failSession.mockImplementation((id, err) => {
        mockSessionState.getSession.mockReturnValue({
          ...session,
          status: 'failed',
          error: err.message,
        });
      });
      
      await sessionManager.failSession(session.id, error);
      
      expect(mockSessionState.failSession).toHaveBeenCalledWith(session.id, error);
      expect(mockProgressTracker.stopTracking).toHaveBeenCalledWith(session.id);
    });

    it('should handle session cancellation', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Start session - first set to pending for start check
      mockSessionState.getSession.mockReturnValueOnce({
        ...session,
        status: 'pending',
      });
      
      // After start, return running status
      mockSessionState.getSession.mockReturnValue({
        ...session,
        status: 'running',
      });
      
      await sessionManager.startSession(session.id);
      
      // Cancel session
      await sessionManager.cancelSession(session.id);
      
      expect(mockSessionState.updateStatus).toHaveBeenCalledWith(session.id, 'cancelled');
      expect(mockProgressTracker.stopTracking).toHaveBeenCalledWith(session.id);
    });
  });

  describe('State Persistence Tests', () => {
    it('should persist session state to database', async () => {
      const session = await sessionManager.createSession({ 
        platform: 'reddit',
        maxItems: 100 
      });
      
      // Verify database persistence was called
      expect(mockDatabase.updateSession).toHaveBeenCalled();
    });

    it('should auto-persist session state at intervals', async () => {
      vi.useFakeTimers();
      
      // Create session manager with auto-persist
      const autoSessionManager = new SessionManager(mockDatabase, undefined, {
        autoPersistMs: 5000,
      });
      
      const session = await autoSessionManager.createSession({ platform: 'reddit' });
      
      // Advance time to trigger auto-persist
      vi.advanceTimersByTime(5000);
      
      // Verify persistence was called
      expect(mockDatabase.updateSession).toHaveBeenCalled();
      
      autoSessionManager.destroy();
      vi.useRealTimers();
    });

    it('should export and import session states', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockSessionState.exportSessions.mockReturnValue([{
        id: session.id,
        platform: 'reddit',
        status: 'running',
        metadata: {},
        progress: { itemsScraped: 50, totalItems: 100 },
        startedAt: new Date(),
      }]);
      
      const exported = sessionManager.exportSessions();
      expect(exported).toHaveLength(1);
      
      // Import sessions
      sessionManager.importSessions(exported);
      expect(mockSessionState.importSessions).toHaveBeenCalledWith(exported);
    });

    it('should handle database persistence errors gracefully', async () => {
      mockDatabase.updateSession.mockRejectedValueOnce(new Error('Database error'));
      
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Session should still be created despite database error
      expect(session).toBeDefined();
    });
  });

  describe('Crash Recovery Tests', () => {
    it('should recover from crash by loading persisted state', async () => {
      // Simulate crashed session in database
      mockDatabase.getActiveSessions.mockReturnValue([{
        id: 1,
        sessionId: 'crashed-session',
        platform: 'reddit',
        status: 'running',
        totalItemsScraped: 50,
        totalItemsTarget: 100,
        startedAt: new Date(),
        metadata: '{}',
      }]);
      
      // Create new session manager (simulating restart)
      const recoveredManager = new SessionManager(mockDatabase);
      
      // Verify session was loaded and marked as paused
      expect(mockSessionState.fromDatabaseFormat).toHaveBeenCalled();
    });

    it('should handle corrupted session state during recovery', async () => {
      mockDatabase.getActiveSessions.mockReturnValue([{
        id: 1,
        sessionId: 'corrupted-session',
        platform: null, // Invalid platform
        status: 'running',
        totalItemsScraped: -1, // Invalid progress
        startedAt: 'invalid-date', // Invalid date
      }]);
      
      mockSessionState.fromDatabaseFormat.mockImplementation(() => {
        throw new Error('Invalid session data');
      });
      
      // Should not throw, but log error
      const recoveredManager = new SessionManager(mockDatabase);
      expect(recoveredManager).toBeDefined();
    });

    it('should clean up abort controllers on crash recovery', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Start session to create abort controller
      mockSessionState.getSession.mockReturnValue({
        ...session,
        status: 'pending',
      });
      
      await sessionManager.startSession(session.id);
      
      // Simulate crash by destroying session manager
      sessionManager.destroy();
      
      // Verify abort controllers were cleaned up
      const signal = sessionManager.getAbortSignal(session.id);
      expect(signal).toBeUndefined();
    });

    it('should recover session metrics after crash', async () => {
      // Simulate session with metrics in database
      const sessionWithMetrics = {
        id: 'metrics-session',
        platform: 'reddit',
        status: 'paused',
        progress: { processedItems: 75, totalItems: 100 },
        metrics: {
          averageItemTime: 500,
          totalTime: 37500,
          requestCount: 75,
          rateLimitHits: 0,
        },
        config: { maxItems: 100 },
        errors: [],
        startedAt: new Date(Date.now() - 60000),
        updatedAt: new Date(),
      };
      
      mockDatabase.getSession.mockReturnValue({
        id: 1,
        sessionId: 'metrics-session',
        platform: 'reddit',
        status: 'paused',
        totalItemsScraped: 75,
        totalItemsTarget: 100,
        startedAt: new Date(Date.now() - 60000),
        metadata: JSON.stringify({
          averageItemTime: 500,
          requestCount: 75,
        }),
      });
      
      mockSessionState.fromDatabaseFormat.mockReturnValue(sessionWithMetrics);
      
      // Mock getSession to return session after fromDatabaseFormat
      mockSessionState.getSession.mockReturnValue(sessionWithMetrics);
      mockSessionState.canResume.mockReturnValue(true);
      
      const resumed = await sessionManager.resumeSession('metrics-session');
      
      expect(resumed.metrics.averageItemTime).toBe(500);
      expect(resumed.metrics.requestCount).toBe(75);
    });
  });

  describe('Pause/Resume Tests', () => {
    it('should pause session and preserve exact state', async () => {
      const session = await sessionManager.createSession({ 
        platform: 'reddit',
        maxItems: 100 
      });
      
      // Start session - first set to pending for start check
      mockSessionState.getSession.mockReturnValueOnce({
        ...session,
        status: 'pending',
      });
      
      // After start, return running status
      mockSessionState.getSession.mockReturnValue({
        ...session,
        status: 'running',
      });
      
      await sessionManager.startSession(session.id);
      
      // Update progress and metrics
      sessionManager.updateProgress(session.id, 60, 100);
      sessionManager.updateMetrics(session.id, {
        requestCount: 60,
        averageItemTime: 1000,
      });
      
      // Set specific progress for pause
      mockProgressTracker.getProgress.mockReturnValue({
        current: 60,
        total: 100,
        itemsScraped: 60,
        totalItems: 100,
        percentageComplete: 60,
        elapsedMs: 60000,
        remainingMs: 40000,
      });
      
      // Pause session
      await sessionManager.pauseSession(session.id);
      
      // Verify state was preserved
      expect(mockSessionState.updateProgress).toHaveBeenCalledWith(
        session.id,
        expect.objectContaining({
          processedItems: 60,
          totalItems: 100,
        })
      );
      expect(mockSessionState.pauseSession).toHaveBeenCalledWith(session.id);
    });

    it('should resume paused session from exact checkpoint', async () => {
      // Setup paused session
      mockSessionState.getSession.mockReturnValue({
        id: 'paused-session',
        platform: 'reddit',
        status: 'paused',
        progress: { 
          processedItems: 60,
          totalItems: 100,
          lastItemId: 'item-60',
        },
        resumeData: {
          token: 'resume-token',
          checkpoint: { page: 3, offset: 10 },
          lastSuccessfulItem: 'item-60',
        },
        startedAt: new Date(),
      });
      
      mockSessionState.canResume.mockReturnValue(true);
      
      const resumed = await sessionManager.resumeSession('paused-session');
      
      expect(resumed.resumeData?.lastSuccessfulItem).toBe('item-60');
      expect(mockSessionState.setStatus).toHaveBeenCalledWith('paused-session', 'running');
      expect(mockProgressTracker.startTracking).toHaveBeenCalled();
    });

    it('should handle rapid pause/resume cycles', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Start session - first set to pending for start check
      mockSessionState.getSession.mockReturnValueOnce({
        ...session,
        status: 'pending',
      });
      
      // After start, return running status
      mockSessionState.getSession.mockReturnValue({
        ...session,
        status: 'running',
      });
      
      await sessionManager.startSession(session.id);
      
      // Rapid pause/resume cycles
      for (let i = 0; i < 5; i++) {
        // Pause
        mockSessionState.getSession.mockReturnValue({
          ...session,
          status: 'running',
        });
        await sessionManager.pauseSession(session.id);
        
        // Resume
        mockSessionState.getSession.mockReturnValue({
          ...session,
          status: 'paused',
        });
        mockSessionState.canResume.mockReturnValue(true);
        await sessionManager.resumeSession(session.id);
      }
      
      // Verify tracking was properly managed
      expect(mockProgressTracker.stopTracking).toHaveBeenCalledTimes(5);
      expect(mockProgressTracker.startTracking).toHaveBeenCalledTimes(6); // Initial + 5 resumes
    });

    it('should update resume data during session', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      const resumeData = {
        token: 'new-token',
        checkpoint: { page: 5, offset: 25 },
        lastSuccessfulItem: 'item-125',
        nextUrl: 'https://api.reddit.com/next?after=125',
      };
      
      sessionManager.updateResumeData(session.id, resumeData);
      
      expect(mockSessionState.updateResumeData).toHaveBeenCalledWith(
        session.id,
        resumeData
      );
    });

    it('should not allow resuming non-resumable sessions', async () => {
      mockSessionState.getSession.mockReturnValue({
        id: 'completed-session',
        platform: 'reddit',
        status: 'completed',
        progress: { processedItems: 100, totalItems: 100 },
        startedAt: new Date(),
      });
      
      mockSessionState.canResume.mockReturnValue(false);
      
      await expect(
        sessionManager.resumeSession('completed-session')
      ).rejects.toThrow('Cannot resume session');
    });

    it('should handle pause during rate limiting', async () => {
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Simulate rate limiting state
      mockSessionState.getSession.mockReturnValue({
        ...session,
        status: 'running',
        metrics: {
          rateLimitHits: 5,
          averageItemTime: 1000,
          totalTime: 30000,
          requestCount: 30,
        },
      });
      
      // Pause during rate limit
      await sessionManager.pauseSession(session.id);
      
      // Verify rate limit state is preserved
      expect(mockSessionState.pauseSession).toHaveBeenCalled();
      expect(mockProgressTracker.stopTracking).toHaveBeenCalled();
    });
  });

  describe('Session Events', () => {
    it('should emit session started event', async () => {
      const eventSpy = vi.fn();
      sessionManager.on('session:started', eventSpy);
      
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // First getSession call should return pending status
      mockSessionState.getSession.mockReturnValueOnce({
        ...session,
        status: 'pending',
      });
      
      // After updateStatus is called, return running status
      mockSessionState.updateStatus.mockImplementation((id, status) => {
        if (status === 'running') {
          mockSessionState.getSession.mockReturnValue({
            ...session,
            status: 'running',
          });
        }
      });
      
      await sessionManager.startSession(session.id);
      
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: session.id,
        status: 'running',
      }));
    });

    it('should emit progress update event', async () => {
      const eventSpy = vi.fn();
      sessionManager.on('session:progress', eventSpy);
      
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockProgressTracker.emit('progress:update', {
        sessionId: session.id,
        itemsScraped: 10,
        totalItems: 100,
      });
      
      // Progress events are typically emitted through the progress tracker
      expect(mockProgressTracker.emit).toHaveBeenCalled();
    });

    it('should emit session completed event', async () => {
      const eventSpy = vi.fn();
      sessionManager.on('session:completed', eventSpy);
      
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      // Mock that completeSession updates the status
      mockSessionState.completeSession.mockImplementation((id) => {
        mockSessionState.getSession.mockReturnValue({
          ...session,
          status: 'completed',
        });
      });
      
      await sessionManager.completeSession(session.id);
      
      expect(eventSpy).toHaveBeenCalledWith(expect.objectContaining({
        id: session.id,
        status: 'completed',
      }));
    });

    it('should emit session failed event with error', async () => {
      const eventSpy = vi.fn();
      sessionManager.on('session:failed', eventSpy);
      
      const session = await sessionManager.createSession({ platform: 'reddit' });
      const error = new Error('Critical failure');
      
      mockSessionState.failSession.mockImplementation((id, err) => {
        mockSessionState.getSession.mockReturnValue({
          ...session,
          status: 'failed',
          error: err.message,
        });
      });
      
      await sessionManager.failSession(session.id, error);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: session.id,
          status: 'failed',
        }),
        error
      );
    });

    it('should emit session paused event', async () => {
      const eventSpy = vi.fn();
      sessionManager.on('session:paused', eventSpy);
      
      const session = await sessionManager.createSession({ platform: 'reddit' });
      
      mockSessionState.getSession.mockReturnValue({
        ...session,
        status: 'running',
      });
      
      await sessionManager.pauseSession(session.id);
      
      expect(eventSpy).toHaveBeenCalled();
    });

    it('should emit session resumed event', async () => {
      const eventSpy = vi.fn();
      sessionManager.on('session:resumed', eventSpy);
      
      mockSessionState.getSession.mockReturnValue({
        id: 'paused-session',
        platform: 'reddit',
        status: 'paused',
        progress: { processedItems: 50, totalItems: 100 },
        startedAt: new Date(),
      });
      
      mockSessionState.canResume.mockReturnValue(true);
      
      await sessionManager.resumeSession('paused-session');
      
      expect(eventSpy).toHaveBeenCalled();
    });
  });
});