import { describe, it, expect } from 'vitest';
import {
  formatLargeNumber,
  formatPercentage,
  calculatePercentageChange,
  formatTrend,
  getTrendIndicator,
  formatTimePeriod,
  formatEngagementRate,
  getTrendColorClass,
  formatRelativeTime,
  formatPreciseNumber,
} from './formatters';

describe('Number Formatters', () => {
  describe('formatLargeNumber', () => {
    it('should format large numbers correctly', () => {
      expect(formatLargeNumber(0)).toBe('0');
      expect(formatLargeNumber(999)).toBe('999');
      expect(formatLargeNumber(1000)).toBe('1.0K');
      expect(formatLargeNumber(1500)).toBe('1.5K');
      expect(formatLargeNumber(1000000)).toBe('1.0M');
      expect(formatLargeNumber(1500000)).toBe('1.5M');
      expect(formatLargeNumber(1000000000)).toBe('1.0B');
      expect(formatLargeNumber(1500000000)).toBe('1.5B');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages correctly', () => {
      expect(formatPercentage(50.5)).toBe('50.5%');
      expect(formatPercentage(50.567, 2)).toBe('50.57%');
      expect(formatPercentage(100, 0)).toBe('100%');
    });
  });

  describe('calculatePercentageChange', () => {
    it('should calculate percentage change correctly', () => {
      expect(calculatePercentageChange(100, 150)).toBe(50);
      expect(calculatePercentageChange(100, 50)).toBe(-50);
      expect(calculatePercentageChange(0, 100)).toBe(100);
      expect(calculatePercentageChange(0, 0)).toBe(0);
    });
  });

  describe('formatTrend', () => {
    it('should format trend values correctly', () => {
      expect(formatTrend(50)).toBe('+50.0%');
      expect(formatTrend(-25.5)).toBe('-25.5%');
      expect(formatTrend(0)).toBe('0.0%');
      expect(formatTrend(10.567, 2)).toBe('+10.57%');
    });
  });

  describe('getTrendIndicator', () => {
    it('should return correct trend indicators', () => {
      expect(getTrendIndicator(10)).toBe('up');
      expect(getTrendIndicator(-10)).toBe('down');
      expect(getTrendIndicator(0)).toBe('neutral');
    });
  });

  describe('formatTimePeriod', () => {
    it('should format time periods correctly', () => {
      expect(formatTimePeriod('24h')).toBe('Last 24 hours');
      expect(formatTimePeriod('7d')).toBe('Last 7 days');
      expect(formatTimePeriod('30d')).toBe('Last 30 days');
    });
  });

  describe('formatEngagementRate', () => {
    it('should format engagement rate correctly', () => {
      expect(formatEngagementRate(50, 100)).toBe('50.0%');
      expect(formatEngagementRate(0, 100)).toBe('0.0%');
      expect(formatEngagementRate(10, 0)).toBe('0%');
    });
  });

  describe('getTrendColorClass', () => {
    it('should return correct color classes', () => {
      expect(getTrendColorClass('up')).toContain('green');
      expect(getTrendColorClass('down')).toContain('red');
      expect(getTrendColorClass('neutral')).toContain('gray');
    });
  });

  describe('formatRelativeTime', () => {
    it('should format relative time correctly', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(formatRelativeTime(now - 30)).toBe('Just now');
      expect(formatRelativeTime(now - 120)).toBe('2m ago');
      expect(formatRelativeTime(now - 3700)).toBe('1h ago');
      expect(formatRelativeTime(now - 90000)).toBe('1d ago');
    });
  });

  describe('formatPreciseNumber', () => {
    it('should format numbers with appropriate precision', () => {
      expect(formatPreciseNumber(123)).toBe('123');
      expect(formatPreciseNumber(1234)).toBe('1,234');
      expect(formatPreciseNumber(1234567)).toBe('1.2M');
    });
  });
});
