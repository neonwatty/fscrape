# Analytics User Guide

## Table of Contents
1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Command Line Usage](#command-line-usage)
4. [Understanding Analytics](#understanding-analytics)
5. [Configuration](#configuration)
6. [Examples and Tutorials](#examples-and-tutorials)
7. [Troubleshooting](#troubleshooting)

## Introduction

The fscrape analytics feature provides powerful data analysis capabilities for your scraped forum data. It includes trend analysis, anomaly detection, forecasting, and comprehensive visualizations - all from your terminal.

### Key Features
- **Trend Analysis**: Identify patterns and trends in your data
- **Anomaly Detection**: Spot unusual patterns and outliers
- **Forecasting**: Predict future values based on historical data
- **Visualizations**: Terminal-based charts and graphs
- **Performance**: Optimized for large datasets with intelligent caching

## Getting Started

### Prerequisites
Ensure you have scraped data in your database before running analytics commands:

```bash
# Check if you have data
fscrape status

# If needed, scrape some data first
fscrape scrape https://example-forum.com --limit 100
```

### Quick Start
Run your first analytics command:

```bash
# Analyze trends in your scraped data
fscrape analyze trends

# Get a comprehensive analytics report
fscrape analyze report
```

## Command Line Usage

### Basic Commands

#### Trend Analysis
Identify trends and patterns in your data:

```bash
# Basic trend analysis
fscrape analyze trends

# Analyze specific time period
fscrape analyze trends --days 30

# Focus on specific platform
fscrape analyze trends --platform reddit

# Include seasonality detection
fscrape analyze trends --seasonal
```

#### Anomaly Detection
Find unusual patterns and outliers:

```bash
# Detect anomalies
fscrape analyze anomalies

# Adjust sensitivity (0.9 = less sensitive, 0.99 = more sensitive)
fscrape analyze anomalies --sensitivity 0.95

# Use specific detection method
fscrape analyze anomalies --method statistical
```

#### Forecasting
Predict future values:

```bash
# Generate forecast for next 7 days
fscrape analyze forecast

# Forecast for specific period
fscrape analyze forecast --horizon 30

# Use specific forecasting method
fscrape analyze forecast --method exponential
```

#### Comparison Analysis
Compare different time periods or platforms:

```bash
# Compare platforms
fscrape analyze compare --platforms reddit,hackernews

# Compare time periods
fscrape analyze compare --period1 "2024-01-01" --period2 "2024-02-01"

# Week-over-week comparison
fscrape analyze compare --type week-over-week
```

### Advanced Commands

#### Custom Analytics Pipeline
Run multiple analyses together:

```bash
# Full analytics report
fscrape analyze report --include trends,anomalies,forecast

# Export results
fscrape analyze report --export json --output analytics.json

# With visualizations
fscrape analyze report --visualize
```

#### Real-time Monitoring
Monitor incoming data in real-time:

```bash
# Start monitoring mode
fscrape analyze monitor

# Monitor with specific refresh rate
fscrape analyze monitor --interval 60

# Monitor specific metrics
fscrape analyze monitor --metrics posts,comments,users
```

### Output Options

#### Visualization Types
Control how results are displayed:

```bash
# Sparkline charts (compact)
fscrape analyze trends --chart sparkline

# Bar charts
fscrape analyze trends --chart bar

# Table format
fscrape analyze trends --chart table

# Disable colors
fscrape analyze trends --no-color
```

#### Export Formats
Export analytics results:

```bash
# JSON format
fscrape analyze trends --export json --output trends.json

# CSV format
fscrape analyze trends --export csv --output trends.csv

# HTML report
fscrape analyze report --export html --output report.html

# Markdown format
fscrape analyze trends --export markdown --output trends.md
```

## Understanding Analytics

### Trend Analysis

Trends show the direction and strength of changes in your data over time.

**Trend Types:**
- **Increasing**: Consistent upward movement
- **Decreasing**: Consistent downward movement
- **Stable**: No significant change
- **Volatile**: High variation without clear direction

**Key Metrics:**
- **Slope**: Rate of change (positive = increasing, negative = decreasing)
- **Confidence**: How certain the trend is (0-100%)
- **Change Points**: Moments where the trend significantly changed
- **Seasonality**: Recurring patterns (daily, weekly, monthly)

**Example Output:**
```
📈 Trend Analysis Results
═══════════════════════════════════════════
Period: Last 30 days
Trend: INCREASING ↑
Slope: +45.3 posts/day
Confidence: 94.2%

Change Points Detected: 2
  • Day 12: Significant increase (+120%)
  • Day 23: Moderate decrease (-35%)

Seasonal Patterns:
  • Weekly: Strong (peaks on Mondays)
  • Daily: Moderate (peaks at 2 PM)
```

### Anomaly Detection

Anomalies are data points that significantly differ from the expected pattern.

**Anomaly Types:**
- **Point Anomalies**: Single unusual values
- **Contextual Anomalies**: Normal values in wrong context
- **Collective Anomalies**: Unusual patterns in sequences

**Detection Methods:**
- **Statistical**: Based on standard deviation (z-score)
- **IQR**: Interquartile range method
- **Isolation**: Isolation forest algorithm

**Example Output:**
```
🔍 Anomaly Detection Results
═══════════════════════════════════════════
Found 3 anomalies in 1,000 data points

High Severity:
  • 2024-01-15 14:30 - Posts: 1,250 (expected: ~200)
    Score: 0.98 | Type: Point anomaly

Medium Severity:
  • 2024-01-20 02:00 - Comments: 450 (expected: ~50)
    Score: 0.85 | Type: Contextual anomaly
```

### Forecasting

Predictions of future values based on historical patterns.

**Forecasting Methods:**
- **Linear**: Simple linear trend projection
- **Exponential**: Exponential smoothing for trends
- **ARIMA**: Advanced time series modeling
- **Moving Average**: Average of recent values

**Confidence Intervals:**
- Shows the range where future values are likely to fall
- 95% confidence = 95% chance the actual value will be in this range

**Example Output:**
```
📊 Forecast Results
═══════════════════════════════════════════
Method: Exponential Smoothing
Horizon: Next 7 days
Confidence: 95%

Predictions:
  Day 1: 245 posts [230-260]
  Day 2: 248 posts [228-268]
  Day 3: 252 posts [225-279]
  ...

Accuracy Metrics:
  • MAPE: 8.3% (Very Good)
  • RMSE: 12.5
```

## Configuration

### Configuration File
Create a custom configuration in `fscrape.config.json`:

```json
{
  "analytics": {
    "enabled": true,
    "cache": {
      "enabled": true,
      "memoryMaxSize": 200,
      "ttl": 7200
    },
    "trends": {
      "minDataPoints": 20,
      "confidenceThreshold": 0.95,
      "seasonalityDetection": true,
      "changePointSensitivity": "medium"
    },
    "anomalies": {
      "enabled": true,
      "methods": ["statistical", "iqr"],
      "sensitivity": 0.95,
      "minSampleSize": 30
    },
    "forecasting": {
      "enabled": true,
      "methods": ["linear", "exponential"],
      "horizon": 30,
      "confidenceIntervals": true
    },
    "visualization": {
      "enabled": true,
      "colorOutput": true,
      "chartTypes": ["sparkline", "table"],
      "maxWidth": 120
    }
  }
}
```

### Environment Variables
Override configuration with environment variables:

```bash
# Disable caching
export FSCRAPE_ANALYTICS_CACHE_ENABLED=false

# Increase sensitivity
export FSCRAPE_ANALYTICS_ANOMALY_SENSITIVITY=0.99

# Change visualization width
export FSCRAPE_ANALYTICS_VIZ_WIDTH=80
```

## Examples and Tutorials

### Example 1: Weekly Trend Report
Generate a weekly trend report for your forum:

```bash
# Analyze last week's data
fscrape analyze trends --days 7

# Compare to previous week
fscrape analyze compare --type week-over-week

# Export for sharing
fscrape analyze report --days 7 --export html --output weekly-report.html
```

### Example 2: Anomaly Investigation
Investigate unusual activity:

```bash
# Detect anomalies in last 30 days
fscrape analyze anomalies --days 30

# Focus on specific metric
fscrape analyze anomalies --metric comment_count --sensitivity 0.99

# Get detailed context
fscrape analyze anomalies --verbose --context 10
```

### Example 3: Forecasting Dashboard
Create a forecasting dashboard:

```bash
# Generate 30-day forecast
fscrape analyze forecast --horizon 30

# Include confidence intervals
fscrape analyze forecast --confidence 95

# Monitor and update
fscrape analyze monitor --metrics posts,forecast --interval 3600
```

### Example 4: Platform Comparison
Compare multiple platforms:

```bash
# Compare all platforms
fscrape analyze compare --platforms all

# Specific comparison
fscrape analyze compare --platforms reddit,hackernews --days 30

# Export comparison
fscrape analyze compare --export csv --output platform-comparison.csv
```

## Troubleshooting

### Common Issues

#### "Insufficient data for analysis"
**Problem**: Not enough data points for meaningful analysis.
**Solution**:
- Scrape more data: `fscrape scrape <url> --limit 100`
- Lower the minimum data points in configuration
- Use a shorter time period for analysis

#### "Cache out of memory"
**Problem**: Analytics cache consuming too much memory.
**Solution**:
- Clear cache: `fscrape analyze --clear-cache`
- Reduce cache size in configuration
- Disable memory cache and use disk cache only

#### "Forecast accuracy is low"
**Problem**: Predictions have high error rates.
**Solution**:
- Use more historical data
- Try different forecasting methods
- Check for anomalies that might skew predictions
- Consider seasonal adjustments

#### "Visualizations not displaying correctly"
**Problem**: Charts appear broken or misaligned.
**Solution**:
- Check terminal width: `echo $COLUMNS`
- Adjust visualization width in configuration
- Use simpler chart types (sparkline, table)
- Disable colors if terminal doesn't support them

### Performance Tips

1. **Enable Caching**: Significantly speeds up repeated analyses
2. **Use Sampling**: For datasets over 100K points, enable sampling
3. **Parallel Processing**: Enable for multi-core systems
4. **Optimize Queries**: Use time filters to limit data
5. **Disk Cache**: Use for large datasets that don't fit in memory

### Getting Help

```bash
# View command help
fscrape analyze --help

# View specific command help
fscrape analyze trends --help

# Check analytics status
fscrape analyze status

# Run diagnostics
fscrape analyze diagnose
```

## Best Practices

1. **Regular Analysis**: Run analytics regularly to track changes
2. **Baseline Establishment**: Build up historical data for better predictions
3. **Sensitivity Tuning**: Adjust sensitivity based on your data characteristics
4. **Export Important Results**: Save significant findings for future reference
5. **Monitor Anomalies**: Set up alerts for unusual patterns
6. **Validate Forecasts**: Compare predictions with actual values
7. **Use Appropriate Methods**: Choose analysis methods that fit your data

## Next Steps

- Explore the [API Documentation](./analytics-api.md) for programmatic access
- Review [Architecture Decisions](./trend-analysis-architecture.md) for technical details
- Check [Implementation Guide](./trend-analysis-implementation.md) for customization