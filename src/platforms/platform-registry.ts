import type { Platform } from "../types/core.js";
import type { PlatformConstructor } from "./platform-factory.js";
import type { BasePlatformCapabilities } from "./base-platform.js";
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "../utils/logger.js";
import winston from "winston";

/**
 * Metadata for registered platforms
 */
export interface PlatformMetadata {
  name: Platform;
  constructor: PlatformConstructor;
  capabilities: BasePlatformCapabilities;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  dependencies?: string[];
}

/**
 * Plugin manifest for dynamic loading
 */
export interface PluginManifest {
  name: string;
  platform: Platform;
  version: string;
  main: string;
  capabilities: BasePlatformCapabilities;
  description?: string;
  author?: string;
  homepage?: string;
  dependencies?: string[];
}

/**
 * Registry for platform implementations
 * Allows dynamic registration of new platforms with plugin support
 */
export class PlatformRegistry {
  private static platforms = new Map<Platform, PlatformMetadata>();
  private static initialized = false;
  private static logger = logger;
  private static pluginDirs: string[] = [];

  /**
   * Register a platform implementation with metadata
   */
  static register(
    platform: Platform,
    constructor: PlatformConstructor,
    metadata?: Omit<
      Partial<PlatformMetadata>,
      "name" | "constructor" | "capabilities"
    >,
  ): void {
    if (this.platforms.has(platform)) {
      throw new Error(
        `Platform "${platform}" is already registered. Use unregister() first to replace it.`,
      );
    }

    // Create platform instance to get capabilities
    const tempLogger = winston.createLogger({
      level: "error",
      silent: true,
    });
    const tempInstance = new constructor(platform, {}, tempLogger);
    const capabilities = tempInstance.getCapabilities();

    const fullMetadata: PlatformMetadata = {
      name: platform,
      constructor,
      capabilities,
      version: metadata?.version || "1.0.0",
      ...(metadata?.description && { description: metadata.description }),
      ...(metadata?.author && { author: metadata.author }),
      ...(metadata?.homepage && { homepage: metadata.homepage }),
      ...(metadata?.dependencies && { dependencies: metadata.dependencies }),
    };

    this.platforms.set(platform, fullMetadata);
    this.logger.info(`Registered platform: ${platform}`);
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

    const metadata = this.platforms.get(platform);
    return metadata?.constructor;
  }

  /**
   * Get platform metadata
   */
  static getMetadata(platform: Platform): PlatformMetadata | undefined {
    if (!this.initialized) {
      this.initializeDefaults();
    }

    return this.platforms.get(platform);
  }

  /**
   * Get all platform metadata
   */
  static getAllMetadata(): PlatformMetadata[] {
    if (!this.initialized) {
      this.initializeDefaults();
    }

    return Array.from(this.platforms.values());
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
   * List platforms with specific capabilities
   */
  static listByCapability(
    capability: keyof BasePlatformCapabilities,
  ): Platform[] {
    if (!this.initialized) {
      this.initializeDefaults();
    }

    return Array.from(this.platforms.entries())
      .filter(([_, metadata]) => metadata.capabilities[capability])
      .map(([platform]) => platform);
  }

  /**
   * Add a plugin directory for discovery
   */
  static addPluginDirectory(dir: string): void {
    if (!this.pluginDirs.includes(dir)) {
      this.pluginDirs.push(dir);
      this.logger.info(`Added plugin directory: ${dir}`);
    }
  }

  /**
   * Discover and load plugins from registered directories
   */
  static async discoverPlugins(): Promise<void> {
    for (const dir of this.pluginDirs) {
      try {
        await this.loadPluginsFromDirectory(dir);
      } catch (error) {
        this.logger.error(`Failed to load plugins from ${dir}:`, error);
      }
    }
  }

  /**
   * Load plugins from a specific directory
   */
  private static async loadPluginsFromDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(dir, entry.name);
          await this.loadPlugin(pluginPath);
        }
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
      // Directory doesn't exist, skip silently
    }
  }

  /**
   * Load a single plugin from a directory
   */
  private static async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Look for plugin manifest
      const manifestPath = path.join(pluginPath, "platform.json");
      const manifestData = await fs.readFile(manifestPath, "utf-8");
      const manifest: PluginManifest = JSON.parse(manifestData);

      // Validate manifest
      if (!manifest.name || !manifest.platform || !manifest.main) {
        throw new Error("Invalid plugin manifest: missing required fields");
      }

      // Load the platform module
      const modulePath = path.join(pluginPath, manifest.main);
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const resolvedPath = path.resolve(__dirname, modulePath);

      // Convert to file URL for dynamic import
      const fileUrl = `file://${resolvedPath}`;
      const module = await import(fileUrl);

      // Get the platform constructor (default export or named export)
      const PlatformClass = module.default || module[manifest.name];

      if (!PlatformClass) {
        throw new Error(`Platform class not found in module: ${manifest.name}`);
      }

      // Register the platform with type assertion
      // PlatformClass is dynamically loaded, so we assert it matches our constructor type
      const metadata: {
        version?: string;
        description?: string;
        author?: string;
        homepage?: string;
        dependencies?: string[];
      } = {
        version: manifest.version,
      };

      if (manifest.description) metadata.description = manifest.description;
      if (manifest.author) metadata.author = manifest.author;
      if (manifest.homepage) metadata.homepage = manifest.homepage;
      if (manifest.dependencies) metadata.dependencies = manifest.dependencies;

      this.register(
        manifest.platform,
        PlatformClass as PlatformConstructor,
        metadata,
      );

      this.logger.info(`Loaded plugin: ${manifest.name} v${manifest.version}`);
    } catch (error) {
      this.logger.error(`Failed to load plugin from ${pluginPath}:`, error);
    }
  }

  /**
   * Validate platform dependencies
   */
  static validateDependencies(platform: Platform): boolean {
    const metadata = this.getMetadata(platform);
    if (!metadata?.dependencies) {
      return true;
    }

    for (const dep of metadata.dependencies) {
      if (!this.has(dep as Platform)) {
        this.logger.warn(`Platform ${platform} has unmet dependency: ${dep}`);
        return false;
      }
    }

    return true;
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

  /**
   * Export registry state for debugging/persistence
   */
  static export(): Record<string, PlatformMetadata> {
    const result: Record<string, PlatformMetadata> = {};

    for (const [platform, metadata] of this.platforms.entries()) {
      // Exclude constructor from export as it can't be serialized
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { constructor: _, ...serializableMetadata } = metadata;
      result[platform] = {
        ...serializableMetadata,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        constructor: undefined as any, // Will need to be re-registered
      };
    }

    return result;
  }

  /**
   * Get platform statistics
   */
  static getStats(): {
    total: number;
    byCapability: Record<string, number>;
    versions: Record<string, string>;
  } {
    if (!this.initialized) {
      this.initializeDefaults();
    }

    const stats = {
      total: this.platforms.size,
      byCapability: {} as Record<string, number>,
      versions: {} as Record<string, string>,
    };

    for (const [platform, metadata] of this.platforms.entries()) {
      // Count capabilities
      for (const [cap, enabled] of Object.entries(metadata.capabilities)) {
        if (enabled) {
          stats.byCapability[cap] = (stats.byCapability[cap] || 0) + 1;
        }
      }

      // Track versions
      stats.versions[platform] = metadata.version;
    }

    return stats;
  }
}
