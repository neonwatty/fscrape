import { describe, it, expect } from "vitest";
import {
  ConfigSchema,
  PartialConfigSchema,
  validateConfig,
  validatePartialConfig,
  safeValidateConfig,
  mergeConfigs,
} from "../../src/config/config-validator.js";
import { defaultConfig } from "../../src/config/default-config.js";

describe("ConfigValidator", () => {
  describe("ConfigSchema", () => {
    it("should validate a complete valid configuration", () => {
      const result = ConfigSchema.safeParse(defaultConfig);
      expect(result.success).toBe(true);
    });

    it("should reject invalid database configuration", () => {
      const invalidConfig = {
        ...defaultConfig,
        database: {
          ...defaultConfig.database,
          synchronous: "INVALID" as any,
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it("should reject negative rate limits", () => {
      const invalidConfig = {
        ...defaultConfig,
        scraping: {
          ...defaultConfig.scraping,
          rateLimit: {
            reddit: {
              requestsPerMinute: -1,
              requestsPerHour: 1000,
              backoffMultiplier: 2,
              maxBackoffMs: 60000,
            },
            hackernews: defaultConfig.scraping.rateLimit.hackernews,
          },
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });

    it("should validate logging levels", () => {
      const validLevels = ["debug", "info", "warn", "error"];
      
      for (const level of validLevels) {
        const config = {
          ...defaultConfig,
          logging: {
            ...defaultConfig.logging,
            level: level as any,
          },
        };
        
        const result = ConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid export formats", () => {
      const invalidConfig = {
        ...defaultConfig,
        export: {
          ...defaultConfig.export,
          defaultFormat: "xml" as any,
        },
      };

      const result = ConfigSchema.safeParse(invalidConfig);
      expect(result.success).toBe(false);
    });
  });

  describe("PartialConfigSchema", () => {
    it("should validate empty partial config", () => {
      const result = PartialConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it("should validate partial database config", () => {
      const partialConfig = {
        database: {
          path: "/custom/path.db",
        },
      };

      const result = PartialConfigSchema.safeParse(partialConfig);
      expect(result.success).toBe(true);
    });

    it("should validate nested partial configs", () => {
      const partialConfig = {
        scraping: {
          rateLimit: {
            reddit: {
              requestsPerMinute: 30,
            },
          },
        },
      };

      const result = PartialConfigSchema.safeParse(partialConfig);
      expect(result.success).toBe(true);
    });

    it("should reject invalid partial values", () => {
      const partialConfig = {
        cli: {
          defaultLimit: -100,
        },
      };

      const result = PartialConfigSchema.safeParse(partialConfig);
      expect(result.success).toBe(false);
    });
  });

  describe("validateConfig", () => {
    it("should return valid configuration", () => {
      const config = validateConfig(defaultConfig);
      expect(config).toEqual(defaultConfig);
    });

    it("should throw on invalid configuration", () => {
      const invalidConfig = {
        ...defaultConfig,
        cache: {
          ...defaultConfig.cache,
          strategy: "random" as any,
        },
      };

      expect(() => validateConfig(invalidConfig)).toThrow();
    });
  });

  describe("validatePartialConfig", () => {
    it("should return valid partial configuration", () => {
      const partialConfig = {
        development: {
          debug: true,
          verbose: true,
        },
      };

      const result = validatePartialConfig(partialConfig);
      expect(result).toEqual(partialConfig);
    });

    it("should throw on invalid partial configuration", () => {
      const invalidPartial = {
        logging: {
          maxFiles: 1000, // exceeds max of 100
        },
      };

      expect(() => validatePartialConfig(invalidPartial)).toThrow();
    });
  });

  describe("safeValidateConfig", () => {
    it("should return success for valid config", () => {
      const result = safeValidateConfig(defaultConfig);
      
      expect(result.success).toBe(true);
      expect(result.data).toEqual(defaultConfig);
      expect(result.error).toBeUndefined();
    });

    it("should return error for invalid config", () => {
      const invalidConfig = {
        ...defaultConfig,
        cli: {
          ...defaultConfig.cli,
          defaultPlatform: "invalid" as any,
        },
      };

      const result = safeValidateConfig(invalidConfig);
      
      expect(result.success).toBe(false);
      expect(result.data).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });

  describe("mergeConfigs", () => {
    it("should merge multiple partial configs", () => {
      const config1 = {
        database: { path: "/path1.db" },
        logging: { level: "debug" as const },
      };

      const config2 = {
        database: { path: "/path2.db" },
        cache: { ttlSeconds: 600 },
      };

      const config3 = {
        cli: { defaultLimit: 500 },
      };

      const merged = mergeConfigs(config1, config2, config3);
      
      expect(merged.database.path).toBe("/path2.db"); // config2 overrides config1
      expect(merged.logging.level).toBe("debug"); // from config1
      expect(merged.cache.ttlSeconds).toBe(600); // from config2
      expect(merged.cli.defaultLimit).toBe(500); // from config3
    });

    it("should handle deep merging", () => {
      const config1 = {
        scraping: {
          rateLimit: {
            reddit: {
              requestsPerMinute: 30,
            },
          },
        },
      };

      const config2 = {
        scraping: {
          rateLimit: {
            reddit: {
              requestsPerHour: 500,
            },
          },
        },
      };

      const merged = mergeConfigs(config1, config2);
      
      expect(merged.scraping.rateLimit.reddit.requestsPerMinute).toBe(30);
      expect(merged.scraping.rateLimit.reddit.requestsPerHour).toBe(500);
    });

    it("should apply defaults for missing values", () => {
      const partialConfig = {
        database: { path: "/custom.db" },
      };

      const merged = mergeConfigs(partialConfig);
      
      expect(merged.database.path).toBe("/custom.db");
      expect(merged.database.enableWAL).toBe(true); // default value
      expect(merged.logging.level).toBe("info"); // default value
    });

    it("should handle null and undefined values correctly", () => {
      const config1 = {
        scraping: {
          filters: {
            maxAgeDays: 30,
          },
        },
      };

      const config2 = {
        scraping: {
          filters: {
            maxAgeDays: null,
          },
        },
      };

      const merged = mergeConfigs(config1, config2);
      
      expect(merged.scraping.filters.maxAgeDays).toBeNull();
    });

    it("should preserve arrays without merging", () => {
      const config1 = {
        export: {
          defaultFormat: "json" as const,
        },
      };

      const config2 = {
        export: {
          defaultFormat: "csv" as const,
        },
      };

      const merged = mergeConfigs(config1, config2);
      
      expect(merged.export.defaultFormat).toBe("csv");
    });
  });

  describe("validation edge cases", () => {
    it("should validate file size format", () => {
      const validSizes = ["1KB", "100MB", "2GB"];
      
      for (const size of validSizes) {
        const config = {
          logging: {
            maxFileSize: size,
          },
        };
        
        const result = PartialConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid file size format", () => {
      const invalidSizes = ["100", "MB", "10TB", "abc"];
      
      for (const size of invalidSizes) {
        const config = {
          logging: {
            maxFileSize: size,
          },
        };
        
        const result = PartialConfigSchema.safeParse(config);
        expect(result.success).toBe(false);
      }
    });

    it("should validate URL formats", () => {
      const config = {
        api: {
          hackernews: {
            baseUrl: "https://example.com",
            algoliaUrl: "https://api.example.com",
          },
        },
      };

      const result = PartialConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it("should reject invalid URLs", () => {
      const config = {
        api: {
          hackernews: {
            baseUrl: "not-a-url",
          },
        },
      };

      const result = PartialConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should enforce numeric limits", () => {
      const config = {
        scraping: {
          session: {
            maxRetries: 11, // max is 10
          },
        },
      };

      const result = PartialConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it("should apply default values correctly", () => {
      const minimalConfig = {
        database: { path: "/test.db" },
        scraping: {
          rateLimit: {
            reddit: {
              requestsPerMinute: 60,
              requestsPerHour: 1000,
            },
            hackernews: {
              requestsPerMinute: 30,
              requestsPerHour: 500,
            },
          },
          session: {},
          filters: {},
        },
        api: {
          reddit: { userAgent: "test" },
          hackernews: {
            baseUrl: "https://test.com",
            algoliaUrl: "https://test2.com",
          },
        },
        logging: {},
        cache: {},
        export: {},
        cli: {},
        development: {},
      };

      const validated = validateConfig(minimalConfig);
      
      expect(validated.database.enableWAL).toBe(true);
      expect(validated.scraping.session.defaultBatchSize).toBe(25);
      expect(validated.logging.level).toBe("info");
      expect(validated.cache.strategy).toBe("lru");
    });
  });
});