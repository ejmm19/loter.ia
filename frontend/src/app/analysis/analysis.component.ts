/**
 * Analysis dashboard — Phase 2a (EJM-27)
 *
 * Four tabs:
 *   1. Frecuencia    — number frequency histogram
 *   2. Caliente/Fría — hot & cold numbers
 *   3. Pares         — frequent pairs & triplets
 *   4. Distribución  — distribution by draw position
 *
 * Uses pure CSS bar charts (no extra npm deps required).
 */
import {
  Component,
  OnInit,
  signal,
  computed,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

import {
  AnalysisService,
  FrequencyEntry,
  HotColdEntry,
  PairEntry,
  PositionEntry,
} from './analysis.service';
import { PredictionsService, Lottery } from '../predictions/predictions.service';

type Tab = 'frequency' | 'hotcold' | 'pairs' | 'distribution';

@Component({
  selector: 'app-analysis',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './analysis.component.html',
})
export class AnalysisComponent implements OnInit {
  private readonly analysisService = inject(AnalysisService);
  private readonly predictionsService = inject(PredictionsService);

  // ── state ──────────────────────────────────────────────────────────────────
  lotteries    = signal<Lottery[]>([]);
  selectedId   = signal<number | null>(null);
  activeTab    = signal<Tab>('frequency');
  fromDate     = signal<string>('');
  toDate       = signal<string>('');
  recentN      = signal<number>(20);
  loading      = signal<boolean>(false);
  error        = signal<string | null>(null);

  // data signals
  frequency    = signal<FrequencyEntry[]>([]);
  totalDrawsFreq = signal<number>(0);
  hot          = signal<HotColdEntry[]>([]);
  cold         = signal<HotColdEntry[]>([]);
  totalDrawsHC = signal<number>(0);
  pairs        = signal<PairEntry[]>([]);
  triplets     = signal<PairEntry[]>([]);
  totalDrawsPairs = signal<number>(0);
  positions    = signal<PositionEntry[]>([]);
  totalDrawsDist = signal<number>(0);
  pickCount    = signal<number>(0);

  // ── computed helpers ───────────────────────────────────────────────────────
  maxFreqCount = computed(() => {
    const top = this.frequency()[0];
    return top ? top.count : 1;
  });

  selectedLottery = computed(() =>
    this.lotteries().find(l => l.id === this.selectedId()) ?? null
  );

  // ── lifecycle ──────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.predictionsService.getLotteries().subscribe({
      next: ({ lotteries }) => {
        this.lotteries.set(lotteries);
        if (lotteries.length > 0) {
          this.selectedId.set(lotteries[0].id);
          this.loadAllTabs();
        }
      },
      error: () => this.error.set('No se pudo cargar la lista de loterías'),
    });
  }

  // ── event handlers ─────────────────────────────────────────────────────────
  onLotteryChange(id: string): void {
    this.selectedId.set(parseInt(id));
    this.loadAllTabs();
  }

  onTabChange(tab: Tab): void {
    this.activeTab.set(tab);
  }

  onFilterApply(): void {
    this.loadAllTabs();
  }

  // ── data loading ───────────────────────────────────────────────────────────
  private loadAllTabs(): void {
    const id = this.selectedId();
    if (!id) return;
    this.loading.set(true);
    this.error.set(null);

    const from = this.fromDate() || undefined;
    const to   = this.toDate()   || undefined;

    let pending = 4;
    const done = () => { if (--pending === 0) this.loading.set(false); };

    this.analysisService.getFrequency(id, from, to).subscribe({
      next: r => { this.frequency.set(r.frequency); this.totalDrawsFreq.set(r.totalDraws); done(); },
      error: () => { this.error.set('Error al cargar frecuencias'); done(); },
    });

    this.analysisService.getHotCold(id, this.recentN()).subscribe({
      next: r => { this.hot.set(r.hot); this.cold.set(r.cold); this.totalDrawsHC.set(r.totalDraws); done(); },
      error: () => done(),
    });

    this.analysisService.getPairs(id, from, to).subscribe({
      next: r => { this.pairs.set(r.pairs); this.triplets.set(r.triplets); this.totalDrawsPairs.set(r.totalDraws); done(); },
      error: () => done(),
    });

    this.analysisService.getDistribution(id, from, to).subscribe({
      next: r => { this.positions.set(r.positions); this.totalDrawsDist.set(r.totalDraws); this.pickCount.set(r.pickCount); done(); },
      error: () => done(),
    });
  }

  // ── pure helpers ───────────────────────────────────────────────────────────
  barWidth(count: number): string {
    const max = this.maxFreqCount();
    return max > 0 ? `${Math.round((count / max) * 100)}%` : '0%';
  }

  posBarWidth(pct: number, entries: Array<{ percentage: number }>): string {
    const max = entries.reduce((m, e) => Math.max(m, e.percentage), 1);
    return `${Math.round((pct / max) * 100)}%`;
  }

  hotLabel(score: number): string {
    if (score >  0.02) return '🔥';
    if (score < -0.02) return '🧊';
    return '—';
  }

  trackByNumber(_: number, entry: FrequencyEntry | HotColdEntry): number {
    return entry.number;
  }

  trackByPos(_: number, entry: PositionEntry): number {
    return entry.position;
  }

  tabs: Array<{ id: Tab; label: string }> = [
    { id: 'frequency',    label: 'Frecuencia'     },
    { id: 'hotcold',      label: 'Caliente / Fría' },
    { id: 'pairs',        label: 'Pares'           },
    { id: 'distribution', label: 'Distribución'   },
  ];
}
