# fscrape-1757550698810

A forum scraping project powered by fscrape.

## Configuration

Edit `fscrape.config.json` to configure your scraping settings.



## Usage

### Initialize the project
```bash
fscrape init
```

### Scrape content
```bash
# Scrape from a URL
fscrape scrape <url>

# Scrape with options
fscrape scrape <url> --limit 100 --include-comments

# Scrape large datasets with automatic pagination
# Reddit automatically paginates when limit > 100 (max 100 per request)
fscrape scrape https://reddit.com/r/programming --limit 500

# Note: When using limits > 100 for Reddit:
# - Automatically fetches multiple pages (100 posts per page)
# - Includes 600ms delay between requests for rate limiting
# - Shows progress as pages are fetched
```

### View statistics
```bash
fscrape status
```

### Export data
```bash
fscrape export --format json --output data.json
```

### Clean old data
```bash
fscrape clean --older-than 30
```

### List scraped data
```bash
fscrape list
```

### Batch operations
```bash
fscrape batch --config batch.json
```

## Commands

- `init` - Initialize a new project
- `scrape` - Scrape content from forums
- `status` - View database statistics
- `export` - Export scraped data
- `list` - List scraped data
- `config` - Manage configuration
- `clean` - Clean old data
- `batch` - Execute batch operations

Run `fscrape --help` for more information.

## License

Created with fscrape
