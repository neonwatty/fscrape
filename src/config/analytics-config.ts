export interface AnalyticsConfig {
  // Core analytics settings
  enabled: boolean;

  // Cache settings
  cache: {
    enabled: boolean;
    memoryMaxSize: number; // in MB
    ttl: number; // in seconds
    diskCache: {
      enabled: boolean;
      directory: string;
      maxSize: number; // in MB
    };
  };

  // Performance settings
  performance: {
    maxDataPoints: number;
    samplingRate: number; // 0-1, for large datasets
    timeout: number; // in ms
    parallelProcessing: boolean;
  };

  // Trend analysis settings
  trends: {
    minDataPoints: number;
    confidenceThreshold: number; // 0-1
    seasonalityDetection: boolean;
    changePointSensitivity: "low" | "medium" | "high";
  };

  // Anomaly detection settings
  anomalies: {
    enabled: boolean;
    methods: ("statistical" | "iqr" | "zscore" | "isolation")[];
    sensitivity: number; // 0-1
    minSampleSize: number;
  };

  // Forecasting settings
  forecasting: {
    enabled: boolean;
    methods: ("linear" | "exponential" | "arima" | "moving_average")[];
    horizon: number; // prediction periods
    confidenceIntervals: boolean;
  };

  // Visualization settings
  visualization: {
    enabled: boolean;
    colorOutput: boolean;
    chartTypes: ("line" | "bar" | "sparkline" | "table")[];
    maxWidth: number; // terminal columns
    maxHeight: number; // terminal rows
  };

  // Export settings
  export: {
    formats: ("json" | "csv" | "html" | "markdown")[];
    includeMetadata: boolean;
    includeConfidenceIntervals: boolean;
    timestampFormat: string;
  };
}

export const defaultAnalyticsConfig: AnalyticsConfig = {
  enabled: true,

  cache: {
    enabled: true,
    memoryMaxSize: 100, // 100MB
    ttl: 3600, // 1 hour
    diskCache: {
      enabled: true,
      directory: ".fscrape/analytics-cache",
      maxSize: 500, // 500MB
    },
  },

  performance: {
    maxDataPoints: 1000000,
    samplingRate: 1.0,
    timeout: 30000, // 30 seconds
    parallelProcessing: true,
  },

  trends: {
    minDataPoints: 10,
    confidenceThreshold: 0.95,
    seasonalityDetection: true,
    changePointSensitivity: "medium",
  },

  anomalies: {
    enabled: true,
    methods: ["statistical", "iqr"],
    sensitivity: 0.95,
    minSampleSize: 30,
  },

  forecasting: {
    enabled: true,
    methods: ["linear", "exponential"],
    horizon: 30,
    confidenceIntervals: true,
  },

  visualization: {
    enabled: true,
    colorOutput: true,
    chartTypes: ["sparkline", "table"],
    maxWidth: 120,
    maxHeight: 40,
  },

  export: {
    formats: ["json", "csv"],
    includeMetadata: true,
    includeConfidenceIntervals: true,
    timestampFormat: "ISO",
  },
};

export function validateAnalyticsConfig(
  config: Partial<AnalyticsConfig>,
): AnalyticsConfig {
  const merged = { ...defaultAnalyticsConfig, ...config };

  // Validate numeric ranges
  if (
    merged.performance.samplingRate < 0 ||
    merged.performance.samplingRate > 1
  ) {
    throw new Error("Sampling rate must be between 0 and 1");
  }

  if (
    merged.trends.confidenceThreshold < 0 ||
    merged.trends.confidenceThreshold > 1
  ) {
    throw new Error("Confidence threshold must be between 0 and 1");
  }

  if (merged.anomalies.sensitivity < 0 || merged.anomalies.sensitivity > 1) {
    throw new Error("Anomaly sensitivity must be between 0 and 1");
  }

  if (merged.trends.minDataPoints < 2) {
    throw new Error("Minimum data points must be at least 2");
  }

  if (merged.forecasting.horizon < 1) {
    throw new Error("Forecast horizon must be at least 1");
  }

  return merged;
}
