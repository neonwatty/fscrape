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

## Commands

- `init` - Initialize a new project
- `scrape` - Scrape content from forums
- `status` - View database statistics
- `export` - Export scraped data
- `clean` - Clean old data
- `config` - Manage configuration

Run `fscrape --help` for more information.

## License

Created with fscrape
