/**
 * Init command - Initialize a new fscrape project with configuration and database
 */

import { Command } from 'commander';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, resolve, dirname } from 'path';
import {
  validateInitOptions,
  formatSuccess,
  formatError,
  formatWarning,
  formatInfo,
  VALID_PLATFORMS,
} from '../validation.js';
import type { InitOptions } from '../validation.js';
import type { ScraperConfig } from '../../types/config.js';
import type { Platform } from '../../types/core.js';
import { DatabaseManager } from '../../database/database.js';
import { MigrationManager } from '../../database/migrations.js';
import { getErrorMessage } from '../../types/errors.js';
import { validatePartialConfig } from '../../config/config-validator.js';
import Database from 'better-sqlite3';
import chalk from 'chalk';
import * as inquirer from 'inquirer';
import ora from 'ora';

/**
 * Create the init command
 */
export function createInitCommand(): Command {
  const command = new Command('init')
    .description('Initialize a new fscrape project with configuration and database')
    .argument('[directory]', 'Project directory', process.cwd())
    .option('-n, --name <name>', 'Project name')
    .option('-d, --database <path>', 'Database path', 'fscrape.db')
    .option('-p, --platform <platform>', `Primary platform (${VALID_PLATFORMS.join(', ')})`)
    .option('-f, --force', 'Overwrite existing configuration', false)
    .option('--no-interactive', 'Skip interactive prompts')
    .option('--skip-database', 'Skip database initialization')
    .option('--template <template>', 'Configuration template (minimal, full)', 'minimal')
    .action(
      async (
        directory: string,
        options: {
          name?: string;
          database?: string;
          platform?: string;
          force?: boolean;
          interactive?: boolean;
          skipDatabase?: boolean;
          template?: string;
        }
      ) => {
        try {
          await handleInit(directory, options);
        } catch (error) {
          console.error(chalk.red(formatError(error)));
          process.exit(1);
        }
      }
    );

  return command;
}

/**
 * Handle the init command
 */
interface InitCommandOptions {
  name?: string;
  database?: string;
  platform?: string;
  force?: boolean;
  interactive?: boolean;
  skipDatabase?: boolean;
  template?: string;
}

