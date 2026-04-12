import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { LotteryService, LatestResult } from '../services/lottery.service';

interface Slide {
  name: string;
  date: string;
  digits: string[];
  series: string;
  colorClass: string;
}

const BADGE_COLORS = [
  'badge-success', 'badge-info', 'badge-warning',
  'badge-error', 'badge-primary', 'badge-secondary',
  'badge-accent',
];

@Component({
  selector: 'app-home',
  imports: [NgClass],
  template: `
    <section class="py-8 lg:py-12">
      <div class="flex flex-col lg:flex-row gap-8 items-center">

        <!-- Izquierda: Carousel -->
        <div class="w-full lg:w-1/2">
          @if (slides.length) {
            <div class="card bg-white shadow-md rounded-2xl overflow-hidden">
              <!-- Slide -->
              <div class="card-body items-center text-center py-8 px-6">
                <span
                  class="badge badge-sm font-medium mb-2"
                  [ngClass]="slides[activeIndex].colorClass">
                  {{ slides[activeIndex].name }}
                </span>
                <p class="text-gray-400 text-[13px] mb-4">{{ slides[activeIndex].date }}</p>

                <!-- Bolitas de números -->
                <div class="flex justify-center gap-3 mb-4">
                  @for (digit of slides[activeIndex].digits; track $index) {
                    <div
                      class="w-14 h-14 rounded-full flex items-center justify-center text-white font-heading font-bold text-xl shadow-md"
                      [ngClass]="ballColors[$index]">
                      {{ digit }}
                    </div>
                  }
                </div>

                <p class="text-gray-500 text-[14px]">
                  Serie: <span class="font-heading font-bold text-gray-800 text-[18px]">{{ slides[activeIndex].series }}</span>
                </p>
              </div>

              <!-- Controles -->
              <div class="flex items-center justify-between px-4 pb-4">
                <button
                  class="btn btn-circle btn-ghost btn-sm"
                  (click)="prev()"
                  aria-label="Anterior">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div class="flex gap-2">
                  @for (slide of slides; track $index) {
                    <button
                      class="w-2.5 h-2.5 rounded-full transition-colors"
                      [ngClass]="$index === activeIndex ? 'bg-brand-600' : 'bg-gray-300'"
                      (click)="goTo($index)"
                      [attr.aria-label]="'Ir a ' + slide.name">
                    </button>
                  }
                </div>

                <button
                  class="btn btn-circle btn-ghost btn-sm"
                  (click)="next()"
                  aria-label="Siguiente">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          } @else {
            <div class="card bg-white shadow-md rounded-2xl p-8 text-center">
              <span class="loading loading-spinner loading-lg text-brand-600"></span>
              <p class="text-gray-400 mt-4">Cargando resultados...</p>
            </div>
          }
        </div>

        <!-- Derecha: Info -->
        <div class="w-full lg:w-1/2">
          <h1 class="font-heading font-bold text-[28px] text-gray-900 leading-tight mb-4">
            Resultados de loterías de hoy,
            <span class="text-brand-600">al instante</span>
          </h1>
          <p class="text-gray-600 mb-6">
            Consulta los resultados actualizados de las principales loterías colombianas.
            Números ganadores, series y horarios en un solo lugar.
          </p>

          <!-- Tags de loterías -->
          <div class="flex flex-wrap gap-2 mb-6">
            @for (tag of lotteryTags; track tag) {
              <span class="badge badge-outline badge-sm font-medium">{{ tag }}</span>
            }
          </div>

          <a class="btn btn-primary">Ver resultados de hoy</a>

          <p class="text-gray-400 text-[13px] mt-4">
            Última actualización: {{ lastUpdate }}
          </p>
        </div>

      </div>
    </section>
  `,
})
export class HomeComponent implements OnInit, OnDestroy {
  private lotteryService = inject(LotteryService);

  slides: Slide[] = [];
  ballColors = ['bg-brand-600', 'bg-green-500', 'bg-amber-500', 'bg-red-500'];

  lotteryTags = [
    'Medellín', 'Bogotá', 'Cundinamarca', 'Valle', 'Manizales',
    'Tolima', 'Boyacá', 'Huila', 'Cauca', 'Santander',
    'Quindío', 'Risaralda', 'Meta', 'Cruz Roja',
  ];

  lastUpdate = '';
  activeIndex = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.lotteryService.getLatestResults().subscribe({
      next: (results) => {
        this.slides = results.map((r, i) => ({
          name: r.name,
          date: this.formatDate(r.draw_date),
          digits: r.number.split(''),
          series: r.series,
          colorClass: BADGE_COLORS[i % BADGE_COLORS.length],
        }));

        if (results.length) {
          this.lastUpdate = this.formatDate(results[0].draw_date);
        }

        this.startAutoPlay();
      },
    });
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  next(): void {
    if (!this.slides.length) return;
    this.activeIndex = (this.activeIndex + 1) % this.slides.length;
    this.resetAutoPlay();
  }

  prev(): void {
    if (!this.slides.length) return;
    this.activeIndex = (this.activeIndex - 1 + this.slides.length) % this.slides.length;
    this.resetAutoPlay();
  }

  goTo(index: number): void {
    this.activeIndex = index;
    this.resetAutoPlay();
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  private startAutoPlay(): void {
    if (this.slides.length < 2) return;
    this.intervalId = setInterval(() => {
      this.activeIndex = (this.activeIndex + 1) % this.slides.length;
    }, 4000);
  }

  private stopAutoPlay(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private resetAutoPlay(): void {
    this.stopAutoPlay();
    this.startAutoPlay();
  }
}
