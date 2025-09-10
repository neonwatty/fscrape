/**
 * Session Module - Complete session management system for scraping operations
 *
 * This module provides comprehensive session management capabilities including:
 * - Session lifecycle management (create, start, pause, resume, complete)
 * - Progress tracking with real-time updates and ETA calculations
 * - State persistence and recovery
 * - Error handling and retry capabilities
 * - Concurrent session support
 * - Metrics and performance tracking
 */

// Core Session Management
// The main orchestrator for all session operations
export { SessionManager } from "./session-manager.js";
export type {
  SessionConfig, // Configuration for creating new sessions
  SessionEvents, // Event types emitted by SessionManager
} from "./session-manager.js";

// Session State Management
// Handles session state tracking, persistence, and recovery
export { SessionStateManager } from "./session-state.js";
export type {
  SessionState, // Complete session state representation
  SessionStatus, // Session status types: pending, running, paused, etc.
} from "./session-state.js";

// Progress Tracking
// Real-time progress monitoring with ETA calculations and milestones
export { ProgressTracker } from "./progress-tracker.js";
export type {
  ProgressUpdate, // Progress update data structure
  ProgressMilestone, // Milestone configuration and status
} from "./progress-tracker.js";

/**
 * Quick Start Example:
 *
 * ```typescript
 * import { SessionManager } from '@fscrape/session';
 *
 * const manager = new SessionManager();
 *
 * // Create and start a session
 * const session = await manager.createSession({
 *   platform: 'reddit',
 *   queryType: 'subreddit',
 *   queryValue: 'programming',
 *   maxItems: 100
 * });
 *
 * await manager.startSession(session.id);
 *
 * // Update progress
 * manager.updateProgress(session.id, 50, 100);
 *
 * // Pause if needed
 * await manager.pauseSession(session.id);
 *
 * // Resume later
 * await manager.resumeSession(session.id);
 *
 * // Complete when done
 * await manager.completeSession(session.id);
 * ```
 */
