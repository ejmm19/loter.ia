/**
 * Angular service for the Phase 2a analysis API.
 * Wraps /api/analysis/* endpoints.
 */
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Response types ────────────────────────────────────────────────────────────

export interface FrequencyEntry {
  number: number;
  count: number;
  percentage: number;
}

export interface FrequencyResponse {
  frequency: FrequencyEntry[];
  totalDraws: number;
}

export interface HotColdEntry {
  number: number;
  recentCount: number;
  historicalCount: number;
  histRate: number;
  recentRate: number;
  score: number;
}

export interface HotColdResponse {
  hot: HotColdEntry[];
  cold: HotColdEntry[];
  neutral: HotColdEntry[];
  totalDraws: number;
  recentDraws: number;
}

export interface PairEntry {
  numbers: number[];
  count: number;
  percentage: number;
}

export interface PairsResponse {
  pairs: PairEntry[];
  triplets: PairEntry[];
  totalDraws: number;
}

export interface PositionEntry {
  position: number;
  topNumbers: Array<{ number: number; count: number; percentage: number }>;
}

export interface DistributionResponse {
  positions: PositionEntry[];
  totalDraws: number;
  pickCount: number;
}

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AnalysisService {
  private readonly http   = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getFrequency(
    lotteryId: number,
    from?: string,
    to?: string,
    limit = 100,
  ): Observable<FrequencyResponse> {
    const params: Record<string, string> = { limit: String(limit) };
    if (from) params['from'] = from;
    if (to)   params['to']   = to;
    return this.http.get<FrequencyResponse>(
      `${this.apiUrl}/analysis/${lotteryId}/frequency`, { params }
    );
  }

  getHotCold(lotteryId: number, recent = 20): Observable<HotColdResponse> {
    return this.http.get<HotColdResponse>(
      `${this.apiUrl}/analysis/${lotteryId}/hot-cold`, { params: { recent: String(recent) } }
    );
  }

  getPairs(lotteryId: number, from?: string, to?: string, top = 20): Observable<PairsResponse> {
    const params: Record<string, string> = { top: String(top) };
    if (from) params['from'] = from;
    if (to)   params['to']   = to;
    return this.http.get<PairsResponse>(
      `${this.apiUrl}/analysis/${lotteryId}/pairs`, { params }
    );
  }

  getDistribution(lotteryId: number, from?: string, to?: string): Observable<DistributionResponse> {
    const params: Record<string, string> = {};
    if (from) params['from'] = from;
    if (to)   params['to']   = to;
    return this.http.get<DistributionResponse>(
      `${this.apiUrl}/analysis/${lotteryId}/distribution`, { params }
    );
  }
}
