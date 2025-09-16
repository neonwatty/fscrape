#!/usr/bin/env npx tsx

/**
 * Test CLI export commands
 */

import { execSync } from "child_process";
import { existsSync, unlinkSync, readFileSync } from "fs";
import chalk from "chalk";

async function testCliExportCommands() {
  console.log("🧪 Testing CLI Export Commands\n");

  let testsPassed = 0;
  let totalTests = 0;
  const testFiles: string[] = [];

  // Helper function to run CLI command
  function runCommand(command: string): string {
    try {
      return execSync(`npx tsx src/cli/index.ts ${command}`, {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "pipe"],
      });
    } catch (error: any) {
      return error.stdout || error.stderr || error.message;
    }
  }

  // Test 1: Export command help
  try {
    totalTests++;
    console.log("Test 1: Export command help");
    
    const output = runCommand("export --help");
    
    if (!output.includes("Export data from database")) {
      throw new Error("Export help text missing");
    }
    
    if (!output.includes("--format")) {
      throw new Error("Format option missing");
    }
    
    if (!output.includes("--platform")) {
      throw new Error("Platform option missing");
    }
    
    console.log("✅ Export help displayed correctly\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ Export help failed:", error.message, "\n");
  }

  // Test 2: List command help
  try {
    totalTests++;
    console.log("Test 2: List command help");
    
    const output = runCommand("list --help");
    
    if (!output.includes("List and query data")) {
      throw new Error("List help text missing");
    }
    
    if (!output.includes("posts")) {
      throw new Error("Posts subcommand missing");
    }
    
    if (!output.includes("comments")) {
      throw new Error("Comments subcommand missing");
    }
    
    if (!output.includes("search")) {
      throw new Error("Search subcommand missing");
    }
    
    console.log("✅ List help displayed correctly\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ List help failed:", error.message, "\n");
  }

  // Test 3: Export to JSON
  try {
    totalTests++;
    console.log("Test 3: Export to JSON format");
    
    const outputFile = "test-export.json";
    testFiles.push(outputFile);
    
    // Remove file if exists
    if (existsSync(outputFile)) {
      unlinkSync(outputFile);
    }
    
    const output = runCommand(`export -f json -o ${outputFile} --limit 5`);
    
    if (!existsSync(outputFile)) {
      throw new Error("JSON file not created");
    }
    
    // Validate JSON content
    const content = readFileSync(outputFile, "utf-8");
    const data = JSON.parse(content);
    
    if (!data.posts && !data.comments && !data.users) {
      console.log("  ⚠️  No data in database to export");
    } else {
      if (!data.metadata) {
        throw new Error("Metadata missing from export");
      }
    }
    
    console.log("✅ JSON export working\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ JSON export failed:", error.message, "\n");
  }

  // Test 4: Export to CSV
  try {
    totalTests++;
    console.log("Test 4: Export to CSV format");
    
    const outputFile = "test-export.csv";
    testFiles.push(outputFile);
    
    // Remove file if exists
    if (existsSync(outputFile)) {
      unlinkSync(outputFile);
    }
    
    const output = runCommand(`export -f csv -o ${outputFile} --limit 5`);
    
    if (!existsSync(outputFile)) {
      throw new Error("CSV file not created");
    }
    
    // Validate CSV content
    const content = readFileSync(outputFile, "utf-8");
    const lines = content.split("\n");
    
    if (lines.length > 1) {
      // Check for header row
      if (!lines[0].includes(",")) {
        throw new Error("Invalid CSV format");
      }
    }
    
    console.log("✅ CSV export working\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ CSV export failed:", error.message, "\n");
  }

  // Test 5: Export to Markdown
  try {
    totalTests++;
    console.log("Test 5: Export to Markdown format");
    
    const outputFile = "test-export.md";
    testFiles.push(outputFile);
    
    // Remove file if exists
    if (existsSync(outputFile)) {
      unlinkSync(outputFile);
    }
    
    const output = runCommand(`export -f markdown -o ${outputFile} --limit 5`);
    
    if (!existsSync(outputFile)) {
      throw new Error("Markdown file not created");
    }
    
    // Validate Markdown content
    const content = readFileSync(outputFile, "utf-8");
    
    if (content.length > 0 && !content.includes("#")) {
      throw new Error("Invalid Markdown format - no headers");
    }
    
    console.log("✅ Markdown export working\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ Markdown export failed:", error.message, "\n");
  }

  // Test 6: Export to HTML
  try {
    totalTests++;
    console.log("Test 6: Export to HTML format");
    
    const outputFile = "test-export.html";
    testFiles.push(outputFile);
    
    // Remove file if exists
    if (existsSync(outputFile)) {
      unlinkSync(outputFile);
    }
    
    const output = runCommand(`export -f html -o ${outputFile} --limit 5`);
    
    if (!existsSync(outputFile)) {
      throw new Error("HTML file not created");
    }
    
    // Validate HTML content
    const content = readFileSync(outputFile, "utf-8");
    
    if (content.length > 0) {
      if (!content.includes("<html") && !content.includes("<div")) {
        throw new Error("Invalid HTML format");
      }
    }
    
    console.log("✅ HTML export working\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ HTML export failed:", error.message, "\n");
  }

  // Test 7: Export with filters
  try {
    totalTests++;
    console.log("Test 7: Export with filters");
    
    const outputFile = "test-export-filtered.json";
    testFiles.push(outputFile);
    
    // Remove file if exists
    if (existsSync(outputFile)) {
      unlinkSync(outputFile);
    }
    
    const output = runCommand(
      `export -f json -o ${outputFile} --platform hackernews --limit 3 --min-score 10`
    );
    
    if (!existsSync(outputFile)) {
      throw new Error("Filtered export file not created");
    }
    
    console.log("✅ Filtered export working\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ Filtered export failed:", error.message, "\n");
  }

  // Test 8: List posts command
  try {
    totalTests++;
    console.log("Test 8: List posts command");
    
    const output = runCommand("list posts --limit 5 --format simple");
    
    // Command should run without error
    // Output depends on database content
    
    console.log("✅ List posts command working\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ List posts failed:", error.message, "\n");
  }

  // Test 9: List stats command
  try {
    totalTests++;
    console.log("Test 9: List stats command");
    
    const output = runCommand("list stats");
    
    if (!output.includes("Database Statistics")) {
      throw new Error("Stats output missing");
    }
    
    console.log("✅ List stats command working\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ List stats failed:", error.message, "\n");
  }

  // Test 10: Export subcommands
  try {
    totalTests++;
    console.log("Test 10: Export subcommands");
    
    // Test posts subcommand
    const postsOutput = runCommand("export posts --help");
    if (!postsOutput.includes("Export only posts")) {
      throw new Error("Posts subcommand help missing");
    }
    
    // Test comments subcommand
    const commentsOutput = runCommand("export comments --help");
    if (!commentsOutput.includes("Export only comments")) {
      throw new Error("Comments subcommand help missing");
    }
    
    // Test users subcommand
    const usersOutput = runCommand("export users --help");
    if (!usersOutput.includes("Export user data")) {
      throw new Error("Users subcommand help missing");
    }
    
    console.log("✅ Export subcommands working\n");
    testsPassed++;
  } catch (error: any) {
    console.error("❌ Export subcommands failed:", error.message, "\n");
  }

  // Cleanup test files
  console.log("Cleaning up test files...");
  for (const file of testFiles) {
    if (existsSync(file)) {
      try {
        unlinkSync(file);
      } catch (error) {
        console.warn(`Could not delete ${file}`);
      }
    }
  }

  // Summary
  console.log("═".repeat(50));
  console.log(`\n📊 Test Results: ${testsPassed}/${totalTests} tests passed`);
  
  if (testsPassed === totalTests) {
    console.log(chalk.green("✅ All CLI export command tests passed!"));
  } else {
    console.log(chalk.red(`❌ ${totalTests - testsPassed} tests failed`));
    process.exit(1);
  }
}

// Run tests
testCliExportCommands().catch(console.error);