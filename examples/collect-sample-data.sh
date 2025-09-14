#!/bin/bash

# fscrape CLI Example Data Collection Script
# This script demonstrates various features of the fscrape CLI tool
# for scraping Reddit and HackerNews data

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLI_COMMAND="npx tsx $PROJECT_ROOT/src/cli/index.ts"
DB_PATH="$SCRIPT_DIR/sample-outputs/example-data.db"
OUTPUT_DIR="$SCRIPT_DIR/sample-outputs"

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"

# Banner
print_banner() {
    echo -e "${CYAN}${BOLD}"
    echo "╔══════════════════════════════════════════╗"
    echo "║     fscrape CLI Examples Runner         ║"
    echo "║     Reddit & HackerNews Scraping        ║"
    echo "╚══════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Print section header
print_section() {
    echo ""
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}${BOLD}  $1${NC}"
    echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# Print command being executed
print_command() {
    echo -e "${YELLOW}▶ Executing:${NC} $1"
    echo ""
}

# Print success message
print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

# Print error message
print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Print info message
print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    print_section "Checking Prerequisites"
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        print_success "Node.js installed: $NODE_VERSION"
    else
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check if tsx is available
    if command -v npx &> /dev/null && npx tsx --version &> /dev/null; then
        print_success "tsx available for CLI execution"
    else
        print_error "tsx not available. Please install: npm install -g tsx"
        exit 1
    fi
    
    # Check if source files exist
    if [ -f "$PROJECT_ROOT/src/cli/index.ts" ]; then
        print_success "CLI source ready at: $PROJECT_ROOT/src/cli/index.ts"
    else
        print_error "CLI source files not found"
        exit 1
    fi
    
    # Initialize database
    print_info "Initializing example database at: $DB_PATH"
    cd "$PROJECT_ROOT" && $CLI_COMMAND init --database "$DB_PATH" --force 2>/dev/null || true
    print_success "Database ready"
}

# Reddit basic examples
reddit_basic_examples() {
    print_section "Reddit Basic Examples"
    
    echo -e "${BOLD}1. Scraping top posts from r/programming${NC}"
    print_command "scrape https://reddit.com/r/programming --limit 5"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://reddit.com/r/programming \
        --limit 5 \
        --database "$DB_PATH"
    print_success "Scraped r/programming posts"
    echo ""
    
    echo -e "${BOLD}2. Scraping newest posts from r/javascript${NC}"
    print_command "scrape https://reddit.com/r/javascript --limit 5 --sort-by new"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://reddit.com/r/javascript \
        --limit 5 \
        --sort-by new \
        --database "$DB_PATH"
    print_success "Scraped r/javascript newest posts"
    echo ""
    
    echo -e "${BOLD}3. Scraping with comments from r/webdev${NC}"
    print_command "scrape https://reddit.com/r/webdev --limit 3 --include-comments"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://reddit.com/r/webdev \
        --limit 3 \
        --include-comments \
        --max-depth 2 \
        --database "$DB_PATH"
    print_success "Scraped r/webdev posts with comments"
}

# HackerNews basic examples
hackernews_basic_examples() {
    print_section "HackerNews Basic Examples"
    
    echo -e "${BOLD}1. Scraping top stories${NC}"
    print_command "scrape https://news.ycombinator.com --limit 5"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://news.ycombinator.com \
        --limit 5 \
        --database "$DB_PATH"
    print_success "Scraped HackerNews top stories"
    echo ""
    
    echo -e "${BOLD}2. Scraping newest stories${NC}"
    print_command "scrape https://news.ycombinator.com/newest --limit 5"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://news.ycombinator.com/newest \
        --limit 5 \
        --database "$DB_PATH"
    print_success "Scraped HackerNews newest stories"
    echo ""
    
    echo -e "${BOLD}3. Scraping Ask HN posts${NC}"
    print_command "scrape https://news.ycombinator.com/ask --limit 5"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://news.ycombinator.com/ask \
        --limit 5 \
        --database "$DB_PATH"
    print_success "Scraped Ask HN posts"
}

# Terminal output examples (NEW FEATURE)
terminal_output_examples() {
    print_section "Terminal Output Examples (--stdout)"
    
    echo -e "${BOLD}1. Output Reddit posts directly to terminal${NC}"
    print_command "scrape https://reddit.com/r/programming --limit 2 --stdout --no-save"
    print_info "This will display JSON directly in the terminal without saving to database"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://reddit.com/r/programming \
        --limit 2 \
        --stdout \
        --no-save
    print_success "Terminal output complete"
    echo ""
    
    echo -e "${BOLD}2. Pipe terminal output to jq for filtering${NC}"
    print_command "scrape https://reddit.com/r/webdev --limit 3 --stdout --no-save | jq '.posts[].title'"
    print_info "Extract just the post titles using jq"
    if command -v jq &> /dev/null; then
        cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://reddit.com/r/webdev \
            --limit 3 \
            --stdout \
            --no-save | jq '.posts[].title'
        print_success "Filtered titles displayed"
    else
        print_info "jq not installed - showing raw JSON instead"
        cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://reddit.com/r/webdev \
            --limit 3 \
            --stdout \
            --no-save
    fi
    echo ""
    
    echo -e "${BOLD}3. Save to file AND display in terminal${NC}"
    print_command "scrape https://news.ycombinator.com --limit 2 --stdout --output hn-sample.json"
    print_info "This combines --stdout with --output to do both"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://news.ycombinator.com \
        --limit 2 \
        --stdout \
        --output "$OUTPUT_DIR/hn-sample.json" \
        --database "$DB_PATH"
    print_success "Data saved to database, file, AND displayed in terminal"
}

