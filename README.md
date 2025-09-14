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

### Analytics and Insights
```bash
# Analyze trends in your data
fscrape analyze trends --days 30

# Detect anomalies
fscrape analyze anomalies --sensitivity 0.95

# Generate forecasts
fscrape analyze forecast --horizon 7

# Compare platforms or time periods
fscrape analyze compare --platforms reddit,hackernews

# Generate comprehensive report
fscrape analyze report --export html --output report.html
```

## Commands

- `init` - Initialize a new project
- `scrape` - Scrape content from forums
- `status` - View database statistics
- `export` - Export scraped data
- `clean` - Clean old data
- `config` - Manage configuration
- `analyze` - Advanced analytics and insights
  - `trends` - Identify patterns and trends
  - `anomalies` - Detect unusual activity
  - `forecast` - Predict future values
  - `compare` - Compare platforms/periods
  - `report` - Generate analytics reports

Run `fscrape --help` for more information.

## License

Created with fscrape
