export interface StatisticalSummary {
  mean: number;
  median: number;
  mode: number | null;
  standardDeviation: number;
  variance: number;
  min: number;
  max: number;
  range: number;
  quartiles: {
    q1: number;
    q2: number;
    q3: number;
  };
  iqr: number;
  outliers: number[];
  skewness: number;
  kurtosis: number;
}

export interface CorrelationResult {
  correlation: number;
  pValue: number;
  strength: "strong" | "moderate" | "weak" | "none";
  direction: "positive" | "negative" | "none";
}

export interface RegressionResult {
  slope: number;
  intercept: number;
  rSquared: number;
  predictions: number[];
  residuals: number[];
}

export interface TimeSeriesPoint {
  timestamp: Date;
  value: number;
}

export class StatisticsEngine {
  static calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  static calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  static calculateMode(values: number[]): number | null {
    if (values.length === 0) return null;

    const frequency = new Map<number, number>();
    values.forEach((val) => {
      frequency.set(val, (frequency.get(val) || 0) + 1);
    });

    let maxFreq = 0;
    let mode: number | null = null;
    frequency.forEach((freq, val) => {
      if (freq > maxFreq) {
        maxFreq = freq;
        mode = val;
      }
    });

    return maxFreq > 1 ? mode : null;
  }

