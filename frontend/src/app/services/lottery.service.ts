import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LatestResult {
  id: number;
  lottery_id: number;
  name: string;
  slug: string;
  draw_date: string;
  number: string;
  series: string;
  sorteo: number | null;
}

export interface Lottery {
  id: number;
  slug: string;
  name: string;
  source_name: string;
  draw_day: string | null;
}

export interface Draw {
  id: number;
  lottery_id: number;
  draw_date: string;
  number: string;
  series: string;
  sorteo: number | null;
  prize_type: string;
  prize_name: string | null;
  prize_value: number | null;
  secos_count?: number;
}

export interface Seco {
  id: number;
  number: string;
  series: string;
  prize_name: string | null;
  prize_value: number | null;
}

export interface HotDigit {
  digit: number;
  count: number;
}

export interface HotNumbersResponse {
  hotDigits: HotDigit[];
  totalDraws: number;
  periodDays: number;
}

export interface DreamItem {
  label: string;
  number: string;
  emoji: string;
}

export interface DreamCategory {
  name: string;
  icon: string;
  items: DreamItem[];
}

export interface DreamResult {
  number: string;
  series: string;
  interpretation: string;
  symbols: string[];
}

export interface CheckMatch {
  id: number;
  lottery_id: number;
  name: string;
  slug: string;
  draw_date: string;
  number: string;
  series: string;
  sorteo: number | null;
  prize_type: string;
  prize_name: string | null;
  prize_value: number | null;
}

export interface CheckResult {
  match: boolean;
  message: string;
  results: CheckMatch[];
}

@Injectable({ providedIn: 'root' })
export class LotteryService {
  private http = inject(HttpClient);

  getLatestResults(): Observable<LatestResult[]> {
    return this.http
      .get<{ results: LatestResult[] }>(`${environment.apiUrl}/lotteries/latest-results`)
      .pipe(map((res) => res.results));
  }

  getHotNumbers(lotteryId?: number): Observable<HotNumbersResponse> {
    const url = lotteryId
      ? `${environment.apiUrl}/lotteries/hot-numbers?lotteryId=${lotteryId}`
      : `${environment.apiUrl}/lotteries/hot-numbers`;
    return this.http.get<HotNumbersResponse>(url);
  }

  getLotteryBySlug(slug: string): Observable<Lottery> {
    return this.http
      .get<{ lottery: Lottery }>(`${environment.apiUrl}/lotteries/${slug}`)
      .pipe(map((res) => res.lottery));
  }

  getLotteries(): Observable<Lottery[]> {
    return this.http
      .get<{ lotteries: Lottery[] }>(`${environment.apiUrl}/lotteries`)
      .pipe(map((res) => res.lotteries));
  }

  getDraws(lotteryId: number, limit = 20): Observable<Draw[]> {
    return this.http
      .get<{ draws: Draw[] }>(`${environment.apiUrl}/lotteries/${lotteryId}/draws?limit=${limit}`)
      .pipe(map((res) => res.draws));
  }

  getDrawsWithOffset(lotteryId: number, limit: number, offset: number): Observable<Draw[]> {
    return this.http
      .get<{ draws: Draw[] }>(`${environment.apiUrl}/lotteries/${lotteryId}/draws?limit=${limit}&offset=${offset}`)
      .pipe(map((res) => res.draws));
  }

  getDrawByDate(lotteryId: number, drawDate: string): Observable<Draw> {
    return this.http
      .get<{ draw: Draw }>(`${environment.apiUrl}/lotteries/${lotteryId}/draws/by-date?date=${drawDate}`)
      .pipe(map((res) => res.draw));
  }

  getSecos(lotteryId: number, drawDate: string): Observable<Seco[]> {
    return this.http
      .get<{ secos: Seco[] }>(`${environment.apiUrl}/lotteries/${lotteryId}/draws/secos?date=${drawDate}`)
      .pipe(map((res) => res.secos));
  }

  getHolidays(year: number): Observable<{ date: string; name: string }[]> {
    return this.http
      .get<{ date: string; localName: string }[]>(`https://date.nager.at/api/v3/PublicHolidays/${year}/CO`)
      .pipe(map((holidays) => holidays.map(h => ({ date: h.date, name: h.localName }))));
  }

  getDreamTable(): Observable<{ categories: DreamCategory[] }> {
    return this.http.get<{ categories: DreamCategory[] }>(`${environment.apiUrl}/dreams/table`);
  }

  interpretDream(text: string): Observable<DreamResult> {
    return this.http.post<DreamResult>(`${environment.apiUrl}/dreams/interpret`, { text });
  }

  checkNumber(lotteryId: number, number: string, series?: string): Observable<CheckResult> {
    let url = `${environment.apiUrl}/lotteries/check?lotteryId=${lotteryId}&number=${number}`;
    if (series) url += `&series=${series}`;
    return this.http.get<CheckResult>(url);
  }
}