# Export examples
export_examples() {
    print_section "Export Examples"
    
    echo -e "${BOLD}1. Export all data to JSON${NC}"
    print_command "export --format json --output all-data.json"
    cd "$PROJECT_ROOT" && $CLI_COMMAND export \
        --database "$DB_PATH" \
        --format json \
        --output "$OUTPUT_DIR/all-data.json" \
        --pretty
    print_success "Exported to all-data.json"
    echo ""
    
    echo -e "${BOLD}2. Export Reddit posts to CSV${NC}"
    print_command "export --format csv --platform reddit --output reddit-posts.csv"
    cd "$PROJECT_ROOT" && $CLI_COMMAND export \
        --database "$DB_PATH" \
        --format csv \
        --platform reddit \
        --output "$OUTPUT_DIR/reddit-posts.csv"
    print_success "Exported Reddit posts to CSV"
    echo ""
    
    echo -e "${BOLD}3. Export HackerNews data with filters${NC}"
    print_command "export --platform hackernews --min-score 10 --output hn-popular.json"
    cd "$PROJECT_ROOT" && $CLI_COMMAND export \
        --database "$DB_PATH" \
        --format json \
        --platform hackernews \
        --min-score 10 \
        --output "$OUTPUT_DIR/hn-popular.json" \
        --pretty
    print_success "Exported filtered HackerNews data"
}

# Database analytics
database_analytics() {
    print_section "Database Analytics"
    
    echo -e "${BOLD}1. Show database status${NC}"
    print_command "status --database"
    cd "$PROJECT_ROOT" && $CLI_COMMAND status \
        --database "$DB_PATH"
    echo ""
    
    echo -e "${BOLD}2. List scraped content${NC}"
    print_command "list posts --limit 10"
    cd "$PROJECT_ROOT" && $CLI_COMMAND list posts \
        --database "$DB_PATH" \
        --limit 10
}

# Batch operations example
batch_operations() {
    print_section "Batch Operations"
    
    echo -e "${BOLD}Creating batch configuration file${NC}"
    cat > "$OUTPUT_DIR/batch-config.json" << 'EOF'
{
  "tasks": [
    {
      "url": "https://reddit.com/r/technology",
      "limit": 3,
      "sortBy": "hot"
    },
    {
      "url": "https://reddit.com/r/science",
      "limit": 3,
      "sortBy": "top"
    },
    {
      "url": "https://news.ycombinator.com/show",
      "limit": 3
    }
  ]
}
EOF
    print_success "Created batch-config.json"
    echo ""
    
    echo -e "${BOLD}Running batch scraping${NC}"
    print_command "batch --config batch-config.json"
    cd "$PROJECT_ROOT" && $CLI_COMMAND batch \
        --config "$OUTPUT_DIR/batch-config.json" \
        --database "$DB_PATH"
    print_success "Batch scraping completed"
}

# Interactive menu
show_menu() {
    echo ""
    echo -e "${CYAN}${BOLD}Select examples to run:${NC}"
    echo "1) Quick Start - Basic Reddit & HackerNews scraping"
    echo "2) Reddit Examples - Multiple subreddits with options"
    echo "3) HackerNews Examples - Different story types"
    echo "4) Terminal Output (--stdout) - NEW! Display JSON directly in terminal"
    echo "5) Export Demonstrations - JSON, CSV outputs"
    echo "6) Database Analytics - Query and analyze data"
    echo "7) Batch Operations - Multiple sources at once"
    echo "8) Run All Examples"
    echo "9) Clean Database and Start Fresh"
    echo "0) Exit"
    echo ""
    read -p "Enter choice [0-9]: " choice
}

# Clean database
clean_database() {
    print_section "Cleaning Database"
    rm -f "$DB_PATH" "$DB_PATH-wal" "$DB_PATH-shm"
    print_success "Database cleaned"
    cd "$PROJECT_ROOT" && $CLI_COMMAND init --database "$DB_PATH" --force 2>/dev/null
    print_success "Fresh database initialized"
}

# Quick start
quick_start() {
    print_section "Quick Start Examples"
    
    print_info "This will scrape a few posts from Reddit and HackerNews"
    echo ""
    
    # Reddit
    echo -e "${BOLD}Scraping Reddit r/programming (3 posts)${NC}"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://reddit.com/r/programming \
        --limit 3 \
        --database "$DB_PATH"
    print_success "Reddit scraping complete"
    echo ""
    
    # HackerNews
    echo -e "${BOLD}Scraping HackerNews top stories (3 posts)${NC}"
    cd "$PROJECT_ROOT" && $CLI_COMMAND scrape https://news.ycombinator.com \
        --limit 3 \
        --database "$DB_PATH"
    print_success "HackerNews scraping complete"
    echo ""
    
    # Show summary
    echo -e "${BOLD}Summary of collected data:${NC}"
    cd "$PROJECT_ROOT" && $CLI_COMMAND status --database "$DB_PATH"
}

# Main execution
main() {
    print_banner
    check_prerequisites
    
    while true; do
        show_menu
        case $choice in
            1)
                quick_start
                ;;
            2)
                reddit_basic_examples
                ;;
            3)
                hackernews_basic_examples
                ;;
            4)
                terminal_output_examples
                ;;
            5)
                export_examples
                ;;
            6)
                database_analytics
                ;;
            7)
                batch_operations
                ;;
            8)
                quick_start
                reddit_basic_examples
                hackernews_basic_examples
                terminal_output_examples
                export_examples
                database_analytics
                batch_operations
                ;;
            9)
                clean_database
                ;;
            0)
                echo -e "${GREEN}${BOLD}Thank you for using fscrape examples!${NC}"
                exit 0
                ;;
            *)
                print_error "Invalid option. Please select 0-9."
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Run main function
main