async function handleInit(directory: string, options: InitCommandOptions): Promise<void> {
  const projectDir = resolve(directory);
  const configPath = join(projectDir, 'fscrape.config.json');

  // Check if config already exists
  if (existsSync(configPath) && !options.force) {
    console.warn(
      chalk.yellow(
        formatWarning(
          'Configuration already exists. Use --force to overwrite or choose a different directory.'
        )
      )
    );

    if (options.interactive !== false && process.stdin.isTTY) {
      const { proceed } = await inquirer.default.prompt([
        {
          type: 'confirm',
          name: 'proceed',
          message: 'Do you want to overwrite the existing configuration?',
          default: false,
        },
      ]);

      if (!proceed) {
        console.log(chalk.blue(formatInfo('Initialization cancelled.')));
        return;
      }
    } else {
      process.exit(1);
    }
  }

  // Create project directory if it doesn't exist
  if (!existsSync(projectDir)) {
    mkdirSync(projectDir, { recursive: true });
    console.log(chalk.green(formatSuccess(`Created project directory: ${projectDir}`)));
  }

  // Gather configuration through prompts if interactive
  let initOptions: InitOptions;

  if (options.interactive !== false && process.stdin.isTTY) {
    initOptions = await promptForOptions({
      ...options,
      platform: options.platform as Platform | undefined,
    });
  } else {
    initOptions = validateInitOptions({
      name: options.name || `fscrape-${Date.now()}`,
      database: options.database,
      platform: options.platform as Platform | undefined,
      force: options.force,
    });
  }

  // Create the configuration
  const config = await createConfiguration(projectDir, initOptions, options.template);

  // Validate configuration
  try {
    validatePartialConfig(config);
  } catch (error) {
    console.error(chalk.red('Configuration validation failed:'));
    console.error(chalk.red(getErrorMessage(error)));
    process.exit(1);
  }

  // Write configuration file
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(chalk.green(formatSuccess(`Created configuration file: ${configPath}`)));

  // Initialize database unless skipped
  if (!options.skipDatabase) {
    const dbPath = join(projectDir, initOptions.database || 'fscrape.db');
    const spinner = ora(`Initializing database: ${dbPath}`).start();

    try {
      // Create database directory if needed
      const dbDir = dirname(dbPath);
      if (!existsSync(dbDir)) {
        mkdirSync(dbDir, { recursive: true });
      }

      // Initialize database with migrations
      const db = new Database(dbPath);
      const migrationManager = new MigrationManager(db);

      // Run all migrations
      const migrationsRun = await migrationManager.runAllMigrations();

      // Initialize database manager for additional setup
      const dbConfig = {
        type: 'sqlite' as const,
        path: dbPath,
        connectionPoolSize: 5,
      };
      const dbManager = new DatabaseManager(dbConfig);
      await dbManager.initialize();

      spinner.succeed(chalk.green(`Database initialized with ${migrationsRun} migrations`));

      // Close connections
      db.close();
    } catch (error) {
      spinner.fail(chalk.red(`Database initialization failed: ${formatError(error)}`));
      console.warn(
        chalk.yellow(
          formatWarning("You can manually initialize the database later using 'fscrape migrate'")
        )
      );
    }
  }

  // Create default directories
  const directories = ['data', 'exports', 'logs', 'cache'];
  for (const dir of directories) {
    const dirPath = join(projectDir, dir);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      console.log(chalk.green(formatSuccess(`Created directory: ${dir}/`)));
    }
  }

  // Create .gitignore if it doesn't exist
  const gitignorePath = join(projectDir, '.gitignore');
  if (!existsSync(gitignorePath)) {
    const gitignoreContent = [
      '# fscrape',
      '*.db',
      '*.db-journal',
      '*.db-shm',
      '*.db-wal',
      'logs/',
      'exports/',
      'data/',
      'cache/',
      '.env',
      '.env.local',
      'node_modules/',
      '.DS_Store',
      '*.log',
      '*.pid',
      '*.seed',
      '*.pid.lock',
    ].join('\n');

    writeFileSync(gitignorePath, gitignoreContent);
    console.log(chalk.green(formatSuccess('Created .gitignore file')));
  }

  // Create README if it doesn't exist
  const readmePath = join(projectDir, 'README.md');
  if (!existsSync(readmePath)) {
    const readmeContent = createReadmeContent(initOptions.name, initOptions.platform);
    writeFileSync(readmePath, readmeContent);
    console.log(chalk.green(formatSuccess('Created README.md file')));
  }

  // Display summary
  console.log('\n' + chalk.bold.green('✨ Project initialized successfully!'));
  console.log(chalk.cyan('\nProject Summary:'));
  console.log(chalk.white(`  Name: ${initOptions.name}`));
  console.log(chalk.white(`  Directory: ${projectDir}`));
  console.log(chalk.white(`  Database: ${initOptions.database || 'fscrape.db'}`));
  if (initOptions.platform) {
    console.log(chalk.white(`  Primary Platform: ${initOptions.platform}`));
  }

  console.log(chalk.cyan('\nNext steps:'));
  console.log(chalk.white('  1. Configure your platform credentials in fscrape.config.json'));
  console.log(chalk.white("  2. Run 'fscrape scrape <url>' to start scraping"));
  console.log(chalk.white("  3. Run 'fscrape status' to view scraping statistics"));
  console.log(chalk.white("  4. Run 'fscrape --help' to see all available commands"));

  if (initOptions.platform === 'reddit') {
    console.log(chalk.yellow('\nReddit Setup:'));
    console.log(chalk.white('  1. Create a Reddit app at https://www.reddit.com/prefs/apps'));
    console.log(chalk.white('  2. Add your client ID and secret to the config file'));
  }
}

/**
 * Prompt for configuration options
 */
async function promptForOptions(existingOptions: Partial<InitOptions>): Promise<InitOptions> {
  const questions = [];

  if (!existingOptions.name) {
    questions.push({
      type: 'input',
      name: 'name',
      message: 'Project name:',
      default: 'fscrape-project',
      validate: (input: string) => input.length > 0 || 'Project name is required',
    });
  }

  if (!existingOptions.database) {
    questions.push({
      type: 'input',
      name: 'database',
      message: 'Database path:',
      default: 'fscrape.db',
      validate: (input: string) => {
        if (!input) return 'Database path is required';
        if (!input.endsWith('.db')) return 'Database path should end with .db';
        return true;
      },
    });
  }

  if (!existingOptions.platform) {
    questions.push({
      type: 'list',
      name: 'platform',
      message: 'Primary platform to scrape:',
      choices: [
        { name: 'Reddit', value: 'reddit' },
        { name: 'Hacker News', value: 'hackernews' },
        { name: 'Discourse', value: 'discourse' },
        { name: 'Lemmy', value: 'lemmy' },
        { name: 'Lobsters', value: 'lobsters' },
        { name: 'Custom', value: 'custom' },
        { name: 'None (configure later)', value: undefined },
      ],
      default: 'reddit',
    });
  }

  questions.push({
    type: 'confirm',
    name: 'includeExamples',
    message: 'Include example configuration values?',
    default: true,
  });

  const answers = await inquirer.default.prompt(questions);

  return validateInitOptions({
    ...existingOptions,
    ...answers,
  });
}

/**
 * Create configuration object based on template
 */
