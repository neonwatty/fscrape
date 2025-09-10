/**
 * Session module - Session management for scraping operations
 */

// Session manager
export { SessionManager } from "./session-manager.js";
export type { SessionConfig, SessionEvents } from "./session-manager.js";

// Session state
export { SessionStateManager } from "./session-state.js";
export type { SessionState, SessionStatus } from "./session-state.js";

// Progress tracking
export { ProgressTracker } from "./progress-tracker.js";
export type { ProgressUpdate, ProgressMilestone } from "./progress-tracker.js";
