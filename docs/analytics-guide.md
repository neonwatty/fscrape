# 📊 fscrape Analytics Comprehensive User Guide

## Table of Contents

1. [Overview](#overview)
2. [Getting Started](#getting-started)
3. [Core Analytics Features](#core-analytics-features)
4. [Step-by-Step Tutorials](#step-by-step-tutorials)
5. [Real-World Use Cases](#real-world-use-cases)
6. [Configuration Guide](#configuration-guide)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [API Reference](#api-reference)
10. [Best Practices](#best-practices)

---

## Overview

The fscrape analytics system provides enterprise-grade data analysis capabilities for your scraped forum data. Built with performance and accuracy in mind, it offers comprehensive insights through statistical analysis, trend detection, anomaly identification, and predictive forecasting.

### Architecture Components

```
┌─────────────────────────────────────────────────┐
│                 Analytics Engine                 │
├─────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │Statistics│  │  Trends  │  │Anomalies │     │
│  │  Engine  │  │ Analyzer │  │ Detector │     │
│  └──────────┘  └──────────┘  └──────────┘     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐     │
│  │Forecasting│ │Visualizer│  │ Reports  │     │
│  │  Engine  │  │          │  │Generator │     │
│  └──────────┘  └──────────┘  └──────────┘     │
├─────────────────────────────────────────────────┤
│              Cache Layer (LRU/FIFO)              │
├─────────────────────────────────────────────────┤
│                  Database                        │
└─────────────────────────────────────────────────┘
```

### Key Capabilities

- **Statistical Analysis**: Mean, median, variance, percentiles, correlations
- **Trend Analysis**: Linear/exponential trends, seasonality, change points
- **Anomaly Detection**: Statistical, IQR, Isolation Forest methods
- **Forecasting**: ARIMA, exponential smoothing, linear projection
- **Visualization**: Terminal charts, SVG export, interactive dashboards
- **Caching**: Intelligent result caching with TTL and dependency tracking
- **Performance**: Parallel processing, data sampling, query optimization

---

## Getting Started

### Prerequisites

1. **Verify Installation**
```bash
# Check fscrape version
fscrape --version

# Verify analytics module
fscrape analyze --help
```

2. **Ensure Database Has Data**
```bash
# Check database status
fscrape status

# View data summary
fscrape list --summary
```

3. **Initial Setup**
```bash
# Initialize analytics configuration
fscrape config analytics --init

# Test analytics connection
fscrape analyze test
```

### Quick Start Guide

```bash
# 1. Get overview of your data
fscrape analyze summary

# 2. Run basic trend analysis
fscrape analyze trends --days 7

# 3. Check for anomalies
fscrape analyze anomalies

# 4. Generate forecast
fscrape analyze forecast --horizon 7

# 5. Create comprehensive report
fscrape analyze report --output analytics-report.html
```

---

## Core Analytics Features

### 1. Statistical Analysis

The statistics engine provides comprehensive statistical computations:

#### Basic Statistics
```bash
# Compute basic statistics
fscrape analyze stats

# Filter by date range
fscrape analyze stats --from "2024-01-01" --to "2024-12-31"

# Platform-specific statistics
fscrape analyze stats --platform reddit
```

**Available Metrics:**
- **Central Tendency**: mean, median, mode
- **Dispersion**: variance, standard deviation, range
- **Shape**: skewness, kurtosis
- **Percentiles**: 25th, 50th, 75th, 90th, 95th, 99th

#### Correlation Analysis
```bash
# Analyze correlations between metrics
fscrape analyze correlations

# Specific metric pairs
fscrape analyze correlations --metrics "posts,comments"

# Export correlation matrix
fscrape analyze correlations --export csv --output correlations.csv
```

### 2. Trend Analysis

Identify patterns and trends in your data:

#### Trend Detection
```bash
# Detect overall trends
fscrape analyze trends

# Specific time granularity
fscrape analyze trends --interval daily
fscrape analyze trends --interval weekly
fscrape analyze trends --interval monthly

# Include confidence intervals
fscrape analyze trends --confidence 95
```

#### Seasonality Detection
```bash
# Detect seasonal patterns
fscrape analyze seasonality

# Specific seasonal periods
fscrape analyze seasonality --periods "daily,weekly,monthly"

# Decompose time series
fscrape analyze decompose --method additive
```

#### Change Point Detection
```bash
# Detect significant changes
fscrape analyze changepoints

# Adjust sensitivity
fscrape analyze changepoints --sensitivity high

# Include context
fscrape analyze changepoints --context 5
```

### 3. Anomaly Detection

Identify outliers and unusual patterns:

#### Detection Methods

**Statistical Method (Z-Score)**
```bash
# Use statistical anomaly detection
fscrape analyze anomalies --method statistical

# Adjust threshold (default: 3)
fscrape analyze anomalies --method statistical --threshold 2.5
```

**IQR Method**
```bash
# Use Interquartile Range method
fscrape analyze anomalies --method iqr

# Adjust multiplier (default: 1.5)
fscrape analyze anomalies --method iqr --multiplier 2.0
```

**Isolation Forest**
```bash
# Use Isolation Forest algorithm
fscrape analyze anomalies --method isolation

# Adjust contamination rate
fscrape analyze anomalies --method isolation --contamination 0.1
```

**Ensemble Method**
```bash
# Combine multiple methods
fscrape analyze anomalies --method ensemble

# Specify methods to combine
fscrape analyze anomalies --method ensemble --ensemble-methods "statistical,iqr,isolation"
```

### 4. Forecasting

Predict future values based on historical data:

#### Forecasting Methods

**Linear Projection**
```bash
# Simple linear forecast
fscrape analyze forecast --method linear

# Include trend strength
fscrape analyze forecast --method linear --show-strength
```

**Exponential Smoothing**
```bash
# Exponential smoothing forecast
fscrape analyze forecast --method exponential

# Adjust smoothing parameters
fscrape analyze forecast --method exponential --alpha 0.3 --beta 0.1
```

**ARIMA Model**
```bash
# ARIMA forecasting
fscrape analyze forecast --method arima

# Auto-select ARIMA parameters
fscrape analyze forecast --method arima --auto

# Manual ARIMA parameters
fscrape analyze forecast --method arima --order "2,1,2"
```

**Moving Average**
```bash
# Moving average forecast
fscrape analyze forecast --method ma

# Specify window size
fscrape analyze forecast --method ma --window 7
```

### 5. Visualization

Create visual representations of your analytics:

#### Terminal Charts
```bash
# Sparkline charts
fscrape analyze trends --viz sparkline

# Bar charts
fscrape analyze trends --viz bar

# Line charts
fscrape analyze trends --viz line

# Heatmaps
fscrape analyze correlations --viz heatmap
```

#### Export Options
```bash
# Export as SVG
fscrape analyze trends --export svg --output trends.svg

# Export as PNG (requires dependencies)
fscrape analyze trends --export png --output trends.png

# Export as HTML with interactive charts
fscrape analyze report --export html --output report.html
```

### 6. Report Generation

Generate comprehensive analytics reports:

```bash
# Basic report
fscrape analyze report

# Full report with all analyses
fscrape analyze report --comprehensive

# Custom report sections
fscrape analyze report --sections "summary,trends,anomalies,forecast"

# Scheduled reports
fscrape analyze report --schedule daily --email admin@example.com
```

---

## Step-by-Step Tutorials

### Tutorial 1: First-Time Analytics Setup

**Goal**: Set up analytics for a new fscrape installation

1. **Verify Data Availability**
```bash
# Check if you have data
fscrape status

# If no data, scrape some
fscrape scrape reddit/r/programming --limit 1000
```

2. **Configure Analytics**
```bash
# Create analytics configuration
cat > fscrape-analytics.json << EOF
{
  "analytics": {
    "enabled": true,
    "cache": {
      "enabled": true,
      "defaultTTL": 300000,
      "maxSize": 52428800
    },
    "computation": {
      "maxDataPoints": 100000,
      "parallelProcessing": true
    }
  }
}
EOF

# Apply configuration
fscrape config apply fscrape-analytics.json
```

3. **Run Initial Analysis**
```bash
# Get data summary
fscrape analyze summary

# Check data quality
fscrape analyze quality

# Run comprehensive report
fscrape analyze report --output initial-report.html
```

### Tutorial 2: Daily Monitoring Workflow

**Goal**: Set up daily monitoring for forum activity

1. **Create Monitoring Script**
```bash
#!/bin/bash
# daily-monitor.sh

# Update data
fscrape scrape --update

# Generate daily report
fscrape analyze report --days 1 --output "daily-$(date +%Y%m%d).html"

# Check for anomalies
fscrape analyze anomalies --days 1 --severity high

# Update forecast
fscrape analyze forecast --update

# Send notifications if needed
if [ $? -ne 0 ]; then
  echo "Anomalies detected!" | mail -s "Forum Alert" admin@example.com
fi
```

2. **Schedule with Cron**
```bash
# Add to crontab
crontab -e

# Run daily at 2 AM
0 2 * * * /path/to/daily-monitor.sh
```

### Tutorial 3: Investigating Traffic Spikes

**Goal**: Analyze and understand sudden traffic increases

1. **Identify the Spike**
```bash
# View recent trends
fscrape analyze trends --days 30 --viz line

# Detect anomalies
fscrape analyze anomalies --days 30
```

2. **Analyze the Spike Period**
```bash
# Get detailed data for spike date
SPIKE_DATE="2024-01-15"
fscrape analyze details --date $SPIKE_DATE

# Compare to normal period
fscrape analyze compare --date1 $SPIKE_DATE --date2 "2024-01-10"

# Check user activity
fscrape analyze users --date $SPIKE_DATE --top 20
```

3. **Identify Root Cause**
```bash
# Analyze content during spike
fscrape analyze content --date $SPIKE_DATE --top-posts

# Check for viral posts
fscrape analyze viral --date $SPIKE_DATE

# Examine user patterns
fscrape analyze patterns --date $SPIKE_DATE --type user
```

### Tutorial 4: Predictive Analytics Setup

**Goal**: Configure and use forecasting for capacity planning

1. **Prepare Historical Data**
```bash
# Ensure sufficient history (90+ days recommended)
fscrape analyze history --check

# Clean outliers if needed
fscrape analyze clean --remove-outliers --backup
```

2. **Configure Forecasting**
```bash
# Test different models
fscrape analyze forecast --test-models

# Select best performing model
fscrape analyze forecast --auto-select

# Configure selected model
fscrape config set analytics.forecasting.defaultMethod "arima"
```

3. **Generate Predictions**
```bash
# 30-day forecast
fscrape analyze forecast --horizon 30

# Include confidence intervals
fscrape analyze forecast --horizon 30 --confidence 95

# Export for capacity planning
fscrape analyze forecast --horizon 90 --export csv --output capacity-plan.csv
```

---

## Real-World Use Cases

### Use Case 1: Community Health Monitoring

**Scenario**: Monitor the health and engagement of an online community

```bash
# 1. Define health metrics
fscrape analyze health --define-metrics

# 2. Create health dashboard
fscrape analyze dashboard --type health --output health.html

# 3. Set up alerts
fscrape analyze alerts --metric "engagement" --threshold 50 --direction decrease

# 4. Generate weekly health reports
fscrape analyze health-report --weekly --email community@example.com
```

**Key Metrics to Track:**
- User growth rate
- Post/comment ratio
- Response time
- User retention
- Content quality scores

### Use Case 2: Content Strategy Optimization

**Scenario**: Optimize content posting times and topics

```bash
# 1. Analyze posting patterns
fscrape analyze patterns --type temporal

# 2. Identify best posting times
fscrape analyze optimal-times --metric engagement

# 3. Analyze top-performing content
fscrape analyze content --top 100 --by engagement

# 4. Generate content calendar
fscrape analyze calendar --generate --weeks 4
```

**Optimization Strategies:**
- Peak engagement hours
- Day-of-week patterns
- Topic performance
- User preference analysis

### Use Case 3: Competitive Analysis

**Scenario**: Compare multiple platforms or communities

```bash
# 1. Collect data from multiple sources
fscrape scrape reddit/r/programming --tag competitor1
fscrape scrape hackernews --tag competitor2

# 2. Comparative analysis
fscrape analyze compare --tags "competitor1,competitor2"

# 3. Benchmark metrics
fscrape analyze benchmark --baseline competitor1

# 4. Generate comparison report
fscrape analyze competition-report --output competitive-analysis.pdf
```

### Use Case 4: Trend Identification for Market Research

**Scenario**: Identify emerging trends and topics

```bash
# 1. Topic extraction
fscrape analyze topics --method lda --num-topics 20

# 2. Trend detection
fscrape analyze emerging-trends --min-growth 50

# 3. Sentiment analysis
fscrape analyze sentiment --by-topic

# 4. Generate trend report
fscrape analyze trend-report --format powerpoint
```

### Use Case 5: Anomaly-Based Moderation

**Scenario**: Detect and flag unusual activity for moderation

```bash
# 1. Configure anomaly detection
fscrape config set analytics.anomalies.sensitivity 0.99

# 2. Real-time monitoring
fscrape analyze monitor --real-time --anomalies

# 3. Set up auto-flagging
fscrape analyze auto-flag --severity high --action quarantine

# 4. Moderation queue
fscrape analyze moderation-queue --priority severity
```

---

## Configuration Guide

### Configuration File Structure

```json
{
  "analytics": {
    "enabled": true,

    "cache": {
      "enabled": true,
      "defaultTTL": 300000,
      "maxSize": 52428800,
      "maxEntries": 1000,
      "strategy": "lru",
      "compressionThreshold": 1024
    },

    "computation": {
      "maxDataPoints": 100000,
      "samplingThreshold": 10000,
      "parallelProcessing": true,
      "workerThreads": 4,
      "timeoutMs": 30000
    },

    "visualization": {
      "defaultChartType": "line",
      "maxSeriesPoints": 1000,
      "enableInteractive": true,
      "colorScheme": "default"
    },

    "performance": {
      "enableProfiling": false,
      "slowQueryThreshold": 1000,
      "memoryLimit": 512
    },

    "statistics": {
      "confidenceLevel": 0.95,
      "bootstrapSamples": 1000,
      "outlierMethod": "iqr"
    },

    "trends": {
      "minDataPoints": 10,
      "smoothingWindow": 7,
      "seasonalityDetection": true
    },

    "anomalies": {
      "enabled": true,
      "method": "isolation",
      "sensitivity": 0.5,
      "minSamples": 30
    },

    "forecasting": {
      "defaultMethod": "auto",
      "horizonDays": 7,
      "confidenceIntervals": [0.80, 0.95]
    }
  }
}
```

### Environment Variables

```bash
# Cache configuration
export FSCRAPE_ANALYTICS_CACHE_ENABLED=true
export FSCRAPE_ANALYTICS_CACHE_TTL=300000

# Performance tuning
export FSCRAPE_ANALYTICS_PARALLEL=true
export FSCRAPE_ANALYTICS_WORKERS=8

# Visualization
export FSCRAPE_ANALYTICS_COLORS=true
export FSCRAPE_ANALYTICS_CHART_WIDTH=120
```

### Configuration Best Practices

1. **Cache Settings**
   - Enable for repeated analyses
   - Adjust TTL based on data update frequency
   - Monitor memory usage

2. **Computation Settings**
   - Enable parallel processing for large datasets
   - Set appropriate sampling thresholds
   - Configure timeouts to prevent hanging

3. **Method Selection**
   - Use ensemble methods for critical analyses
   - Adjust sensitivity based on use case
   - Validate results with multiple methods

---

## Performance Optimization

### Optimization Strategies

#### 1. Database Optimization
```bash
# Create indexes
fscrape db optimize --create-indexes

# Vacuum database
fscrape db vacuum

# Analyze query plans
fscrape db analyze --explain
```

#### 2. Cache Optimization
```bash
# Warm up cache
fscrape analyze cache --warm-up

# Monitor cache performance
fscrape analyze cache --stats

# Clear stale entries
fscrape analyze cache --clean
```

#### 3. Query Optimization
```bash
# Use time filters
fscrape analyze trends --from "2024-01-01" --to "2024-01-31"

# Limit data points
fscrape analyze stats --sample 10000

# Use incremental processing
fscrape analyze --incremental
```

### Performance Benchmarks

```bash
# Run performance tests
fscrape analyze benchmark

# Profile slow operations
fscrape analyze profile --operation forecast

# Generate performance report
fscrape analyze performance-report
```

### Recommended Settings by Dataset Size

| Dataset Size | Cache | Parallel | Sampling | Workers |
|-------------|-------|----------|----------|---------|
| < 10K records | 100MB | No | No | 1 |
| 10K - 100K | 500MB | Yes | No | 2 |
| 100K - 1M | 1GB | Yes | Yes (10%) | 4 |
| > 1M | 2GB+ | Yes | Yes (1%) | 8 |

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue: "Insufficient data for analysis"
```bash
# Check data availability
fscrape analyze data --check

# Solution 1: Scrape more data
fscrape scrape --days 30

# Solution 2: Adjust minimum requirements
fscrape config set analytics.trends.minDataPoints 5

# Solution 3: Use different granularity
fscrape analyze trends --interval monthly
```

#### Issue: "Analysis taking too long"
```bash
# Check performance metrics
fscrape analyze performance --diagnose

# Solution 1: Enable caching
fscrape config set analytics.cache.enabled true

# Solution 2: Use sampling
fscrape analyze --sample 10000

# Solution 3: Increase timeout
fscrape config set analytics.computation.timeoutMs 60000
```

#### Issue: "Out of memory error"
```bash
# Check memory usage
fscrape analyze memory --usage

# Solution 1: Reduce cache size
fscrape config set analytics.cache.maxSize 104857600

# Solution 2: Enable disk cache
fscrape config set analytics.cache.useDisk true

# Solution 3: Process in batches
fscrape analyze --batch-size 1000
```

#### Issue: "Inaccurate forecasts"
```bash
# Diagnose forecast accuracy
fscrape analyze forecast --validate

# Solution 1: Use more historical data
fscrape analyze forecast --history 90

# Solution 2: Try different methods
fscrape analyze forecast --test-all-methods

# Solution 3: Remove outliers
fscrape analyze forecast --remove-outliers

# Solution 4: Account for seasonality
fscrape analyze forecast --seasonal
```

#### Issue: "Anomalies not detected"
```bash
# Check detection settings
fscrape analyze anomalies --diagnose

# Solution 1: Adjust sensitivity
fscrape config set analytics.anomalies.sensitivity 0.99

# Solution 2: Try different methods
fscrape analyze anomalies --method ensemble

# Solution 3: Increase lookback window
fscrape config set analytics.anomalies.lookbackWindow 200
```

### Diagnostic Commands

```bash
# General diagnostics
fscrape analyze diagnose

# Check configuration
fscrape config validate

# Test database connection
fscrape db test

# Verify analytics modules
fscrape analyze test --all-modules

# Generate diagnostic report
fscrape analyze diagnostic-report --verbose
```

### Debug Mode

```bash
# Enable debug logging
export FSCRAPE_DEBUG=analytics

# Verbose output
fscrape analyze trends --verbose

# Trace execution
fscrape analyze --trace

# Save debug logs
fscrape analyze trends --debug-log debug.log
```

---

## API Reference

### Command Line Interface

#### Basic Syntax
```bash
fscrape analyze <command> [options]
```

#### Global Options
- `--help, -h`: Show help
- `--verbose, -v`: Verbose output
- `--quiet, -q`: Suppress output
- `--format, -f`: Output format (json, csv, table)
- `--output, -o`: Output file path
- `--no-cache`: Disable caching
- `--debug`: Enable debug mode

#### Commands Reference

**Summary**
```bash
fscrape analyze summary [options]
  --days N: Analyze last N days
  --platform PLATFORM: Filter by platform
  --detailed: Show detailed breakdown
```

**Statistics**
```bash
fscrape analyze stats [options]
  --metrics METRICS: Comma-separated metrics
  --groupby FIELD: Group results
  --percentiles: Include percentiles
```

**Trends**
```bash
fscrape analyze trends [options]
  --interval INTERVAL: Time interval (hourly, daily, weekly, monthly)
  --smooth: Apply smoothing
  --decompose: Decompose time series
```

**Anomalies**
```bash
fscrape analyze anomalies [options]
  --method METHOD: Detection method
  --sensitivity LEVEL: Sensitivity (0-1)
  --context N: Include N points of context
```

**Forecast**
```bash
fscrape analyze forecast [options]
  --method METHOD: Forecasting method
  --horizon N: Forecast N periods ahead
  --confidence LEVEL: Confidence interval
```

**Report**
```bash
fscrape analyze report [options]
  --sections SECTIONS: Report sections to include
  --template TEMPLATE: Report template
  --format FORMAT: Output format
```

### Programmatic API

```javascript
// JavaScript/TypeScript
import { Analytics } from 'fscrape';

const analytics = new Analytics({
  database: 'fscrape.db',
  cache: { enabled: true }
});

// Get statistics
const stats = await analytics.getStatistics({
  dateRange: { from: '2024-01-01', to: '2024-12-31' }
});

// Detect anomalies
const anomalies = await analytics.detectAnomalies({
  method: 'isolation',
  sensitivity: 0.95
});

// Generate forecast
const forecast = await analytics.forecast({
  horizon: 30,
  method: 'arima'
});
```

---

## Best Practices

### 1. Data Quality
- Ensure sufficient historical data (30+ days minimum)
- Remove or handle outliers appropriately
- Validate data consistency regularly
- Check for missing values

### 2. Analysis Configuration
- Start with default settings, then tune
- Use ensemble methods for critical decisions
- Validate results with multiple approaches
- Document configuration changes

### 3. Performance
- Enable caching for repeated analyses
- Use sampling for exploratory analysis
- Schedule heavy computations during off-hours
- Monitor resource usage

### 4. Interpretation
- Consider confidence intervals
- Understand method limitations
- Validate against domain knowledge
- Document assumptions

### 5. Automation
- Set up regular reports
- Configure alerts for anomalies
- Automate data quality checks
- Version control configurations

### 6. Security
- Sanitize exported data
- Control access to sensitive metrics
- Audit analytics usage
- Encrypt stored results

---

## Appendix

### Glossary

- **ARIMA**: AutoRegressive Integrated Moving Average
- **IQR**: Interquartile Range
- **LRU**: Least Recently Used
- **MAD**: Median Absolute Deviation
- **MAPE**: Mean Absolute Percentage Error
- **RMSE**: Root Mean Square Error
- **TTL**: Time To Live

### References

1. [Statistical Methods Documentation](./statistics-methods.md)
2. [Anomaly Detection Algorithms](./anomaly-algorithms.md)
3. [Forecasting Techniques](./forecasting-techniques.md)
4. [Visualization Guide](./visualization-guide.md)

### Support

- GitHub Issues: [fscrape/issues](https://github.com/fscrape/issues)
- Documentation: [fscrape.dev/docs](https://fscrape.dev/docs)
- Community: [Discord](https://discord.gg/fscrape)

---

*Last Updated: 2024*
*Version: 1.0.0*