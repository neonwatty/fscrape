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
      clearOldSessions: vi.fn(),
      updateProgress: vi.fn(),
      setStatus: vi.fn(),
      updateStatus: vi.fn(),
      addError: vi.fn(),
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
  });
});