async function createConfiguration(
  projectDir: string,
  options: InitOptions,
  template: string = 'minimal'
): Promise<Partial<ScraperConfig>> {
  // Build configuration from scratch based on template

  // Build configuration based on template
  const config: Partial<ScraperConfig> = {
    platform: (options.platform || 'reddit') as Platform,
    userAgent: `fscrape/1.0.0 (${options.name})`,
    timeout: 30000,
    maxConcurrent: 5,
    followRedirects: true,
    validateSSL: true,
    database: {
      type: 'sqlite' as const,
      path: options.database || 'fscrape.db',
      connectionPoolSize: 5,
    },
  };

  // Add template-specific configuration
  if (template === 'full') {
    // Full template includes all possible configuration options
    config.rateLimit = {
      maxRequestsPerSecond: 2,
      maxRequestsPerMinute: 60,
      maxRequestsPerHour: 1000,
      retryAfter: 1000,
      backoffMultiplier: 2,
      maxRetries: 3,
      respectRateLimitHeaders: true,
    };

    config.cache = {
      enabled: true,
      ttl: 3600000,
      maxSize: 1000,
      strategy: 'lru' as const,
      persistToFile: false,
      cacheDir: join(projectDir, 'cache'),
    };

    config.export = {
      format: 'json' as const,
      outputDir: join(projectDir, 'exports'),
      includeComments: true,
      includeUsers: true,
      prettify: true,
      compression: 'none' as const,
    };

    config.logging = {
      level: 'info' as const,
      format: 'pretty' as const,
      console: true,
      file: join(projectDir, 'logs', 'fscrape.log'),
      maxFiles: 5,
      maxSize: '10m',
    };
  }

  // Add platform-specific configuration templates
  if (options.platform) {
    config.headers = getPlatformHeaders(options.platform as Platform);

    // Add platform-specific notes and examples
    switch (options.platform) {
      case 'reddit':
        // Reddit-specific config is handled by the Reddit platform implementation
        if (template === 'full') {
          config.proxy = {
            enabled: false,
            url: '',
            username: '',
            password: '',
            rotateProxies: false,
          };
        }
        break;

      case 'hackernews':
        // HackerNews doesn't require authentication
        config.userAgent = `${options.name} (HackerNews Scraper)`;
        break;

      case 'discourse':
        // Discourse requires API key
        if (!config.headers) config.headers = {};
        config.headers['Api-Key'] = 'YOUR_DISCOURSE_API_KEY';
        config.headers['Api-Username'] = 'YOUR_USERNAME';
        break;

      case 'lemmy':
        // Lemmy uses JWT authentication
        if (!config.headers) config.headers = {};
        config.headers['Authorization'] = 'Bearer YOUR_JWT_TOKEN';
        break;
    }
  }

  return config;
}

/**
 * Get platform-specific headers
 */
function getPlatformHeaders(platform: Platform): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  switch (platform) {
    case 'reddit':
      // Reddit headers are handled by the auth system
      break;

    case 'hackernews':
      headers['Accept'] = 'application/json';
      break;

    case 'discourse':
      headers['Accept'] = 'application/json';
      break;

    case 'lemmy':
      headers['Accept'] = 'application/json';
      break;

    case 'lobsters':
      headers['Accept'] = 'application/json';
      break;
  }

  return headers;
}

/**
 * Create README content
 */
function createReadmeContent(name: string, platform?: string): string {
  return `# ${name}

A forum scraping project powered by fscrape.

## Configuration

Edit \`fscrape.config.json\` to configure your scraping settings.

${
  platform === 'reddit'
    ? `### Reddit Setup

1. Create a Reddit application at https://www.reddit.com/prefs/apps
2. Choose "script" as the application type
3. Add your client ID and secret to the configuration file
4. Set up your credentials in the platform configuration

\`\`\`json
{
  "platforms": {
    "reddit": {
      "clientId": "YOUR_CLIENT_ID",
      "clientSecret": "YOUR_CLIENT_SECRET",
      "username": "YOUR_USERNAME",
      "password": "YOUR_PASSWORD"
    }
  }
}
\`\`\`
`
    : ''
}

## Usage

### Initialize the project
\`\`\`bash
fscrape init
\`\`\`

### Scrape content
\`\`\`bash
# Scrape from a URL
fscrape scrape <url>

# Scrape with options
fscrape scrape <url> --limit 100 --include-comments
\`\`\`

### View statistics
\`\`\`bash
fscrape status
\`\`\`

### Export data
\`\`\`bash
fscrape export --format json --output data.json
\`\`\`

### Clean old data
\`\`\`bash
fscrape clean --older-than 30
\`\`\`

## Commands

- \`init\` - Initialize a new project
- \`scrape\` - Scrape content from forums
- \`status\` - View database statistics
- \`export\` - Export scraped data
- \`clean\` - Clean old data
- \`config\` - Manage configuration

Run \`fscrape --help\` for more information.

## License

Created with fscrape
`;
}
