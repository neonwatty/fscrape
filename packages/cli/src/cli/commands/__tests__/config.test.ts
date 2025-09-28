/**
 * Tests for config command
 * Validates configuration management functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';
import { Command } from 'commander';
import { createConfigCommand } from '../config.js';
import type { ConfigData } from '../config.js';

// Mock modules
vi.mock('fs', () => ({
  promises: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
  },
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('chalk', () => ({
  default: {
    cyan: (str: string) => str,
    green: (str: string) => str,
    yellow: (str: string) => str,
    red: (str: string) => str,
    gray: (str: string) => str,
    blue: (str: string) => str,
  },
}));

// Mock console methods to capture output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

// Mock process.exit to prevent test runner from exiting
const mockProcessExit = vi
  .spyOn(process, 'exit')
  .mockImplementation((code?: string | number | null | undefined) => {
    throw new Error(`process.exit called with code ${code}`);
  });

describe('Config Command', () => {
  let program: Command;
  let configCommand: Command;
  const mockFs = vi.mocked(fs);
  const testConfigPath = path.join(process.cwd(), 'fscrape.config.json');
  const globalConfigPath = path.join(os.homedir(), '.fscrape', 'config.json');

  const defaultConfig: ConfigData = {
    defaultDatabase: 'fscrape.db',
    defaultPlatform: 'reddit',
    outputFormat: 'table',
    verbose: false,
    maxConcurrency: 5,
    retryAttempts: 3,
    cacheEnabled: true,
    cacheTTL: 3600,
    rateLimit: {
      reddit: 60,
      hackernews: 30,
    },
    export: {
      defaultPath: './exports',
      defaultFormat: 'json',
    },
    batch: {
      maxSize: 100,
      timeout: 30000,
    },
  };

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    mockConsoleLog.mockClear();
    mockConsoleError.mockClear();
    mockProcessExit.mockClear();

    // Create fresh command instances
    program = new Command();
    program.exitOverride();
    configCommand = createConfigCommand();
    program.addCommand(configCommand);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Command Structure', () => {
    it('should have config command with correct structure', () => {
      expect(configCommand.name()).toBe('config');
      expect(configCommand.description()).toContain('configuration');
    });

    it('should have all required options', () => {
      const options = configCommand.options.map((opt) => opt.long);
      expect(options).toContain('--config');
      expect(options).toContain('--global');
      expect(options).toContain('--reset');
      expect(options).toContain('--interactive');
      expect(options).toContain('--list');
      expect(options).toContain('--get');
      expect(options).toContain('--set');
    });
  });

  describe('Default Configuration', () => {
    it("should create default config when file doesn't exist", async () => {
      const error = new Error('ENOENT: no such file or directory') as Error & { code: string };
      error.code = 'ENOENT';
      mockFs.readFile.mockRejectedValueOnce(error);

      await program.parseAsync(['node', 'test', 'config', '--list']);

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join('\n');
      expect(output).toContain('Current Configuration');
      expect(output).toContain('fscrape.db');
      expect(output).toContain('reddit');
    });
  });

  describe('Load Configuration', () => {
    it('should load existing configuration from file', async () => {
      const customConfig = {
        ...defaultConfig,
        defaultDatabase: 'custom.db',
        verbose: true,
      };

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(customConfig));

      try {
        await program.parseAsync(['node', 'test', 'config', '--list']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockFs.readFile).toHaveBeenCalledWith(testConfigPath, 'utf-8');
      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join('\n');
      expect(output).toContain('custom.db');
      expect(output).toContain('true'); // verbose: true
    });

    it('should use global config path when --global flag is set', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));

      try {
        await program.parseAsync(['node', 'test', 'config', '--global', '--list']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockFs.readFile).toHaveBeenCalledWith(globalConfigPath, 'utf-8');
    });

    it('should use custom config path when specified', async () => {
      const customPath = '/custom/path/config.json';
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));

      try {
        await program.parseAsync(['node', 'test', 'config', '--config', customPath, '--list']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockFs.readFile).toHaveBeenCalledWith(customPath, 'utf-8');
    });
  });

  describe('Reset Configuration', () => {
    it('should reset configuration to defaults', async () => {
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      try {
        await program.parseAsync(['node', 'test', 'config', '--reset']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockFs.writeFile).toHaveBeenCalled();
      const [filePath, content] = mockFs.writeFile.mock.calls[0];
      expect(filePath).toBe(testConfigPath);

      const savedConfig = JSON.parse(content as string);
      expect(savedConfig.defaultDatabase).toBe('fscrape.db');
      expect(savedConfig.defaultPlatform).toBe('reddit');
      expect(savedConfig.verbose).toBe(false);

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join('\n');
      expect(output).toContain('Configuration reset to defaults');
    });
  });

  describe('Get Configuration Value', () => {
    it('should get a specific configuration value', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));

      try {
        await program.parseAsync(['node', 'test', 'config', '--get', 'defaultDatabase']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalledWith('fscrape.db');
    });

    it('should get nested configuration value', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));

      try {
        await program.parseAsync(['node', 'test', 'config', '--get', 'rateLimit.reddit']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalledWith(60);
    });

    it('should handle non-existent key', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));

      try {
        await program.parseAsync(['node', 'test', 'config', '--get', 'nonexistent']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join('\n');
      expect(output).toContain('Configuration key not found');
    });

    it('should output object values as JSON', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));

      try {
        await program.parseAsync(['node', 'test', 'config', '--get', 'rateLimit']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls[0][0];
      const parsed = JSON.parse(output);
      expect(parsed.reddit).toBe(60);
      expect(parsed.hackernews).toBe(30);
    });
  });

  describe('Set Configuration Value', () => {
    it('should set a configuration value', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      try {
        await program.parseAsync(['node', 'test', 'config', '--set', 'verbose=true']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockFs.writeFile).toHaveBeenCalled();
      const [, content] = mockFs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content as string);
      expect(savedConfig.verbose).toBe(true);

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join('\n');
      expect(output).toContain('Set verbose = true');
    });

    it('should set nested configuration value', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      try {
        await program.parseAsync(['node', 'test', 'config', '--set', 'rateLimit.reddit=120']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockFs.writeFile).toHaveBeenCalled();
      const [, content] = mockFs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content as string);
      expect(savedConfig.rateLimit.reddit).toBe(120);
    });

    it('should set multiple values', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      try {
        await program.parseAsync([
          'node',
          'test',
          'config',
          '--set',
          'verbose=true',
          'maxConcurrency=10',
          'defaultDatabase=new.db',
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockFs.writeFile).toHaveBeenCalled();
      const [, content] = mockFs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content as string);
      expect(savedConfig.verbose).toBe(true);
      expect(savedConfig.maxConcurrency).toBe(10);
      expect(savedConfig.defaultDatabase).toBe('new.db');
    });

    it('should handle invalid set format', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));

      try {
        await program.parseAsync(['node', 'test', 'config', '--set', 'invalid']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join('\n');
      expect(output).toContain('Invalid format');
      expect(output).toContain('Use format: key=value');
    });

    it('should parse boolean values correctly', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      try {
        await program.parseAsync(['node', 'test', 'config', '--set', 'verbose=false']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      const [, content] = mockFs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content as string);
      expect(savedConfig.verbose).toBe(false);
      expect(typeof savedConfig.verbose).toBe('boolean');
    });

    it('should parse number values correctly', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      try {
        await program.parseAsync(['node', 'test', 'config', '--set', 'maxConcurrency=15']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      const [, content] = mockFs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content as string);
      expect(savedConfig.maxConcurrency).toBe(15);
      expect(typeof savedConfig.maxConcurrency).toBe('number');
    });

    it('should keep string values as strings', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      try {
        await program.parseAsync([
          'node',
          'test',
          'config',
          '--set',
          'defaultDatabase=my-database.db',
        ]);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      const [, content] = mockFs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content as string);
      expect(savedConfig.defaultDatabase).toBe('my-database.db');
      expect(typeof savedConfig.defaultDatabase).toBe('string');
    });
  });

  describe('Interactive Configuration', () => {
    it('should prompt for configuration values', async () => {
      const inquirer = await import('inquirer');
      const mockPrompt = vi.mocked(inquirer.default.prompt);

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      mockPrompt.mockResolvedValueOnce({
        defaultDatabase: 'interactive.db',
        defaultPlatform: 'hackernews',
        outputFormat: 'json',
        verbose: true,
        maxConcurrency: 10,
        cacheEnabled: false,
        configureBatch: false,
      });

      try {
        await program.parseAsync(['node', 'test', 'config', '--interactive']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockPrompt).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();

      const [, content] = mockFs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content as string);
      expect(savedConfig.defaultDatabase).toBe('interactive.db');
      expect(savedConfig.defaultPlatform).toBe('hackernews');
      expect(savedConfig.outputFormat).toBe('json');
      expect(savedConfig.verbose).toBe(true);
      expect(savedConfig.maxConcurrency).toBe(10);
      expect(savedConfig.cacheEnabled).toBe(false);

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join('\n');
      expect(output).toContain('Interactive Configuration Setup');
      expect(output).toContain('Configuration saved');
    });

    it('should handle batch configuration in interactive mode', async () => {
      const inquirer = await import('inquirer');
      const mockPrompt = vi.mocked(inquirer.default.prompt);

      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      mockPrompt.mockResolvedValueOnce({
        defaultDatabase: 'fscrape.db',
        defaultPlatform: 'reddit',
        outputFormat: 'table',
        verbose: false,
        maxConcurrency: 5,
        cacheEnabled: true,
        cacheTTL: 7200,
        configureBatch: true,
        batchMaxSize: 200,
        batchTimeout: 60000,
      });

      try {
        await program.parseAsync(['node', 'test', 'config', '--interactive']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      const [, content] = mockFs.writeFile.mock.calls[0];
      const savedConfig = JSON.parse(content as string);
      expect(savedConfig.batch.maxSize).toBe(200);
      expect(savedConfig.batch.timeout).toBe(60000);
      expect(savedConfig.cacheTTL).toBe(7200);
    });
  });

  describe('List Configuration', () => {
    it('should display all configuration values', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));

      try {
        await program.parseAsync(['node', 'test', 'config', '--list']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join('\n');
      expect(output).toContain('Current Configuration');
      expect(output).toContain('defaultDatabase');
      expect(output).toContain('defaultPlatform');
      expect(output).toContain('outputFormat');
      expect(output).toContain('verbose');
      expect(output).toContain('rateLimit');
      expect(output).toContain('reddit');
      expect(output).toContain('hackernews');
    });

    it('should show help text when no specific option is provided', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));

      try {
        await program.parseAsync(['node', 'test', 'config']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleLog).toHaveBeenCalled();
      const output = mockConsoleLog.mock.calls.join('\n');
      expect(output).toContain('Current Configuration');
      expect(output).toContain('Use --interactive for guided setup');
      expect(output).toContain('Use --get <key> to get a specific value');
      expect(output).toContain('Use --set key=value to set values');
      expect(output).toContain('Use --reset to restore defaults');
    });
  });

  describe('Error Handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockFs.readFile.mockRejectedValueOnce(new Error('Permission denied'));

      try {
        await program.parseAsync(['node', 'test', 'config', '--list']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleError).toHaveBeenCalled();
      const errorOutput = mockConsoleError.mock.calls.join('\n');
      expect(errorOutput).toContain('Config failed');
      expect(errorOutput).toContain('Permission denied');
    });

    it('should handle file write errors gracefully', async () => {
      mockFs.readFile.mockResolvedValueOnce(JSON.stringify(defaultConfig));
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockRejectedValueOnce(new Error('Disk full'));

      try {
        await program.parseAsync(['node', 'test', 'config', '--set', 'verbose=true']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleError).toHaveBeenCalled();
      const errorOutput = mockConsoleError.mock.calls.join('\n');
      expect(errorOutput).toContain('Config failed');
      expect(errorOutput).toContain('Disk full');
    });

    it('should handle invalid JSON in config file', async () => {
      mockFs.readFile.mockResolvedValueOnce('{ invalid json');

      try {
        await program.parseAsync(['node', 'test', 'config', '--list']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockConsoleError).toHaveBeenCalled();
      const errorOutput = mockConsoleError.mock.calls.join('\n');
      expect(errorOutput).toContain('Config failed');
    });
  });

  describe('Directory Creation', () => {
    it("should create directory for global config if it doesn't exist", async () => {
      mockFs.readFile.mockRejectedValueOnce({ code: 'ENOENT' });
      mockFs.mkdir.mockResolvedValueOnce(undefined);
      mockFs.writeFile.mockResolvedValueOnce(undefined);

      try {
        await program.parseAsync(['node', 'test', 'config', '--global', '--reset']);
      } catch (_error) {
        // Expected to throw due to mocked process.exit
      }

      expect(mockFs.mkdir).toHaveBeenCalledWith(path.dirname(globalConfigPath), {
        recursive: true,
      });
    });
  });
});
