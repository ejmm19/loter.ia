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

@Injectable({ providedIn: 'root' })
export class LotteryService {
  private http = inject(HttpClient);

  getLatestResults(): Observable<LatestResult[]> {
    return this.http
      .get<{ results: LatestResult[] }>(`${environment.apiUrl}/lotteries/latest-results`)
      .pipe(map((res) => res.results));
  }
}
