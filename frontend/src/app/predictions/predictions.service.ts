import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface NumberScore {
  number: number;
  score: number;
  frequency: number;
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

export interface AIPrediction {
  suggestedNumbers: number[];
  reasoning: string;
  patterns: string[];
  confidence: number;
  method: 'openai';
  cachedAt?: string;
}

export interface PredictionResult {
  lotteryId: number;
  lotteryName: string;
  pickCount: number;
  maxNumber: number;
  statistical: StatisticalPrediction;
  ai?: AIPrediction;
  combined: {
    suggestedNumbers: number[];
    confidence: number;
    explanation: string;
  };
  disclaimer: string;
  generatedAt: string;
}

export interface PredictionHistory {
  id: number;
  lotteryId: number;
  numbers: number[];
  confidenceScore: number;
  aiReasoning: string | null;
  createdAt: string;
}

export interface Lottery {
  id: number;
  name: string;
  country: string;
  pickCount: number;
  maxNumber: number;
  drawSchedule: string;
}

@Injectable({ providedIn: 'root' })
export class PredictionsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  private get authHeaders(): HttpHeaders {
    const token = localStorage.getItem('token');
    return token
      ? new HttpHeaders({ Authorization: `Bearer ${token}` })
      : new HttpHeaders();
  }

  getLotteries(): Observable<{ lotteries: Lottery[] }> {
    return this.http.get<{ lotteries: Lottery[] }>(`${this.apiUrl}/lotteries`);
  }

  generatePrediction(lotteryId: number, useAI = true): Observable<PredictionResult> {
    return this.http.post<PredictionResult>(
      `${this.apiUrl}/predictions`,
      { lotteryId, useAI },
      { headers: this.authHeaders }
    );
  }

  getPredictionHistory(lotteryId?: number, limit = 20): Observable<{ predictions: PredictionHistory[] }> {
    const params: Record<string, string> = { limit: String(limit) };
    if (lotteryId) params['lotteryId'] = String(lotteryId);
    return this.http.get<{ predictions: PredictionHistory[] }>(
      `${this.apiUrl}/predictions`,
      { headers: this.authHeaders, params }
    );
  }
}
