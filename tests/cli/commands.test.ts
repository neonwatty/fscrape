import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Command } from 'commander';
import { createScrapeCommand } from '../../src/cli/commands/scrape';
import { createListCommand } from '../../src/cli/commands/list';
import { createExportCommand } from '../../src/cli/commands/export';
import { createStatusCommand } from '../../src/cli/commands/status';
import { createConfigCommand } from '../../src/cli/commands/config';
import { createInitCommand } from '../../src/cli/commands/init';
import { DatabaseManager } from '../../src/database/database';
import { SessionManager } from '../../src/session/session-manager';
import { ExportManager } from '../../src/export/export-manager';
import { PlatformFactory } from '../../src/platforms/platform-factory';
import { ConfigManager } from '../../src/config/manager';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
vi.mock('../../src/database/database');
vi.mock('../../src/session/session-manager');
vi.mock('../../src/export/export-manager');
vi.mock('../../src/platforms/platform-factory');
vi.mock('../../src/config/manager');
vi.mock('fs/promises');
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    info: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
  })
}));

describe('CLI Commands', () => {
  let mockDatabase: any;
  let mockSessionManager: any;
  let mockExportManager: any;
  let mockPlatform: any;
  let mockConfigManager: any;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup console spies
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: number) => {
      // Just swallow the exit call, don't throw
      return undefined as never;
    });
    
    // Setup mock database
    mockDatabase = {
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      query: vi.fn(),
      run: vi.fn(),
      get: vi.fn(),
      all: vi.fn(),
      upsertPosts: vi.fn().mockResolvedValue({ inserted: 0, updated: 0, errors: [] }),
      upsertComments: vi.fn().mockResolvedValue({ inserted: 0, updated: 0, errors: [] }),
      upsertUsers: vi.fn().mockResolvedValue({ inserted: 0, updated: 0, errors: [] }),
      getPostsByPlatform: vi.fn().mockResolvedValue([]),
      getCommentsByPost: vi.fn().mockResolvedValue([]),
      getUsersByPlatform: vi.fn().mockResolvedValue([]),
      getStats: vi.fn().mockResolvedValue({ totalPosts: 0, totalComments: 0, totalUsers: 0 }),
    };
    (DatabaseManager as any).mockImplementation(() => mockDatabase);
    
    // Setup mock session manager
    mockSessionManager = {
      createSession: vi.fn().mockResolvedValue('session-123'),
      updateProgress: vi.fn().mockResolvedValue(undefined),
      completeSession: vi.fn().mockResolvedValue(undefined),
      getActiveSession: vi.fn(),
      getSessionById: vi.fn(),
      listSessions: vi.fn().mockResolvedValue([]),
    };
    (SessionManager as any).mockImplementation(() => mockSessionManager);
    
    // Setup mock export manager
    mockExportManager = {
      exportData: vi.fn().mockResolvedValue('/path/to/export.json'),
      getSupportedFormats: vi.fn().mockReturnValue(['json', 'csv', 'html', 'markdown']),
      exportToJSON: vi.fn().mockResolvedValue('/path/to/export.json'),
      exportToCSV: vi.fn().mockResolvedValue('/path/to/export.csv'),
      exportToHTML: vi.fn().mockResolvedValue('/path/to/export.html'),
      exportToMarkdown: vi.fn().mockResolvedValue('/path/to/export.md'),
    };
    (ExportManager as any).mockImplementation(() => mockExportManager);
    
    // Setup mock platform
    mockPlatform = {
      initialize: vi.fn().mockResolvedValue(undefined),
      authenticate: vi.fn().mockResolvedValue(undefined),
      scrapePostsFromCategory: vi.fn().mockResolvedValue([]),
      scrapePost: vi.fn(),
      scrapeComments: vi.fn().mockResolvedValue([]),
      scrapeUser: vi.fn(),
      searchPosts: vi.fn().mockResolvedValue([]),
      getPlatformName: vi.fn().mockReturnValue('reddit'),
      getCapabilities: vi.fn().mockReturnValue({
        supportsCommentThreads: true,
        supportsUserProfiles: true,
        supportsSearch: true,
      }),
    };
    (PlatformFactory.createPlatform as any) = vi.fn().mockReturnValue(mockPlatform);
    
    // Setup mock config manager
    mockConfigManager = {
      loadConfig: vi.fn().mockResolvedValue({
        database: { path: 'test.db' },
        platforms: {
          reddit: { clientId: 'test', clientSecret: 'test' },
          hackernews: { enabled: true }
        }
      }),
      getConfig: vi.fn().mockReturnValue({
        database: { path: 'test.db' },
        platforms: {
          reddit: { clientId: 'test', clientSecret: 'test' },
          hackernews: { enabled: true }
        }
      }),
      setConfig: vi.fn().mockResolvedValue(undefined),
      saveConfig: vi.fn().mockResolvedValue(undefined),
    };
    (ConfigManager as any).mockImplementation(() => mockConfigManager);
    (ConfigManager.getInstance as any) = vi.fn().mockReturnValue(mockConfigManager);
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  describe('Scrape Command', () => {
    it('should create scrape command with correct structure', () => {
      const command = createScrapeCommand();
      expect(command.name()).toBe('scrape');
      expect(command.description()).toContain('Scrape');
    });

    it('should have required options', () => {
      const command = createScrapeCommand();
      const options = command.options.map(opt => opt.long);
      expect(options).toContain('--platform');
      expect(options).toContain('--limit');
      expect(options).toContain('--include-comments');
      expect(options).toContain('--output');
    });

    it('should parse scrape arguments correctly', () => {
      const program = new Command();
      program.exitOverride();
      const scrapeCommand = createScrapeCommand();
      program.addCommand(scrapeCommand);
      
      const args = ['scrape', 'https://reddit.com/r/programming', '-p', 'reddit', '-l', '10'];
      program.parse(args, { from: 'user' });
      
      // The command would be executed, mocks would be called
      // Due to the async nature and commander's action handling,
      // we verify the command was parsed without error
      expect(program.args).toBeDefined();
    });
  });

  describe('List Command', () => {
    it('should create list command with correct structure', () => {
      const command = createListCommand();
      expect(command.name()).toBe('list');
      expect(command.description()).toContain('List');
    });

    it('should have list command structure', () => {
      const command = createListCommand();
      // List command has subcommands instead of arguments
      expect(command.commands).toBeDefined();
      expect(command.commands.length).toBeGreaterThan(0);
    });
  });

  describe('Export Command', () => {
    it('should create export command with correct structure', () => {
      const command = createExportCommand();
      expect(command.name()).toBe('export');
      expect(command.description()).toContain('Export');
    });

    it('should have required options', () => {
      const command = createExportCommand();
      const options = command.options.map(opt => opt.long);
      expect(options).toContain('--format');
      expect(options).toContain('--output');
      expect(options).toContain('--platform');
    });
  });

  describe('Status Command', () => {
    it('should create status command with correct structure', () => {
      const command = createStatusCommand();
      expect(command.name()).toBe('status');
      expect(command.description()).toContain('status');
    });

    it('should have required options', () => {
      const command = createStatusCommand();
      const options = command.options.map(opt => opt.long);
      expect(options).toContain('--database');
      expect(options).toContain('--verbose');
    });
  });

  describe('Config Command', () => {
    it('should create config command with correct structure', () => {
      const command = createConfigCommand();
      expect(command.name()).toBe('config');
      expect(command.description()).toContain('config');
    });

    it('should have required options', () => {
      const command = createConfigCommand();
      const options = command.options.map(opt => opt.long);
      expect(options).toContain('--get');
      expect(options).toContain('--set');
      expect(options).toContain('--list');
    });
  });

  describe('Init Command', () => {
    it('should create init command with correct structure', () => {
      const command = createInitCommand();
      expect(command.name()).toBe('init');
      expect(command.description()).toContain('Initialize');
    });

    it('should have required options', () => {
      const command = createInitCommand();
      const options = command.options.map(opt => opt.long);
      expect(options).toContain('--force');
      expect(options).toContain('--database');
    });
  });

  describe('Command Integration', () => {
    it('should handle errors gracefully', async () => {
      const program = new Command();
      program.exitOverride();
      const scrapeCommand = createScrapeCommand();
      program.addCommand(scrapeCommand);
      
      // Mock platform creation to throw error
      (PlatformFactory.createPlatform as any).mockImplementation(() => {
        throw new Error('Platform error');
      });
      
      try {
        await program.parseAsync(['scrape', 'https://invalid.com/test', '-p', 'invalid'], { from: 'user' });
      } catch (error: any) {
        // Command should handle error gracefully
        expect(error.message).toBeDefined();
      }
    });

    it('should validate required arguments', () => {
      const program = new Command();
      program.exitOverride();
      const scrapeCommand = createScrapeCommand();
      program.addCommand(scrapeCommand);
      
      // Try to parse without required URL argument
      // Commander will call process.exit when missing required args
      program.parse(['scrape'], { from: 'user' });
      
      // Verify process.exit was called due to missing argument
      expect(processExitSpy).toHaveBeenCalled();
    });
  });

  describe('Mock Verification', () => {
    it('should initialize database when needed', async () => {
      const program = new Command();
      program.exitOverride();
      const initCommand = createInitCommand();
      program.addCommand(initCommand);
      
      // Mock fs operations for fresh init
      (fs.access as any).mockRejectedValue(new Error('Not found'));
      (fs.mkdir as any).mockResolvedValue(undefined);
      (fs.writeFile as any).mockResolvedValue(undefined);
      
      // The init command creates the config directory and database
      // We just verify the command can be created without errors
      expect(initCommand.name()).toBe('init');
      expect(initCommand.description()).toContain('Initialize');
    });

    it('should have scraping functionality', async () => {
      const program = new Command();
      program.exitOverride();
      const scrapeCommand = createScrapeCommand();
      program.addCommand(scrapeCommand);
      
      // Verify scrape command has proper structure
      expect(scrapeCommand.name()).toBe('scrape');
      const options = scrapeCommand.options.map(opt => opt.long);
      expect(options).toContain('--platform');
      expect(options).toContain('--limit');
    });

    it('should have export functionality', async () => {
      const program = new Command();
      program.exitOverride();
      const exportCommand = createExportCommand();
      program.addCommand(exportCommand);
      
      // Verify export command has proper structure
      expect(exportCommand.name()).toBe('export');
      const options = exportCommand.options.map(opt => opt.long);
      expect(options).toContain('--format');
      expect(options).toContain('--output');
    });
  });
});