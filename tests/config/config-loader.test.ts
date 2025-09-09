import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { ConfigLoader } from "../../src/config/config-loader.js";
import { defaultConfig } from "../../src/config/default-config.js";

// Mock modules
vi.mock("fs");
vi.mock("../../src/utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("ConfigLoader", () => {
  let loader: ConfigLoader;
  const originalEnv = process.env;

  beforeEach(() => {
    loader = new ConfigLoader();
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("loadConfig", () => {
    it("should load default configuration when no overrides exist", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config = await loader.loadConfig();
      
      expect(config.database.path).toBe("./fscrape.db");
      expect(config.scraping.session.defaultBatchSize).toBe(25);
      expect(config.logging.level).toBe("info");
    });

    it("should load configuration from environment variables", async () => {
      process.env.FSCRAPER_DATABASE_PATH = "/custom/path.db";
      process.env.FSCRAPER_LOG_LEVEL = "debug";
      process.env.FSCRAPER_DEBUG = "true";
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config = await loader.loadConfig();
      
      expect(config.database.path).toBe("/custom/path.db");
      expect(config.logging.level).toBe("debug");
      expect(config.development.debug).toBe(true);
    });

    it("should load Reddit API credentials from environment", async () => {
      process.env.REDDIT_CLIENT_ID = "test-client-id";
      process.env.REDDIT_CLIENT_SECRET = "test-client-secret";
      process.env.REDDIT_REFRESH_TOKEN = "test-refresh-token";
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config = await loader.loadConfig();
      
      expect(config.api.reddit.clientId).toBe("test-client-id");
      expect(config.api.reddit.clientSecret).toBe("test-client-secret");
      expect(config.api.reddit.refreshToken).toBe("test-refresh-token");
    });

    it("should apply CLI overrides with highest precedence", async () => {
      process.env.FSCRAPER_DATABASE_PATH = "/env/path.db";
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const cliOverrides = {
        database: { path: "/cli/path.db" },
        logging: { level: "error" as const },
      };
      
      const config = await loader.loadConfig(cliOverrides);
      
      expect(config.database.path).toBe("/cli/path.db");
      expect(config.logging.level).toBe("error");
    });

    it("should cache configuration after first load", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config1 = await loader.loadConfig();
      const config2 = await loader.loadConfig();
      
      expect(config1).toBe(config2); // Same reference
    });
  });

  describe("loadLocalConfig", () => {
    it("should find config file in current directory", async () => {
      const mockConfig = {
        database: { path: "/local/path.db" },
      };
      
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === path.join(process.cwd(), ".fscraperrc");
      });
      
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(mockConfig)
      );
      
      const config = await loader.loadConfig();
      
      expect(config.database.path).toBe("/local/path.db");
    });

    it("should walk up directory tree to find config", async () => {
      const mockConfig = {
        cli: { defaultLimit: 500 },
      };
      
      let callCount = 0;
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        callCount++;
        // Return true for parent directory config
        return callCount === 4 && p.endsWith(".fscraperrc");
      });
      
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(mockConfig)
      );
      
      const config = await loader.loadConfig();
      
      expect(config.cli.defaultLimit).toBe(500);
    });
  });

  describe("createCliOverrides", () => {
    it("should create overrides from CLI options", () => {
      const options = {
        database: "/custom/db.sqlite",
        logLevel: "debug",
        verbose: true,
        limit: 200,
        batchSize: 50,
        debug: true,
        dryRun: true,
        format: "csv",
        output: "/exports/data",
      };
      
      const overrides = loader.createCliOverrides(options);
      
      expect(overrides.database?.path).toBe("/custom/db.sqlite");
      expect(overrides.logging?.level).toBe("debug");
      expect(overrides.development?.verbose).toBe(true);
      expect(overrides.development?.debug).toBe(true);
      expect(overrides.development?.dryRun).toBe(true);
      expect(overrides.cli?.defaultLimit).toBe(200);
      expect(overrides.scraping?.session?.defaultBatchSize).toBe(50);
      expect(overrides.export?.defaultFormat).toBe("csv");
      expect(overrides.export?.outputDir).toBe("/exports/data");
    });

    it("should handle partial CLI options", () => {
      const options = {
        verbose: true,
      };
      
      const overrides = loader.createCliOverrides(options);
      
      expect(overrides.development?.verbose).toBe(true);
      expect(overrides.logging?.level).toBe("debug");
      expect(overrides.database).toBeUndefined();
    });
  });

  describe("saveConfig", () => {
    it("should save configuration to specified file", async () => {
      const config = {
        database: { path: "/test/path.db" },
      };
      
      const writeSpy = vi.mocked(fs.promises.writeFile);
      
      await loader.saveConfig(config, "/path/to/config.json");
      
      expect(writeSpy).toHaveBeenCalledWith(
        "/path/to/config.json",
        JSON.stringify(config, null, 2),
        "utf-8"
      );
    });

    it("should save to current directory if no path specified", async () => {
      const config = {
        logging: { level: "debug" as const },
      };
      
      const writeSpy = vi.mocked(fs.promises.writeFile);
      
      await loader.saveConfig(config);
      
      expect(writeSpy).toHaveBeenCalledWith(
        path.join(process.cwd(), ".fscraperrc"),
        JSON.stringify(config, null, 2),
        "utf-8"
      );
    });
  });

  describe("displayConfig", () => {
    it("should mask sensitive values", () => {
      const config = {
        ...defaultConfig,
        api: {
          ...defaultConfig.api,
          reddit: {
            ...defaultConfig.api.reddit,
            clientId: "abcdef123456",
            clientSecret: "supersecret",
            refreshToken: "refreshtoken123",
          },
        },
      };
      
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      
      loader.displayConfig(config);
      
      const output = consoleSpy.mock.calls[0][0];
      const parsed = JSON.parse(output);
      
      expect(parsed.api.reddit.clientId).toMatch(/^ab\*+56$/);
      expect(parsed.api.reddit.clientSecret).toBe("***");
      expect(parsed.api.reddit.refreshToken).toBe("***");
      
      consoleSpy.mockRestore();
    });
  });

  describe("resetCache", () => {
    it("should clear cached configuration", async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      
      const config1 = await loader.loadConfig();
      loader.resetCache();
      
      // Modify environment to ensure cache was cleared
      process.env.FSCRAPER_LOG_LEVEL = "error";
      
      const config2 = await loader.loadConfig();
      
      expect(config1).not.toBe(config2);
      expect(config2.logging.level).toBe("error");
    });
  });

  describe("config file discovery", () => {
    it("should check multiple config file names", async () => {
      const existsSpy = vi.mocked(fs.existsSync);
      existsSpy.mockReturnValue(false);
      
      await loader.loadConfig();
      
      // Should check for all config file names
      expect(existsSpy).toHaveBeenCalledWith(
        expect.stringContaining(".fscraperrc")
      );
      expect(existsSpy).toHaveBeenCalledWith(
        expect.stringContaining(".fscraperrc.json")
      );
      expect(existsSpy).toHaveBeenCalledWith(
        expect.stringContaining("fscraper.config.json")
      );
    });

    it("should load global config from home directory", async () => {
      const homeDir = os.homedir();
      const mockConfig = {
        cache: { ttlSeconds: 600 },
      };
      
      vi.mocked(fs.existsSync).mockImplementation((p) => {
        return p === path.join(homeDir, ".fscraperrc");
      });
      
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify(mockConfig)
      );
      
      const config = await loader.loadConfig();
      
      expect(config.cache.ttlSeconds).toBe(600);
    });
  });
});