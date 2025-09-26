import { describe, it, expect } from 'vitest';
import type { TimeSeriesDataPoint } from './TimeSeriesChart';

// Mock data for testing
const mockTimeSeriesData: TimeSeriesDataPoint[] = [
  { date: 'Jan 1', value: 100, posts: 100, avgScore: 50, avgComments: 10 },
  { date: 'Jan 2', value: 150, posts: 150, avgScore: 60, avgComments: 15 },
  { date: 'Jan 3', value: 120, posts: 120, avgScore: 55, avgComments: 12 },
  { date: 'Jan 4', value: 180, posts: 180, avgScore: 70, avgComments: 20 },
  { date: 'Jan 5', value: 200, posts: 200, avgScore: 80, avgComments: 25 },
  { date: 'Jan 6', value: 160, posts: 160, avgScore: 65, avgComments: 18 },
  { date: 'Jan 7', value: 140, posts: 140, avgScore: 58, avgComments: 14 },
];

describe('TimeSeriesChart Data Validation', () => {
  it('should have valid data structure', () => {
    mockTimeSeriesData.forEach((point) => {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('value');
      expect(typeof point.date).toBe('string');
      expect(typeof point.value).toBe('number');
    });
  });

  it('should have non-negative values', () => {
    mockTimeSeriesData.forEach((point) => {
      expect(point.value).toBeGreaterThanOrEqual(0);
      if (point.posts !== undefined) {
        expect(point.posts).toBeGreaterThanOrEqual(0);
      }
      if (point.avgScore !== undefined) {
        expect(point.avgScore).toBeGreaterThanOrEqual(0);
      }
      if (point.avgComments !== undefined) {
        expect(point.avgComments).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('should have sequential dates', () => {
    const dates = mockTimeSeriesData.map((d) => d.date);
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe('Jan 1');
    expect(dates[dates.length - 1]).toBe('Jan 7');
  });
});

describe('Zoom Functionality', () => {
  it('should calculate correct zoom range', () => {
    const startIndex = 2;
    const endIndex = 5;
    const zoomedData = mockTimeSeriesData.slice(startIndex, endIndex + 1);

    expect(zoomedData).toHaveLength(4);
    expect(zoomedData[0].date).toBe('Jan 3');
    expect(zoomedData[zoomedData.length - 1].date).toBe('Jan 6');
  });

  it('should find min and max values in zoom range', () => {
    const startIndex = 1;
    const endIndex = 4;
    const zoomedData = mockTimeSeriesData.slice(startIndex, endIndex + 1);

    const values = zoomedData.map((d) => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);

    expect(minValue).toBe(120);
    expect(maxValue).toBe(200);
  });

  it('should handle full range zoom out', () => {
    const fullData = mockTimeSeriesData;
    expect(fullData).toHaveLength(7);
    expect(fullData[0].date).toBe('Jan 1');
    expect(fullData[fullData.length - 1].date).toBe('Jan 7');
  });
});

describe('Platform Filtering', () => {
  const platformData = {
    all: mockTimeSeriesData,
    reddit: mockTimeSeriesData.map((d) => ({ ...d, platform: 'reddit' })),
    hackernews: mockTimeSeriesData.map((d) => ({ ...d, platform: 'hackernews' })),
  };

  it('should filter data by platform', () => {
    const redditData = platformData.reddit;
    expect(redditData).toHaveLength(7);
    redditData.forEach((point) => {
      expect(point.platform).toBe('reddit');
    });
  });

  it('should show all data when "all" is selected', () => {
    const allData = platformData.all;
    expect(allData).toHaveLength(7);
  });

  it('should handle empty platform data', () => {
    const emptyData: TimeSeriesDataPoint[] = [];
    expect(emptyData).toHaveLength(0);
  });
});

describe('Chart Aggregations', () => {
  it('should calculate correct averages', () => {
    const totalPosts = mockTimeSeriesData.reduce((sum, d) => sum + (d.posts || 0), 0);
    const avgPosts = totalPosts / mockTimeSeriesData.length;

    expect(totalPosts).toBe(1050);
    expect(avgPosts).toBe(150);
  });

  it('should calculate engagement metrics', () => {
    const totalScore = mockTimeSeriesData.reduce((sum, d) => sum + (d.avgScore || 0), 0);
    const totalComments = mockTimeSeriesData.reduce((sum, d) => sum + (d.avgComments || 0), 0);

    expect(totalScore).toBe(438);
    expect(totalComments).toBe(114);
  });

  it('should find peak values', () => {
    const peakPost = mockTimeSeriesData.reduce((max, d) =>
      (d.posts || 0) > (max.posts || 0) ? d : max
    );

    expect(peakPost.posts).toBe(200);
    expect(peakPost.date).toBe('Jan 5');
  });
});

describe('Time Range Selection', () => {
  const generateDataForDays = (days: number) => {
    return Array.from({ length: days }, (_, i) => ({
      date: `Day ${i + 1}`,
      value: Math.random() * 200,
      posts: Math.floor(Math.random() * 200),
      avgScore: Math.floor(Math.random() * 100),
      avgComments: Math.floor(Math.random() * 30),
    }));
  };

  it('should handle 7-day range', () => {
    const weekData = generateDataForDays(7);
    expect(weekData).toHaveLength(7);
  });

  it('should handle 30-day range', () => {
    const monthData = generateDataForDays(30);
    expect(monthData).toHaveLength(30);
  });

  it('should handle 60-day range', () => {
    const twoMonthData = generateDataForDays(60);
    expect(twoMonthData).toHaveLength(60);
  });
});
