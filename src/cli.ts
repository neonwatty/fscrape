#!/usr/bin/env node
/**
 * fscrape CLI - Command line interface for the forum scraper
 */

import { Command } from "commander";
import chalk from "chalk";
import packageJson from "../package.json" with { type: "json" };

const program = new Command();

program
  .name("fscrape")
  .description("Multi-platform forum scraper for Reddit and Hacker News")
  .version(packageJson.version);

// Placeholder for commands - will be implemented in subsequent phases
program
  .command("init")
  .description("Initialize fscrape in the current directory")
  .action(() => {
    console.log(chalk.green("✓ fscrape initialization - to be implemented"));
  });

program
  .command("scrape")
  .description("Start scraping from specified platform")
  .option(
    "-p, --platform <platform>",
    "Platform to scrape (reddit, hackernews)",
  )
  .option(
    "-s, --source <source>",
    "Source to scrape (subreddit or HN category)",
  )
  .action((options) => {
    console.log(chalk.blue("Scraping with options:"), options);
    console.log(chalk.yellow("Scraping functionality - to be implemented"));
  });

program.parse(process.argv);
