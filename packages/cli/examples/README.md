# fscrape Examples

This directory contains example scripts and configurations demonstrating how to use the fscrape CLI tool for scraping Reddit and HackerNews data.

## Quick Start

Run the interactive example script:

```bash
cd examples
./collect-sample-data.sh
```

This will present you with a menu of different examples to try.

## What's Included

### 📜 `collect-sample-data.sh`
An interactive script that demonstrates:
- Basic Reddit scraping (various subreddits)
- HackerNews scraping (top, new, ask, show)
- Export functionality (JSON, CSV)
- Database operations
- Batch scraping
- Session management

### 📁 `sample-configs/`
Example configuration files for:
- Reddit platform settings
- HackerNews platform settings
- Batch operation configurations

### 📁 `sample-outputs/`
Generated output files (gitignored):
- Scraped data exports
- Database files
- CSV reports

## Usage Examples

### Basic Reddit Scraping

```bash
# Scrape top posts from r/programming
npx tsx ../src/cli/index.ts scrape https://reddit.com/r/programming --limit 10

# Scrape newest posts from r/javascript
npx tsx ../src/cli/index.ts scrape https://reddit.com/r/javascript --limit 5 --sort-by new

# Scrape with comments
npx tsx ../src/cli/index.ts scrape https://reddit.com/r/webdev --limit 3 --include-comments --max-depth 2
```

### Terminal Output (NEW!)

Display scraped data directly in your terminal without saving to database:

```bash
# Output JSON to terminal
npx tsx ../src/cli/index.ts scrape https://reddit.com/r/programming --limit 5 --stdout --no-save

# Pipe to jq for filtering
npx tsx ../src/cli/index.ts scrape https://reddit.com/r/webdev --limit 3 --stdout --no-save | jq '.posts[].title'

# Save to database AND display in terminal
npx tsx ../src/cli/index.ts scrape https://reddit.com/r/programming --limit 5 --stdout

# Save to file AND display in terminal
npx tsx ../src/cli/index.ts scrape https://news.ycombinator.com --limit 3 --stdout --output results.json
```

### Basic HackerNews Scraping

```bash
# Scrape top stories
npx tsx ../src/cli/index.ts scrape https://news.ycombinator.com --limit 10

# Scrape newest stories
npx tsx ../src/cli/index.ts scrape https://news.ycombinator.com/newest --limit 5

# Scrape Ask HN posts
npx tsx ../src/cli/index.ts scrape https://news.ycombinator.com/ask --limit 5

# Scrape Show HN posts
npx tsx ../src/cli/index.ts scrape https://news.ycombinator.com/show --limit 5
```

### Export Data

```bash
# Export all data to JSON
npx tsx ../src/cli/index.ts export --format json --output data.json --pretty

# Export to CSV
npx tsx ../src/cli/index.ts export --format csv --output data.csv

# Export with filters
npx tsx ../src/cli/index.ts export --platform reddit --min-score 100 --output popular.json

# Export specific date range
npx tsx ../src/cli/index.ts export --start-date 2024-01-01 --end-date 2024-12-31 --output 2024-data.json
```

### Database Operations

```bash
# Initialize database
npx tsx ../src/cli/index.ts init --database my-data.db

# Check status
npx tsx ../src/cli/index.ts status --database my-data.db

# List posts
npx tsx ../src/cli/index.ts list posts --limit 20

# List sessions
npx tsx ../src/cli/index.ts list sessions
```

### Batch Operations

Create a `batch.json` file:

```json
{
  "tasks": [
    {
      "url": "https://reddit.com/r/programming",
      "limit": 10,
      "sortBy": "hot"
    },
    {
      "url": "https://reddit.com/r/javascript",
      "limit": 10,
      "sortBy": "new"
    },
    {
      "url": "https://news.ycombinator.com",
      "limit": 10
    }
  ]
}
```

Then run:

```bash
npx tsx ../src/cli/index.ts batch --config batch.json
```

### Session Management

