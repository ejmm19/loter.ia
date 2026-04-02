/**
 * Statistical models for lottery prediction.
 * Phase 2b: Motor de predicción AI
 */

export interface DrawResult {
  drawDate: string;
  numbers: number[];
  specialNumbers?: number[];
}

export interface FrequencyMap {
  [number: number]: number;
}

export interface NumberScore {
  number: number;
  score: number;
  frequency: number;
  recencyBoost: number;
  trend: 'hot' | 'cold' | 'neutral';
  lastSeenDaysAgo: number;
}

export interface StatisticalPrediction {
  suggestedNumbers: number[];
  scores: NumberScore[];
  hotNumbers: number[];
  coldNumbers: number[];
  movingAverageTop: number[];
  combinationScore: number;
  confidence: number;
  method: 'statistical';
}

/**
 * Calculate weighted frequency with recency bias.
 * More recent draws carry exponentially higher weight.
 */
export function weightedFrequency(
  draws: DrawResult[],
  maxNumbers: number,
  decayFactor = 0.97
): FrequencyMap {
  const freq: FrequencyMap = {};
  const n = draws.length;

  for (let i = 0; i < n; i++) {
    const age = n - 1 - i; // 0 = most recent
    const weight = Math.pow(decayFactor, age);
    for (const num of draws[i].numbers) {
      freq[num] = (freq[num] ?? 0) + weight;
    }
  }
  return freq;
}

/**
 * Moving average of appearances over last K draws.
 * Returns a score per number proportional to recent activity.
 */
export function movingAverageScore(
  draws: DrawResult[],
  windowSize = 10
): FrequencyMap {
  const scores: FrequencyMap = {};
  const window = draws.slice(-windowSize);

  for (const draw of window) {
    for (const num of draw.numbers) {
      scores[num] = (scores[num] ?? 0) + 1;
    }
  }
  // Normalize 0–1
  const maxVal = Math.max(...Object.values(scores), 1);
  for (const k in scores) {
    scores[k] = scores[k] / maxVal;
  }
  return scores;
}

/**
 * Identify hot streaks (appeared in last N consecutive draws)
 * and cold streaks (not appeared in last M draws).
 */
export function hotColdStreaks(
  draws: DrawResult[],
  hotWindow = 5,
  coldWindow = 15,
  maxNum = 49
): { hot: number[]; cold: number[] } {
  const recentHot = new Set<number>();
  const seenInCold = new Set<number>();

  const last5 = draws.slice(-hotWindow);
  const last15 = draws.slice(-coldWindow);

  for (const draw of last5) {
    for (const n of draw.numbers) recentHot.add(n);
  }
  for (const draw of last15) {
    for (const n of draw.numbers) seenInCold.add(n);
  }

  const hot = Array.from(recentHot).filter((n) => {
    let count = 0;
    for (const draw of last5) {
      if (draw.numbers.includes(n)) count++;
    }
    return count >= 3; // appeared in at least 3 of last 5
  });

  const cold: number[] = [];
  for (let i = 1; i <= maxNum; i++) {
    if (!seenInCold.has(i)) cold.push(i);
  }

  return { hot, cold };
}

/**
 * Score potential number combinations for co-occurrence probability.
 * Uses historical pair frequencies to estimate joint probability.
 */
export function combinationScore(
  numbers: number[],
  draws: DrawResult[]
): number {
  if (numbers.length < 2) return 1;

  let pairScore = 0;
  let pairs = 0;

  for (let i = 0; i < numbers.length; i++) {
    for (let j = i + 1; j < numbers.length; j++) {
      const a = numbers[i];
      const b = numbers[j];
      let coCount = 0;
      for (const draw of draws) {
        if (draw.numbers.includes(a) && draw.numbers.includes(b)) coCount++;
      }
      pairScore += coCount / draws.length;
      pairs++;
    }
  }

  return pairs > 0 ? pairScore / pairs : 0;
}

/**
 * Main statistical prediction engine.
 * Combines weighted frequency, moving averages, and hot/cold analysis.
 */
export function generateStatisticalPrediction(
  draws: DrawResult[],
  pickCount: number,
  maxNum: number,
  todayDate: string
): StatisticalPrediction {
  if (draws.length === 0) {
    throw new Error('No draw history available for statistical prediction');
  }

  const wf = weightedFrequency(draws, maxNum);
  const ma = movingAverageScore(draws, Math.min(10, draws.length));
  const { hot, cold } = hotColdStreaks(draws, 5, 15, maxNum);

  // Build composite score for every number
  const scores: NumberScore[] = [];

  for (let num = 1; num <= maxNum; num++) {
    const freq = wf[num] ?? 0;
    const maScore = ma[num] ?? 0;
    const recencyBoost = hot.includes(num) ? 0.2 : cold.includes(num) ? -0.1 : 0;

    // Find last seen
    let lastSeenDaysAgo = 9999;
    for (let i = draws.length - 1; i >= 0; i--) {
      if (draws[i].numbers.includes(num)) {
        const drawDate = new Date(draws[i].drawDate);
        const today = new Date(todayDate);
        lastSeenDaysAgo = Math.floor(
          (today.getTime() - drawDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        break;
      }
    }

    const composite = freq * 0.5 + maScore * 0.3 + recencyBoost;
    const trend: 'hot' | 'cold' | 'neutral' = hot.includes(num)
      ? 'hot'
      : cold.includes(num)
      ? 'cold'
      : 'neutral';

    scores.push({ number: num, score: composite, frequency: freq, recencyBoost, trend, lastSeenDaysAgo });
  }

  scores.sort((a, b) => b.score - a.score);
  const topNumbers = scores.slice(0, pickCount).map((s) => s.number);
  const movingAverageTop = Object.entries(ma)
    .sort(([, a], [, b]) => b - a)
    .slice(0, pickCount)
    .map(([n]) => Number(n));

  const comboScore = combinationScore(topNumbers, draws);

  // Confidence: based on amount of data and internal consistency
  const dataConfidence = Math.min(draws.length / 100, 1);
  const comboConfidence = Math.min(comboScore * 5, 1);
  const confidence = Math.round((dataConfidence * 0.6 + comboConfidence * 0.4) * 100);

  return {
    suggestedNumbers: topNumbers.sort((a, b) => a - b),
    scores: scores.slice(0, pickCount * 3),
    hotNumbers: hot.slice(0, 10),
    coldNumbers: cold.slice(0, 10),
    movingAverageTop,
    combinationScore: comboScore,
    confidence,
    method: 'statistical',
  };
}
