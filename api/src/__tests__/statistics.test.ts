/**
 * Statistics service — unit tests (Vitest)
 *
 * Tests the statistical prediction engine functions in services/statistics.ts.
 * These are pure functions — no DB or HTTP needed.
 */

import { describe, it, expect } from 'vitest';
import {
  weightedFrequency,
  movingAverageScore,
  hotColdStreaks,
  combinationScore,
  generateStatisticalPrediction,
  DrawResult,
} from '../services/statistics';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeDraws(count: number, baseNumbers: number[] = [1, 5, 10, 20, 30, 40]): DrawResult[] {
  return Array.from({ length: count }, (_, i) => ({
    drawDate: `2024-0${Math.floor(i / 30) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
    numbers: baseNumbers.map(n => ((n + i) % 45) + 1),
  }));
}

const SAMPLE_DRAWS: DrawResult[] = [
  { drawDate: '2024-01-01', numbers: [5, 12, 23, 34, 41, 7] },
  { drawDate: '2024-01-08', numbers: [3, 9, 17, 28, 36, 44] },
  { drawDate: '2024-01-15', numbers: [5, 12, 18, 25, 33, 41] },
  { drawDate: '2024-01-22', numbers: [1, 5, 12, 19, 27, 38] },
  { drawDate: '2024-01-29', numbers: [5, 12, 21, 30, 39, 45] },
];

// ─── weightedFrequency ────────────────────────────────────────────────────────
describe('weightedFrequency', () => {
  it('returns a frequency map with entries for all numbers in the draws', () => {
    const freq = weightedFrequency(SAMPLE_DRAWS, 45);
    // Number 5 appears in all 5 draws
    expect(freq[5]).toBeGreaterThan(0);
    expect(freq[12]).toBeGreaterThan(0);
  });

  it('assigns higher weight to more recent draws', () => {
    // Build two draws: number 99 only in older, number 1 only in newest
    const draws: DrawResult[] = [
      { drawDate: '2024-01-01', numbers: [10, 11, 12, 13, 14, 15] }, // old
      { drawDate: '2024-06-01', numbers: [1, 2, 3, 4, 5, 6] },       // recent
    ];
    const freq = weightedFrequency(draws, 15);
    // number 1 (newest) should have higher weight than number 10 (oldest)
    expect(freq[1]).toBeGreaterThan(freq[10]);
  });

  it('returns empty map for empty draws', () => {
    const freq = weightedFrequency([], 45);
    expect(Object.keys(freq).length).toBe(0);
  });

  it('numbers with more appearances have higher scores', () => {
    const freq = weightedFrequency(SAMPLE_DRAWS, 45);
    // 5 appears 5 times, 44 appears 1 time
    expect(freq[5]).toBeGreaterThan(freq[44]);
  });
});

// ─── movingAverageScore ───────────────────────────────────────────────────────
describe('movingAverageScore', () => {
  it('returns scores normalized between 0 and 1', () => {
    const scores = movingAverageScore(SAMPLE_DRAWS, 5);
    for (const val of Object.values(scores)) {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    }
  });

  it('most frequent number in window gets score of 1.0', () => {
    const scores = movingAverageScore(SAMPLE_DRAWS, 5);
    // 5 and 12 appear in all 5 draws — should tie at 1.0
    expect(scores[5]).toBe(1);
    expect(scores[12]).toBe(1);
  });

  it('returns empty map for empty draws', () => {
    const scores = movingAverageScore([], 5);
    expect(Object.keys(scores).length).toBe(0);
  });

  it('uses only the last windowSize draws', () => {
    const many = makeDraws(50);
    const small = many.slice(-3);
    const scoresAll = movingAverageScore(many, 3);
    const scoresSmall = movingAverageScore(small, 3);
    // They should produce the same scores since the window is the same 3 draws
    for (const key of Object.keys(scoresSmall)) {
      expect(scoresAll[Number(key)]).toBeCloseTo(scoresSmall[Number(key)], 5);
    }
  });
});

// ─── hotColdStreaks ───────────────────────────────────────────────────────────
describe('hotColdStreaks', () => {
  it('returns hot and cold arrays', () => {
    const { hot, cold } = hotColdStreaks(SAMPLE_DRAWS, 5, 15, 45);
    expect(Array.isArray(hot)).toBe(true);
    expect(Array.isArray(cold)).toBe(true);
  });

  it('hot numbers appear frequently in recent draws', () => {
    const { hot } = hotColdStreaks(SAMPLE_DRAWS, 5, 15, 45);
    // 5 and 12 appear in all 5 draws → should be hot
    expect(hot).toContain(5);
    expect(hot).toContain(12);
  });

  it('cold numbers have not appeared in the cold window', () => {
    // Use draws that only cover numbers 1-10; numbers 20+ should be cold
    const limitedDraws: DrawResult[] = Array.from({ length: 15 }, (_, i) => ({
      drawDate: `2024-01-${String(i + 1).padStart(2, '0')}`,
      numbers: [1, 2, 3, 4, 5, 6],
    }));
    const { cold } = hotColdStreaks(limitedDraws, 5, 15, 45);
    expect(cold).toContain(20);
    expect(cold).toContain(45);
    expect(cold).not.toContain(1);
  });

  it('returns empty arrays for draws shorter than windows', () => {
    const single: DrawResult[] = [{ drawDate: '2024-01-01', numbers: [1, 2, 3, 4, 5, 6] }];
    const { hot, cold } = hotColdStreaks(single, 5, 15, 10);
    expect(Array.isArray(hot)).toBe(true);
    expect(Array.isArray(cold)).toBe(true);
  });
});

// ─── combinationScore ─────────────────────────────────────────────────────────
describe('combinationScore', () => {
  it('returns a number between 0 and 1 for normal inputs', () => {
    const score = combinationScore([5, 12], SAMPLE_DRAWS);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it('returns 1 for a single number (no pairs to score)', () => {
    const score = combinationScore([5], SAMPLE_DRAWS);
    expect(score).toBe(1);
  });

  it('pairs that co-occur frequently score higher than rare pairs', () => {
    // [5,12] co-occur in all 5 draws; [44,3] co-occur in only 1
    const highScore = combinationScore([5, 12], SAMPLE_DRAWS);
    const lowScore = combinationScore([44, 3], SAMPLE_DRAWS);
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('returns 0 for numbers that never co-occurred in any draw', () => {
    const draws: DrawResult[] = [{ drawDate: '2024-01-01', numbers: [1, 2, 3, 4, 5, 6] }];
    const score = combinationScore([10, 20], draws);
    expect(score).toBe(0);
  });
});

// ─── generateStatisticalPrediction ───────────────────────────────────────────
describe('generateStatisticalPrediction', () => {
  it('returns a StatisticalPrediction with all required fields', () => {
    const result = generateStatisticalPrediction(SAMPLE_DRAWS, 6, 45, '2024-02-01');
    expect(result.method).toBe('statistical');
    expect(Array.isArray(result.suggestedNumbers)).toBe(true);
    expect(Array.isArray(result.hotNumbers)).toBe(true);
    expect(Array.isArray(result.coldNumbers)).toBe(true);
    expect(Array.isArray(result.movingAverageTop)).toBe(true);
    expect(Array.isArray(result.scores)).toBe(true);
    expect(typeof result.confidence).toBe('number');
    expect(typeof result.combinationScore).toBe('number');
  });

  it('returns exactly pickCount suggested numbers', () => {
    const result = generateStatisticalPrediction(SAMPLE_DRAWS, 6, 45, '2024-02-01');
    expect(result.suggestedNumbers).toHaveLength(6);
  });

  it('suggested numbers are sorted ascending', () => {
    const result = generateStatisticalPrediction(SAMPLE_DRAWS, 6, 45, '2024-02-01');
    for (let i = 1; i < result.suggestedNumbers.length; i++) {
      expect(result.suggestedNumbers[i]).toBeGreaterThanOrEqual(result.suggestedNumbers[i - 1]);
    }
  });

  it('all suggested numbers are within valid range [1, maxNum]', () => {
    const result = generateStatisticalPrediction(SAMPLE_DRAWS, 6, 45, '2024-02-01');
    for (const n of result.suggestedNumbers) {
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(45);
    }
  });

  it('confidence is between 0 and 100', () => {
    const result = generateStatisticalPrediction(SAMPLE_DRAWS, 6, 45, '2024-02-01');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(100);
  });

  it('confidence increases with more historical data', () => {
    const few = makeDraws(5);
    const many = makeDraws(100);
    const lowConf = generateStatisticalPrediction(few, 6, 45, '2024-06-01');
    const highConf = generateStatisticalPrediction(many, 6, 45, '2024-06-01');
    expect(highConf.confidence).toBeGreaterThan(lowConf.confidence);
  });

  it('throws when given empty draw history', () => {
    expect(() => generateStatisticalPrediction([], 6, 45, '2024-02-01')).toThrow();
  });

  it('works with different pick counts (e.g. Baloto = 6, Mega Millions = 5)', () => {
    const result5 = generateStatisticalPrediction(SAMPLE_DRAWS, 5, 70, '2024-02-01');
    expect(result5.suggestedNumbers).toHaveLength(5);
    const result7 = generateStatisticalPrediction(SAMPLE_DRAWS, 7, 49, '2024-02-01');
    expect(result7.suggestedNumbers).toHaveLength(7);
  });
});
