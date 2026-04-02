import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PredictionHistoryItem {
  id: number;
  lotteryId: number;
  lotteryName: string;
  predictedNumbers: number[];
  actualNumbers: number[] | null;
  matchedCount: number | null;
  confidenceScore: number | null;
  drawDate: string | null;
  createdAt: string;
}

export interface UserStats {
  totalPredictions: number;
  resolvedPredictions: number;
  predictionsWithHits: number;
  avgMatchedNumbers: number;
  bestMatch: number;
  topLottery: string | null;
}

export interface Favorite {
  id: number;
  lotteryId: number;
  lotteryName: string;
  numbers: number[];
  label: string | null;
  createdAt: string;
}

export interface NotificationPreference {
  lotteryId: number;
  lotteryName: string;
  notifyResults: boolean;
  notifyPredictionHit: boolean;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getHistory(lotteryId?: number, limit = 20, offset = 0): Observable<{ predictions: PredictionHistoryItem[]; limit: number; offset: number }> {
    const params: Record<string, string> = { limit: String(limit), offset: String(offset) };
    if (lotteryId) params['lotteryId'] = String(lotteryId);
    return this.http.get<{ predictions: PredictionHistoryItem[]; limit: number; offset: number }>(
      `${this.apiUrl}/user/history`, { params }
    );
  }

  getStats(): Observable<UserStats> {
    return this.http.get<UserStats>(`${this.apiUrl}/user/stats`);
  }

  getFavorites(): Observable<{ favorites: Favorite[] }> {
    return this.http.get<{ favorites: Favorite[] }>(`${this.apiUrl}/user/favorites`);
  }

  saveFavorite(lotteryId: number, numbers: number[], label?: string): Observable<{ id: number }> {
    return this.http.post<{ id: number }>(`${this.apiUrl}/user/favorites`, { lotteryId, numbers, label });
  }

  deleteFavorite(id: number): Observable<{ deleted: boolean }> {
    return this.http.delete<{ deleted: boolean }>(`${this.apiUrl}/user/favorites/${id}`);
  }

  getNotifications(): Observable<{ subscriptions: NotificationPreference[] }> {
    return this.http.get<{ subscriptions: NotificationPreference[] }>(`${this.apiUrl}/user/notifications`);
  }

  updateNotification(lotteryId: number, prefs: { notifyResults?: boolean; notifyPredictionHit?: boolean }): Observable<{ updated: boolean }> {
    return this.http.put<{ updated: boolean }>(`${this.apiUrl}/user/notifications/${lotteryId}`, prefs);
  }
}
