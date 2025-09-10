# fscrape-1757506464852

A forum scraping project powered by fscrape.

## Configuration

Edit `fscrape.config.json` to configure your scraping settings.

### Reddit Setup

1. Create a Reddit application at https://www.reddit.com/prefs/apps
2. Choose "script" as the application type
3. Add your client ID and secret to the configuration file
4. Set up your credentials in the platform configuration

```json
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
```


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
