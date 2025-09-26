#!/bin/bash

# Database Update Script
# Updates the local SQLite database from remote source or backup

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DB_DIR="public/data"
DB_FILE="$DB_DIR/sample.db"
BACKUP_DIR="$DB_DIR/backup"
REMOTE_DB_URL="${REMOTE_DB_URL:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking requirements..."
    
    # Check for required commands
    if ! command -v sqlite3 &> /dev/null; then
        log_error "sqlite3 is not installed. Please install it first."
        exit 1
    fi
    
    if ! command -v curl &> /dev/null; then
        log_error "curl is not installed. Please install it first."
        exit 1
    fi
}

create_directories() {
    log_info "Creating necessary directories..."
    
    # Create data directory if it doesn't exist
    if [ ! -d "$DB_DIR" ]; then
        mkdir -p "$DB_DIR"
        log_info "Created data directory: $DB_DIR"
    fi
    
    # Create backup directory if it doesn't exist
    if [ ! -d "$BACKUP_DIR" ]; then
        mkdir -p "$BACKUP_DIR"
        log_info "Created backup directory: $BACKUP_DIR"
    fi
}

backup_current_db() {
    if [ -f "$DB_FILE" ]; then
        log_info "Backing up current database..."
        
        # Create backup with timestamp
        BACKUP_FILE="$BACKUP_DIR/sample_${TIMESTAMP}.db"
        cp "$DB_FILE" "$BACKUP_FILE"
        
        log_info "Database backed up to: $BACKUP_FILE"
        
        # Keep only last 5 backups
        log_info "Cleaning old backups..."
        cd "$BACKUP_DIR"
        ls -t sample_*.db 2>/dev/null | tail -n +6 | xargs -r rm
        cd - > /dev/null
    else
        log_warn "No existing database found to backup"
    fi
}

validate_database() {
    local db_path=$1
    
    log_info "Validating database structure..."
    
    # Check if database is valid SQLite
    if ! sqlite3 "$db_path" "SELECT 1;" &> /dev/null; then
        log_error "Invalid SQLite database file"
        return 1
    fi
    
    # Check for required tables
    local tables=$(sqlite3 "$db_path" ".tables")
    
    if [[ ! "$tables" =~ "posts" ]]; then
        log_error "Database missing 'posts' table"
        return 1
    fi
    
    # Check posts table structure
    local columns=$(sqlite3 "$db_path" "PRAGMA table_info(posts);" | cut -d'|' -f2 | tr '\n' ' ')
    local required_columns="id title author content url score comments created_at platform"
    
    for col in $required_columns; do
        if [[ ! "$columns" =~ "$col" ]]; then
            log_error "Missing required column: $col"
            return 1
        fi
    done
    
    # Get row count
    local row_count=$(sqlite3 "$db_path" "SELECT COUNT(*) FROM posts;")
    log_info "Database contains $row_count posts"
    
    return 0
}

update_from_remote() {
    if [ -z "$REMOTE_DB_URL" ]; then
        log_warn "No REMOTE_DB_URL set. Skipping remote update."
        log_info "To update from remote, set REMOTE_DB_URL environment variable"
        return 1
    fi
    
    log_info "Downloading database from remote source..."
    log_info "URL: $REMOTE_DB_URL"
    
    # Download to temp file
    TEMP_DB="/tmp/sample_download_${TIMESTAMP}.db"
    
    if curl -L -o "$TEMP_DB" "$REMOTE_DB_URL"; then
        log_info "Download completed"
        
        # Validate downloaded database
        if validate_database "$TEMP_DB"; then
            # Backup current and replace
            backup_current_db
            mv "$TEMP_DB" "$DB_FILE"
            log_info "Database updated successfully from remote"
            return 0
        else
            log_error "Downloaded database validation failed"
            rm -f "$TEMP_DB"
            return 1
        fi
    else
        log_error "Failed to download database"
        return 1
    fi
}

generate_sample_db() {
    log_info "Generating sample database..."
    
    # Create sample database with schema
    sqlite3 "$DB_FILE" << EOF
-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT,
    content TEXT,
    url TEXT,
    score INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    created_at TEXT,
    scraped_at TEXT,
    platform TEXT,
    permalink TEXT,
    subreddit TEXT,
    forum_name TEXT,
    thread_id TEXT,
    post_type TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_posts_platform ON posts(platform);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at);