  static calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = this.calculateMean(values);
    const squaredDiffs = values.map((val) => Math.pow(val - mean, 2));
    return this.calculateMean(squaredDiffs);
  }

  static calculateStandardDeviation(values: number[]): number {
    return Math.sqrt(this.calculateVariance(values));
  }

  static calculateQuartiles(values: number[]): {
    q1: number;
    q2: number;
    q3: number;
  } {
    if (values.length === 0) return { q1: 0, q2: 0, q3: 0 };

    const sorted = [...values].sort((a, b) => a - b);
    const q2 = this.calculateMedian(sorted);

    const midIndex = Math.floor(sorted.length / 2);
    const lowerHalf = sorted.slice(0, midIndex);
    const upperHalf = sorted.slice(
      sorted.length % 2 === 0 ? midIndex : midIndex + 1,
    );

    const q1 = this.calculateMedian(lowerHalf);
    const q3 = this.calculateMedian(upperHalf);

    return { q1, q2, q3 };
  }

  static detectOutliers(values: number[], threshold: number = 1.5): number[] {
    if (values.length === 0) return [];

    const quartiles = this.calculateQuartiles(values);
    const iqr = quartiles.q3 - quartiles.q1;
    const lowerBound = quartiles.q1 - threshold * iqr;
    const upperBound = quartiles.q3 + threshold * iqr;

    return values.filter((val) => val < lowerBound || val > upperBound);
  }

  static calculateSkewness(values: number[]): number {
    if (values.length < 3) return 0;

    const mean = this.calculateMean(values);
    const stdDev = this.calculateStandardDeviation(values);

    if (stdDev === 0) return 0;

    const n = values.length;
    const sum = values.reduce((acc, val) => {
      return acc + Math.pow((val - mean) / stdDev, 3);
    }, 0);

    return (n / ((n - 1) * (n - 2))) * sum;
  }

  static calculateKurtosis(values: number[]): number {
    if (values.length < 4) return 0;

    const mean = this.calculateMean(values);
    const stdDev = this.calculateStandardDeviation(values);

    if (stdDev === 0) return 0;

    const n = values.length;
    const sum = values.reduce((acc, val) => {
      return acc + Math.pow((val - mean) / stdDev, 4);
    }, 0);

    const factor1 = (n * (n + 1)) / ((n - 1) * (n - 2) * (n - 3));
    const factor2 = (3 * Math.pow(n - 1, 2)) / ((n - 2) * (n - 3));

    return factor1 * sum - factor2;
  }

  static getSummary(values: number[]): StatisticalSummary {
    if (values.length === 0) {
      return {
        mean: 0,
        median: 0,
        mode: null,
        standardDeviation: 0,
        variance: 0,
        min: 0,
        max: 0,
        range: 0,
        quartiles: { q1: 0, q2: 0, q3: 0 },
        iqr: 0,
        outliers: [],
        skewness: 0,
        kurtosis: 0,
      };
    }

    const quartiles = this.calculateQuartiles(values);
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      mean: this.calculateMean(values),
      median: this.calculateMedian(values),
      mode: this.calculateMode(values),
      standardDeviation: this.calculateStandardDeviation(values),
      variance: this.calculateVariance(values),
      min,
      max,
      range: max - min,
      quartiles,
      iqr: quartiles.q3 - quartiles.q1,
      outliers: this.detectOutliers(values),
      skewness: this.calculateSkewness(values),
      kurtosis: this.calculateKurtosis(values),
    };
  }

  static calculateCorrelation(x: number[], y: number[]): CorrelationResult {
    if (x.length !== y.length || x.length === 0) {
      return {
        correlation: 0,
        pValue: 1,
        strength: "none",
        direction: "none",
      };
    }

    const n = x.length;
    const meanX = this.calculateMean(x);
    const meanY = this.calculateMean(y);
    const stdX = this.calculateStandardDeviation(x);
    const stdY = this.calculateStandardDeviation(y);

    if (stdX === 0 || stdY === 0) {
      return {
        correlation: 0,
        pValue: 1,
        strength: "none",
        direction: "none",
      };
    }

    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += (x[i] - meanX) * (y[i] - meanY);
    }
    const correlation =
      sum /
      (Math.sqrt(n * StatisticsEngine.calculateVariance(x)) *
        Math.sqrt(n * StatisticsEngine.calculateVariance(y)));

    const absCorr = Math.abs(correlation);
    let strength: "strong" | "moderate" | "weak" | "none";
    if (absCorr >= 0.7) strength = "strong";
    else if (absCorr >= 0.4) strength = "moderate";
    else if (absCorr >= 0.2) strength = "weak";
    else strength = "none";

    const direction =
      correlation > 0 ? "positive" : correlation < 0 ? "negative" : "none";

    const t =
      correlation * Math.sqrt((n - 2) / (1 - correlation * correlation));
    const pValue = 2 * (1 - this.tDistributionCDF(Math.abs(t), n - 2));

    return {
      correlation,
      pValue,
      strength,
      direction,
    };
  }

  static linearRegression(x: number[], y: number[]): RegressionResult {
    if (x.length !== y.length || x.length === 0) {
      return {
        slope: 0,
        intercept: 0,
        rSquared: 0,
        predictions: [],
        residuals: [],
      };
    }

    const n = x.length;
    const meanX = this.calculateMean(x);
    const meanY = this.calculateMean(y);

    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < n; i++) {
      numerator += (x[i] - meanX) * (y[i] - meanY);
      denominator += Math.pow(x[i] - meanX, 2);
    }

    const slope = denominator !== 0 ? numerator / denominator : 0;
    const intercept = meanY - slope * meanX;

    const predictions = x.map((xi) => slope * xi + intercept);
    const residuals = y.map((yi, i) => yi - predictions[i]);

    let ssRes = 0;
    let ssTot = 0;
    for (let i = 0; i < n; i++) {
      ssRes += Math.pow(residuals[i], 2);
      ssTot += Math.pow(y[i] - meanY, 2);
    }

    const rSquared = ssTot !== 0 ? 1 - ssRes / ssTot : 0;

    return {
      slope,
      intercept,
      rSquared,
      predictions,
      residuals,
    };
  }

  static movingAverage(values: number[], windowSize: number): number[] {
    if (values.length === 0 || windowSize <= 0) return [];
    if (windowSize > values.length) windowSize = values.length;

    const result: number[] = [];
    for (let i = 0; i <= values.length - windowSize; i++) {
      const window = values.slice(i, i + windowSize);
      result.push(this.calculateMean(window));
    }

    return result;
  }

  static exponentialSmoothing(values: number[], alpha: number = 0.3): number[] {
    if (values.length === 0) return [];
    if (alpha < 0 || alpha > 1) alpha = 0.3;

    const result: number[] = [values[0]];
    for (let i = 1; i < values.length; i++) {
      const smoothed = alpha * values[i] + (1 - alpha) * result[i - 1];
      result.push(smoothed);
    }

    return result;
  }

  static detectSeasonality(
    timeSeries: TimeSeriesPoint[],
    periodDays: number = 7,
  ): {
    hasSeasonality: boolean;
    strength: number;
    pattern: number[];
  } {
    if (timeSeries.length < periodDays * 2) {
      return { hasSeasonality: false, strength: 0, pattern: [] };
    }

    const values = timeSeries.map((point) => point.value);
    const detrended = this.detrend(values);

    const periods = Math.floor(detrended.length / periodDays);
    const pattern: number[] = [];

    for (let i = 0; i < periodDays; i++) {
      const periodValues: number[] = [];
      for (let j = 0; j < periods; j++) {
        const index = j * periodDays + i;
        if (index < detrended.length) {
          periodValues.push(detrended[index]);
        }
      }
      pattern.push(this.calculateMean(periodValues));
    }

    const patternVariance = this.calculateVariance(pattern);
    const totalVariance = this.calculateVariance(detrended);
    const strength = totalVariance > 0 ? patternVariance / totalVariance : 0;

    return {
      hasSeasonality: strength > 0.1,
      strength,
      pattern,
    };
  }

  private static detrend(values: number[]): number[] {
    const x = values.map((_, i) => i);
    const regression = this.linearRegression(x, values);
    return values.map(
      (val, i) => val - (regression.slope * i + regression.intercept),
    );
  }

  private static tDistributionCDF(t: number, df: number): number {
    const x = df / (df + t * t);
    const a = df / 2;
    const b = 0.5;
    return 1 - 0.5 * this.incompleteBeta(x, a, b);
  }

  private static incompleteBeta(x: number, a: number, b: number): number {
    if (x < 0 || x > 1) return 0;
    if (x === 0) return 0;
    if (x === 1) return 1;

    const lnBeta = this.lnGamma(a) + this.lnGamma(b) - this.lnGamma(a + b);
    const lnPrefactor = a * Math.log(x) + b * Math.log(1 - x) - lnBeta;
    const prefactor = Math.exp(lnPrefactor);

    if (x < (a + 1) / (a + b + 2)) {
      return (prefactor * this.betaContinuedFraction(x, a, b)) / a;
    } else {
      return 1 - (prefactor * this.betaContinuedFraction(1 - x, b, a)) / b;
    }
  }

  private static betaContinuedFraction(
    x: number,
    a: number,
    b: number,
  ): number {
    const maxIterations = 100;
    const epsilon = 1e-10;

    const qab = a + b;
    const qap = a + 1;
    const qam = a - 1;

    let c = 1;
    let d = 1 - (qab * x) / qap;
    if (Math.abs(d) < epsilon) d = epsilon;
    d = 1 / d;
    let h = d;

    for (let m = 1; m <= maxIterations; m++) {
      const m2 = 2 * m;
      let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < epsilon) d = epsilon;
      c = 1 + aa / c;
      if (Math.abs(c) < epsilon) c = epsilon;
      d = 1 / d;
      h *= d * c;

      aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
      d = 1 + aa * d;
      if (Math.abs(d) < epsilon) d = epsilon;
      c = 1 + aa / c;
      if (Math.abs(c) < epsilon) c = epsilon;
      d = 1 / d;
      const del = d * c;
      h *= del;

      if (Math.abs(del - 1) < epsilon) break;
    }

    return h;
  }

  private static lnGamma(x: number): number {
    const cof = [
      76.18009172947146, -86.50532032941677, 24.01409824083091,
      -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5,
    ];

    let y = x;
    let tmp = x + 5.5;
    tmp -= (x + 0.5) * Math.log(tmp);

    let ser = 1.000000000190015;
    for (let j = 0; j < 6; j++) {
      ser += cof[j] / ++y;
    }

    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  }

  static calculateZScore(value: number, mean: number, stdDev: number): number {
    if (stdDev === 0) return 0;
    return (value - mean) / stdDev;
  }

  static normalizeValues(values: number[]): number[] {
    if (values.length === 0) return [];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    if (range === 0) return values.map(() => 0.5);

    return values.map((val) => (val - min) / range);
  }

  static standardizeValues(values: number[]): number[] {
    if (values.length === 0) return [];

    const mean = this.calculateMean(values);
    const stdDev = this.calculateStandardDeviation(values);

    if (stdDev === 0) return values.map(() => 0);

    return values.map((val) => (val - mean) / stdDev);
  }
}
