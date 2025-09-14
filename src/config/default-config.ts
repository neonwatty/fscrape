import { Platform } from "../types/platforms.js";

/**
 * Default configuration for the fscrape application
 */
export const defaultConfig = {
  // Database configuration
  database: {
    path: "./fscrape.db",
    enableWAL: true,
    busyTimeout: 5000,
    cacheSize: 10000,
    synchronous: "NORMAL" as "OFF" | "NORMAL" | "FULL" | "EXTRA",
  },

  // Scraping configuration
  scraping: {
    // Rate limiting per platform
    rateLimit: {
      reddit: {
        requestsPerMinute: 60,
        requestsPerHour: 1000,
        backoffMultiplier: 2,
        maxBackoffMs: 60000,
      },
      hackernews: {
        requestsPerMinute: 30,
        requestsPerHour: 500,
        backoffMultiplier: 1.5,
        maxBackoffMs: 30000,
      },
    },

    // Session configuration
    session: {
      defaultBatchSize: 25,
      maxBatchSize: 100,
      timeoutMs: 30000,
      maxRetries: 3,
      resumeOnError: true,
    },

    // Content filtering
    filters: {
      minScore: 0,
      minComments: 0,
      maxAgeDays: null,
      excludeDeleted: true,
      excludeRemoved: true,
    },
  },

  // API configuration
  api: {
    reddit: {
      userAgent: "fscrape/1.0.0",
      clientId: process.env.REDDIT_CLIENT_ID || "",
      clientSecret: process.env.REDDIT_CLIENT_SECRET || "",
      refreshToken: process.env.REDDIT_REFRESH_TOKEN || "",
    },
    hackernews: {
      baseUrl: "https://hacker-news.firebaseio.com/v0",
      algoliaUrl: "https://hn.algolia.com/api/v1",
    },
  },

  // Logging configuration
  logging: {
    level: "info" as "debug" | "info" | "warn" | "error",
    format: "pretty" as "json" | "pretty",
    destination: "console" as "console" | "file" | "both",
    filePath: "./logs/fscrape.log",
    maxFileSize: "10MB",
    maxFiles: 5,
  },

  // Cache configuration
  cache: {
    enabled: true,
    ttlSeconds: 300,
    maxSize: 1000,
    strategy: "lru" as "lru" | "fifo",
  },

  // Export configuration
  export: {
    defaultFormat: "json" as "json" | "csv" | "markdown",
    prettify: true,
    includeMetadata: false,
    outputDir: "./exports",
  },

  // CLI configuration
  cli: {
    defaultPlatform: "reddit" as Platform,
    defaultLimit: 100,
    interactive: true,
    showProgress: true,
    confirmDestructive: true,
  },

  // Development configuration
  development: {
    debug: false,
    verbose: false,
    dryRun: false,
    mockApi: false,
  },

  // Analytics configuration
  analytics: {
    enabled: true,

    // Cache configuration for analytics computations
    cache: {
      enabled: true,
      defaultTTL: 300000,         // 5 minutes in milliseconds
      maxSize: 52428800,          // 50MB in bytes
      maxEntries: 1000,           // Maximum number of cache entries
      cleanupInterval: 60000,     // 1 minute cleanup interval
      compressionThreshold: 1024, // Compress entries larger than 1KB
      strategy: "lru" as "lru" | "fifo" | "lfu",
      backgroundRefresh: false,   // Enable background cache refresh
      ttlVariation: 0.1,          // Add 10% variation to TTL to prevent cache stampede
    },

    // Computation settings for analytics operations
    computation: {
      maxDataPoints: 100000,      // Maximum data points for analysis
      samplingThreshold: 10000,   // Sample data when exceeding this threshold
      parallelProcessing: true,   // Enable parallel processing for large datasets
      workerThreads: 4,           // Number of worker threads for parallel processing
      timeoutMs: 30000,           // Computation timeout in milliseconds
      precision: 4,               // Decimal precision for calculations
      optimizationLevel: 2,       // 0: none, 1: basic, 2: aggressive
    },

    // Visualization preferences
    visualization: {
      defaultChartType: "line" as "line" | "bar" | "pie" | "scatter" | "heatmap",
      maxSeriesPoints: 1000,      // Maximum points per series in charts
      enableInteractive: true,    // Enable interactive chart features
      colorScheme: "default" as "default" | "dark" | "colorblind" | "monochrome",
      exportFormats: ["png", "svg", "json"] as Array<"png" | "svg" | "json" | "csv">,
      animationDuration: 750,     // Chart animation duration in ms
      responsiveResize: true,     // Auto-resize charts on window resize
    },

    // Performance tuning settings
    performance: {
      enableProfiling: false,     // Enable performance profiling
      metricsInterval: 5000,      // Metrics collection interval in ms
      slowQueryThreshold: 1000,   // Log queries slower than this (ms)
      enableOptimizations: true,  // Enable query and computation optimizations
      memoryLimit: 512,          // Memory limit in MB for analytics operations
      gcInterval: 300000,        // Garbage collection interval (5 minutes)
    },

    // Statistical analysis settings
    statistics: {
      confidenceLevel: 0.95,      // Default confidence level for intervals
      significanceLevel: 0.05,   // Default significance level for tests
      bootstrapSamples: 1000,     // Number of bootstrap samples
      outlierMethod: "iqr" as "iqr" | "zscore" | "isolation",
      outlierThreshold: 1.5,      // IQR multiplier or z-score threshold
    },

    // Trend analysis settings
    trends: {
      minDataPoints: 10,          // Minimum points for trend analysis
      smoothingWindow: 7,         // Moving average window size
      seasonalityDetection: true, // Auto-detect seasonal patterns
      trendStrengthThreshold: 0.7, // R² threshold for significant trend
    },

    // Anomaly detection settings
    anomalies: {
      enabled: true,
      method: "isolation" as "isolation" | "zscore" | "mad" | "ensemble",
      sensitivity: 0.5,           // 0-1, higher = more sensitive
      minSamples: 30,            // Minimum samples for detection
      lookbackWindow: 100,       // Points to consider for baseline
    },

    // Forecasting settings
    forecasting: {
      defaultMethod: "auto" as "auto" | "arima" | "exponential" | "linear",
      horizonDays: 7,            // Default forecast horizon
      confidenceIntervals: [0.80, 0.95], // Confidence intervals to calculate
      maxModelComplexity: 3,     // Maximum model complexity (1-5)
    },
  },
};

export type Config = typeof defaultConfig;