CREATE INDEX IF NOT EXISTS idx_posts_score ON posts(score DESC);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);

-- Insert sample data
INSERT INTO posts (title, author, content, url, score, comments, created_at, platform, subreddit) VALUES
    ('Welcome to the Forum Scraper', 'admin', 'This is a sample post for demonstration purposes.', 'https://example.com/1', 100, 25, datetime('now', '-7 days'), 'reddit', 'programming'),
    ('How to use SQL.js in the browser', 'developer', 'SQL.js brings SQLite to the web browser...', 'https://example.com/2', 85, 12, datetime('now', '-6 days'), 'hackernews', NULL),
    ('Best practices for Next.js static exports', 'frontend_dev', 'When building static sites with Next.js...', 'https://example.com/3', 92, 18, datetime('now', '-5 days'), 'reddit', 'nextjs'),
    ('Understanding React Server Components', 'react_expert', 'Server Components are a new paradigm...', 'https://example.com/4', 156, 42, datetime('now', '-4 days'), 'reddit', 'reactjs'),
    ('TypeScript tips and tricks', 'ts_guru', 'Here are some advanced TypeScript patterns...', 'https://example.com/5', 78, 8, datetime('now', '-3 days'), 'hackernews', NULL);

-- Add metadata table
CREATE TABLE IF NOT EXISTS metadata (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO metadata (key, value) VALUES
    ('version', '1.0.0'),
    ('last_update', datetime('now')),
    ('total_posts', (SELECT COUNT(*) FROM posts));
EOF
    
    log_info "Sample database created with demo data"
}

optimize_database() {
    log_info "Optimizing database..."
    
    # Run VACUUM to reclaim space
    sqlite3 "$DB_FILE" "VACUUM;"
    
    # Analyze for query optimization
    sqlite3 "$DB_FILE" "ANALYZE;"
    
    # Get database stats
    local size=$(du -h "$DB_FILE" | cut -f1)
    log_info "Database optimized. Size: $size"
}

print_usage() {
    echo "Usage: $0 [OPTION]"
    echo "Update or manage the forum scraper database"
    echo ""
    echo "Options:"
    echo "  --remote          Update from remote source (requires REMOTE_DB_URL)"
    echo "  --generate        Generate sample database with demo data"
    echo "  --backup          Backup current database only"
    echo "  --validate        Validate current database structure"
    echo "  --optimize        Optimize database performance"
    echo "  --restore FILE    Restore database from backup file"
    echo "  --help            Display this help message"
    echo ""
    echo "Environment variables:"
    echo "  REMOTE_DB_URL     URL to download database from"
    echo ""
    echo "Examples:"
    echo "  $0 --generate                    # Generate sample database"
    echo "  $0 --remote                       # Update from remote"
    echo "  REMOTE_DB_URL=http://example.com/db.sqlite $0 --remote"
}

# Main execution
main() {
    check_requirements
    create_directories
    
    case "${1:-}" in
        --remote)
            update_from_remote || {
                log_warn "Remote update failed, keeping current database"
                exit 1
            }
            optimize_database
            ;;
        --generate)
            backup_current_db
            generate_sample_db
            validate_database "$DB_FILE"
            ;;
        --backup)
            backup_current_db
            ;;
        --validate)
            if [ -f "$DB_FILE" ]; then
                validate_database "$DB_FILE"
            else
                log_error "No database file found at: $DB_FILE"
                exit 1
            fi
            ;;
        --optimize)
            if [ -f "$DB_FILE" ]; then
                optimize_database
            else
                log_error "No database file found at: $DB_FILE"
                exit 1
            fi
            ;;
        --restore)
            if [ -z "$2" ]; then
                log_error "Please specify backup file to restore"
                exit 1
            fi
            if [ -f "$2" ]; then
                backup_current_db
                cp "$2" "$DB_FILE"
                log_info "Database restored from: $2"
                validate_database "$DB_FILE"
            else
                log_error "Backup file not found: $2"
                exit 1
            fi
            ;;
        --help)
            print_usage
            ;;
        *)
            # Default action: check if database exists, create sample if not
            if [ ! -f "$DB_FILE" ]; then
                log_warn "No database found. Creating sample database..."
                generate_sample_db
                validate_database "$DB_FILE"
            else
                log_info "Database exists at: $DB_FILE"
                validate_database "$DB_FILE"
            fi
            ;;
    esac
    
    log_info "Database update complete!"
}

# Run main function
main "$@"