```bash
# Start a long-running scrape
npx tsx ../src/cli/index.ts scrape https://reddit.com/r/all --limit 1000

# In another terminal, check status
npx tsx ../src/cli/index.ts status

# Pause the session (Ctrl+C)

# Resume the session
npx tsx ../src/cli/index.ts scrape https://reddit.com/r/all --resume <session-id>
```

## Configuration

### Platform Configuration

Create a `fscrape.config.json` file:

```json
{
  "database": {
    "type": "sqlite",
    "path": "fscrape.db"
  },
  "platforms": {
    "reddit": {
      "rateLimit": {
        "requestsPerMinute": 60
      }
    },
    "hackernews": {
      "rateLimit": {
        "requestsPerMinute": 30
      }
    }
  }
}
```

### Environment Variables

```bash
# Set database path
export FSCRAPE_DB_PATH=/path/to/database.db

# Enable debug logging
export DEBUG=fscrape:*

# Set configuration file
export FSCRAPE_CONFIG=/path/to/config.json
```

## Common Use Cases

### 1. Research Data Collection

Collect posts about a specific topic across multiple subreddits:

```bash
# Create a batch configuration
cat > research-batch.json << EOF
{
  "tasks": [
    {"url": "https://reddit.com/r/MachineLearning", "limit": 50},
    {"url": "https://reddit.com/r/artificial", "limit": 50},
    {"url": "https://reddit.com/r/deeplearning", "limit": 50}
  ]
}
EOF

# Run batch collection
npx tsx ../src/cli/index.ts batch --config research-batch.json

# Export to CSV for analysis
npx tsx ../src/cli/index.ts export --format csv --output ml-posts.csv
```

### 2. Trend Monitoring

Monitor trending topics on HackerNews:

```bash
# Scrape top stories every hour (use with cron)
npx tsx ../src/cli/index.ts scrape https://news.ycombinator.com --limit 30

# Export daily summary
npx tsx ../src/cli/index.ts export \
  --start-date $(date +%Y-%m-%d) \
  --format json \
  --output daily-hn-$(date +%Y%m%d).json
```

### 3. Content Archival

Archive a subreddit's content:

```bash
# Scrape with full comment threads
npx tsx ../src/cli/index.ts scrape https://reddit.com/r/AMA \
  --limit 100 \
  --include-comments \
  --max-depth 10

# Export for archival
npx tsx ../src/cli/index.ts export \
  --platform reddit \
  --format json \
  --output reddit-ama-archive.json \
  --pretty
```

## Tips and Best Practices

### Rate Limiting
- Respect platform rate limits
- Use `--delay` option for slower, respectful scraping
- Monitor your scraping sessions with `status` command

### Database Management
- Regularly backup your database
- Use `clean` command to remove old data
- Export important data before cleaning

### Error Handling
- Check logs for detailed error information
- Use `--verbose` flag for debugging
- Resume interrupted sessions instead of restarting

### Performance
- Use batch operations for multiple sources
- Limit comment depth for faster scraping
- Export large datasets in chunks

## Troubleshooting

### Common Issues

1. **Rate limit errors**
   - Reduce requests per minute in configuration
   - Add delays between requests

2. **Database locked errors**
   - Ensure only one scraping session runs at a time
   - Close other database connections

3. **Memory issues with large exports**
   - Use pagination with `--offset` and `--limit`
   - Export in smaller chunks

4. **Network timeouts**
   - Increase timeout in configuration
   - Check your internet connection
   - Use `--retry` option

### Debug Mode

Enable detailed logging:

```bash
# Run with debug output
DEBUG=* npx tsx ../src/cli/index.ts scrape https://reddit.com/r/test --limit 1

# Save debug output to file
DEBUG=* npx tsx ../src/cli/index.ts scrape https://reddit.com/r/test --limit 1 2> debug.log
```

## Additional Resources

- [Main README](../README.md) - Project overview and installation
- [API Documentation](../docs/API.md) - Detailed API reference
- [Contributing Guide](../CONTRIBUTING.md) - How to contribute

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review debug logs with `--verbose` flag
- Open an issue on GitHub