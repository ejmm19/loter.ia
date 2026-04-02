import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  PredictionsService,
  PredictionResult,
  PredictionHistory,
  Lottery,
} from './predictions.service';
import { AuthService } from '../auth/auth.service';

type Tab = 'generate' | 'history';

@Component({
  selector: 'app-predictions',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './predictions.component.html',
  styleUrl: './predictions.component.css',
})
export class PredictionsComponent implements OnInit {
  private readonly svc = inject(PredictionsService);
  readonly auth = inject(AuthService);

  // State
  readonly lotteries = signal<Lottery[]>([]);
  readonly selectedLotteryId = signal<number | null>(null);
  readonly useAI = signal(true);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly result = signal<PredictionResult | null>(null);
  readonly history = signal<PredictionHistory[]>([]);
  readonly activeTab = signal<Tab>('generate');

  readonly selectedLottery = computed(() =>
    this.lotteries().find((l) => l.id === this.selectedLotteryId()) ?? null
  );

  ngOnInit(): void {
    this.svc.getLotteries().subscribe({
      next: ({ lotteries }) => {
        this.lotteries.set(lotteries);
        if (lotteries.length > 0) this.selectedLotteryId.set(lotteries[0].id);
      },
      error: () => this.error.set('No se pudieron cargar las loterías.'),
    });
  }

  generate(): void {
    const id = this.selectedLotteryId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);
    this.result.set(null);

    this.svc.generatePrediction(id, this.useAI()).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Error generando predicción.');
        this.loading.set(false);
      },
    });
  }

  loadHistory(): void {
    const id = this.selectedLotteryId();
    this.svc.getPredictionHistory(id ?? undefined).subscribe({
      next: ({ predictions }) => this.history.set(predictions),
      error: () => this.error.set('No se pudo cargar el historial.'),
    });
  }

  switchTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'history') this.loadHistory();
  }

  trendIcon(trend: 'hot' | 'cold' | 'neutral'): string {
    return trend === 'hot' ? '🔥' : trend === 'cold' ? '🧊' : '—';
  }

  confidenceColor(score: number): string {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-red-500';
  }
}
