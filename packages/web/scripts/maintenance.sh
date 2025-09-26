#!/bin/bash

# ================================================
# Forum Scraper Frontend - Maintenance Script
# ================================================
# This script performs routine maintenance tasks including:
# - Dependency updates
# - Security auditing
# - Cache cleaning
# - Performance checks
# - Backup procedures
# ================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="./backups"
LOG_DIR="./logs"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOG_FILE="$LOG_DIR/maintenance_$TIMESTAMP.log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

# Create necessary directories
mkdir -p "$BACKUP_DIR"
mkdir -p "$LOG_DIR"

# ================================================
# 1. DEPENDENCY AUDIT
# ================================================
dependency_audit() {
    log "Starting dependency audit..."
    
    # Check for outdated packages
    info "Checking for outdated packages..."
    npx npm-check-updates --format json > "$LOG_DIR/outdated_packages_$TIMESTAMP.json" || true
    
    # Run security audit
    info "Running security audit..."
    npm audit --json > "$LOG_DIR/security_audit_$TIMESTAMP.json" || true
    
    # Check for vulnerabilities
    VULNS=$(npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities | add' || echo "0")
    
    if [ "$VULNS" != "0" ] && [ "$VULNS" != "null" ]; then
        warning "Found $VULNS vulnerabilities"
        
        # Attempt automatic fixes for non-breaking changes
        read -p "Attempt to fix vulnerabilities automatically? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npm audit fix
            
            # Check for remaining vulnerabilities requiring major updates
            REMAINING=$(npm audit --json 2>/dev/null | jq '.metadata.vulnerabilities | add' || echo "0")
            if [ "$REMAINING" != "0" ] && [ "$REMAINING" != "null" ]; then
                warning "Still $REMAINING vulnerabilities remaining (may require major version updates)"
                info "Run 'npm audit fix --force' to fix breaking changes (use with caution)"
            fi
        fi
    else
        log "No vulnerabilities found ✓"
    fi
}

# ================================================
# 2. CACHE CLEANING
# ================================================
clean_cache() {
    log "Cleaning caches..."
    
    # Clean Next.js cache
    if [ -d ".next" ]; then
        info "Cleaning Next.js cache..."
        rm -rf .next
        log "Next.js cache cleaned ✓"
    fi
    
    # Clean npm cache
    info "Cleaning npm cache..."
    npm cache clean --force
    log "npm cache cleaned ✓"
    
    # Clean build outputs
    if [ -d "out" ]; then
        info "Cleaning build outputs..."
        rm -rf out
        log "Build outputs cleaned ✓"
    fi
}

# ================================================
# 3. PERFORMANCE CHECK
# ================================================
performance_check() {
    log "Running performance checks..."
    
    # Check bundle size
    info "Analyzing bundle size..."
    if [ -f "package.json" ]; then
        npm run build > "$LOG_DIR/build_output_$TIMESTAMP.log" 2>&1
        
        # Get .next directory size
        if [ -d ".next" ]; then
            SIZE=$(du -sh .next | cut -f1)
            info "Build size: $SIZE"
        fi
    fi
    
    # Run lighthouse CI if available
    if command -v lighthouse &> /dev/null; then
        info "Running Lighthouse performance audit..."
        lighthouse https://localhost:3000 \
            --output json \
            --output-path "$LOG_DIR/lighthouse_$TIMESTAMP.json" \
            --chrome-flags="--headless" || true
    fi
    
    log "Performance checks completed ✓"
}

# ================================================
# 4. BACKUP PROCEDURES
# ================================================
create_backup() {
    log "Creating backup..."
    
    BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.tar.gz"
    
    # List of directories and files to backup
    BACKUP_ITEMS=(
        "app"
        "components"
        "lib"
        "public/data"
        "package.json"
        "package-lock.json"
        "next.config.js"
        "tsconfig.json"
        "tailwind.config.js"
    )
    
    # Create backup
    info "Creating backup archive..."
    tar -czf "$BACKUP_FILE" "${BACKUP_ITEMS[@]}" 2>/dev/null || true
    
    if [ -f "$BACKUP_FILE" ]; then
        SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
        log "Backup created: $BACKUP_FILE (Size: $SIZE) ✓"
        
        # Clean old backups (keep last 5)
        info "Cleaning old backups..."
        ls -t "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | tail -n +6 | xargs rm -f 2>/dev/null || true
    else
        error "Failed to create backup"
    fi
}

# ================================================
# 5. DATABASE MAINTENANCE
# ================================================
database_maintenance() {
    log "Running database maintenance..."
    
    # Validate database
    if [ -f "scripts/validate-db.js" ]; then
        info "Validating database..."
        node scripts/validate-db.js > "$LOG_DIR/db_validation_$TIMESTAMP.log" 2>&1
        log "Database validation completed ✓"
    fi
    
    # Backup database
    if [ -d "public/data" ]; then
        info "Backing up database files..."
        mkdir -p "$BACKUP_DIR/db"
        cp -r public/data/*.db "$BACKUP_DIR/db/" 2>/dev/null || true
        log "Database backup completed ✓"
    fi
}

# ================================================
# 6. DEPENDENCY UPDATES
# ================================================
update_dependencies() {
    log "Checking for dependency updates..."
    
    # Check for updates
    info "Checking available updates..."
    npx npm-check-updates
    
    read -p "Do you want to update dependencies? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Backup package.json
        cp package.json "$BACKUP_DIR/package.json.$TIMESTAMP"
        cp package-lock.json "$BACKUP_DIR/package-lock.json.$TIMESTAMP" 2>/dev/null || true
        
        # Update dependencies
        info "Updating dependencies..."
        npx npm-check-updates -u
        npm install
        
        # Run tests to verify updates
        info "Running tests to verify updates..."
        npm run test:run > "$LOG_DIR/test_results_$TIMESTAMP.log" 2>&1 || warning "Some tests failed after update"
        
        log "Dependencies updated ✓"
    fi
}

# ================================================
# 7. HEALTH CHECK
# ================================================
health_check() {
    log "Running health checks..."
    
    # Run the health check script
    if [ -f "scripts/health-check.js" ]; then
        node scripts/health-check.js
    fi
    
    # Check if all required files exist
    REQUIRED_FILES=(
        "package.json"
        "next.config.js"
        "tsconfig.json"
        "app/layout.tsx"
        "app/page.tsx"
    )
    
    MISSING_FILES=()
    for file in "${REQUIRED_FILES[@]}"; do
        if [ ! -f "$file" ]; then
            MISSING_FILES+=("$file")
        fi
    done
    
    if [ ${#MISSING_FILES[@]} -gt 0 ]; then
        error "Missing required files: ${MISSING_FILES[*]}"
    else
        log "All required files present ✓"
    fi
}

# ================================================
# MAIN MENU
# ================================================
show_menu() {
    echo
    echo "========================================"
    echo "    Forum Scraper Frontend Maintenance"
    echo "========================================"
    echo "1. Run full maintenance (recommended)"
    echo "2. Dependency audit only"
    echo "3. Clean caches only"
    echo "4. Performance check only"
    echo "5. Create backup only"
    echo "6. Database maintenance only"
    echo "7. Update dependencies"
    echo "8. Health check only"
    echo "9. Exit"
    echo "========================================"
}

# Main execution
main() {
    log "Maintenance script started"
    
    if [ "$1" == "--auto" ] || [ "$1" == "-a" ]; then
        # Run full maintenance automatically
        log "Running automatic full maintenance..."
        dependency_audit
        clean_cache
        performance_check
        create_backup
        database_maintenance
        health_check
        log "Automatic maintenance completed ✓"
    else
        # Interactive mode
        while true; do
            show_menu
            read -p "Select an option: " choice
            
            case $choice in
                1)
                    log "Running full maintenance..."
                    dependency_audit
                    clean_cache
                    performance_check
                    create_backup
                    database_maintenance
                    update_dependencies
                    health_check
                    log "Full maintenance completed ✓"
                    ;;
                2)
                    dependency_audit
                    ;;
                3)
                    clean_cache
                    ;;
                4)
                    performance_check
                    ;;
                5)
                    create_backup
                    ;;
                6)
                    database_maintenance
                    ;;
                7)
                    update_dependencies
                    ;;
                8)
                    health_check
                    ;;
                9)
                    log "Maintenance script ended"
                    exit 0
                    ;;
                *)
                    error "Invalid option"
                    ;;
            esac
        done
    fi
}

# Run main function
main "$@"