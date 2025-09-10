import type { Platform } from "../types/core.js";
import type { PlatformConstructor } from "./platform-factory.js";

/**
 * Registry for platform implementations
 * Allows dynamic registration of new platforms
 */
export class PlatformRegistry {
  private static platforms = new Map<Platform, PlatformConstructor>();
  private static initialized = false;

  /**
   * Register a platform implementation
   */
  static register(platform: Platform, constructor: PlatformConstructor): void {
    if (this.platforms.has(platform)) {
      throw new Error(
        `Platform "${platform}" is already registered. Use unregister() first to replace it.`,
      );
    }

    this.platforms.set(platform, constructor);
  }

  /**
   * Unregister a platform
   */
  static unregister(platform: Platform): boolean {
    return this.platforms.delete(platform);
  }

  /**
   * Get a platform constructor
   */
  static get(platform: Platform): PlatformConstructor | undefined {
    // Initialize default platforms if not done yet
    if (!this.initialized) {
      this.initializeDefaults();
    }

    return this.platforms.get(platform);
  }

  /**
   * Check if a platform is registered
   */
  static has(platform: Platform): boolean {
    if (!this.initialized) {
      this.initializeDefaults();
    }

    return this.platforms.has(platform);
  }

  /**
   * List all registered platforms
   */
  static list(): Platform[] {
    if (!this.initialized) {
      this.initializeDefaults();
    }

    return Array.from(this.platforms.keys());
  }

  /**
   * Clear all registrations
   */
  static clear(): void {
    this.platforms.clear();
    this.initialized = false;
  }

  /**
   * Get registry size
   */
  static size(): number {
    if (!this.initialized) {
      this.initializeDefaults();
    }

    return this.platforms.size;
  }

  /**
   * Initialize with default platform implementations
   * This will be called automatically when needed
   */
  private static initializeDefaults(): void {
    // Note: These imports will be added when the actual platform
    // implementations are created in subsequent tasks
    // For now, we'll just mark as initialized to prevent loops

    // Future implementation:
    // import { RedditPlatform } from "./reddit/reddit-platform.js";
    // import { HackerNewsPlatform } from "./hackernews/hackernews-platform.js";
    //
    // this.register("reddit", RedditPlatform);
    // this.register("hackernews", HackerNewsPlatform);

    this.initialized = true;
  }

  /**
   * Force re-initialization of defaults
   */
  static reinitialize(): void {
    this.clear();
    this.initializeDefaults();
  }
}
