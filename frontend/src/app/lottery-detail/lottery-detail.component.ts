import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LotteryService, Lottery, Draw, HotDigit } from '../services/lottery.service';
import { SeoService } from '../services/seo.service';

const BRAND_COLORS: Record<string, string> = {
  'loteria-de-bogota': '#B91C1C',
  'loteria-de-boyaca': '#BE123C',
  'loteria-de-cundinamarca': '#1E40AF',
  'loteria-de-manizales': '#1E3A5F',
  'loteria-de-medellin': '#1E3A8A',
  'loteria-de-santander': '#15803D',
  'loteria-del-cauca': '#0F766E',
  'loteria-del-huila': '#166534',
  'loteria-del-meta': '#92400E',
  'loteria-del-quindio': '#14532D',
  'loteria-del-risaralda': '#15803D',
  'loteria-del-tolima': '#7F1D1D',
  'loteria-del-valle': '#991B1B',
  'cruz-roja': '#DC2626',
  'extra-de-colombia': '#1E3A8A',
};

const DRAW_DAYS: Record<string, string> = {
  monday: 'Lunes',
  tuesday: 'Martes',
  wednesday: 'Miércoles',
  thursday: 'Jueves',
  friday: 'Viernes',
  saturday: 'Sábado',
  sunday: 'Domingo',
};

@Component({
  selector: 'app-lottery-detail',
  standalone: true,
  imports: [RouterLink],
  host: { class: 'block relative' },
  template: `
    <!-- Background band (30% altura, full-width) -->
    <div
      class="absolute top-0 h-[30vh] overflow-hidden -left-[calc((100vw-100%)/2)] -right-[calc((100vw-100%)/2)]"
      [style.background]="lottery ? 'linear-gradient(135deg, ' + brandColor + ', ' + brandColor + 'bb)' : '#e5e7eb'">
      @if (!isLoading && lottery) {
        <div class="absolute inset-0 opacity-[0.05]"
          style="background-image: url('data:image/svg+xml,%3Csvg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 40 40&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Ccircle cx=&quot;20&quot; cy=&quot;20&quot; r=&quot;3&quot; fill=&quot;white&quot;/%3E%3C/svg%3E'); background-size: 40px 40px;"></div>
        <div class="absolute -top-16 -right-16 w-56 h-56 bg-white/5 rounded-full"></div>
        <div class="absolute -bottom-12 -left-12 w-40 h-40 bg-white/5 rounded-full"></div>
      }
    </div>

    <!-- Contenido 30/70 encima -->
    <div class="relative z-10 pt-10 lg:pt-14">
      <div class="flex flex-col lg:flex-row gap-8">

        <!-- 30% Logo -->
        <div class="w-full lg:w-[30%] flex flex-col items-center">
          @if (isLoading) {
            <div class="sticky top-20 space-y-4 w-full animate-pulse">
              <!-- Card logo skeleton -->
              <div class="bg-white rounded-2xl border border-gray-100 shadow-md p-6">
                <div class="w-36 h-36 lg:w-40 lg:h-40 bg-gray-200 rounded-2xl mx-auto"></div>
                <div class="h-7 w-40 bg-gray-200 rounded-lg mx-auto mt-5"></div>
                <div class="h-4 w-28 bg-gray-200 rounded-lg mx-auto mt-3"></div>
                <div class="flex gap-5 justify-center mt-5">
                  <div class="text-center space-y-1.5">
                    <div class="h-7 w-12 bg-gray-200 rounded mx-auto"></div>
                    <div class="h-3 w-14 bg-gray-200 rounded mx-auto"></div>
                  </div>
                  <div class="text-center space-y-1.5">
                    <div class="h-7 w-12 bg-gray-200 rounded mx-auto"></div>
                    <div class="h-3 w-14 bg-gray-200 rounded mx-auto"></div>
                  </div>
                </div>
              </div>
              <!-- Otras loterías skeleton -->
              <div class="bg-white rounded-2xl border border-gray-100 shadow-md p-4">
                <div class="h-3 w-24 bg-gray-200 rounded mb-4 mx-1"></div>
                @for (_ of [1,2,3,4,5,6]; track $index) {
                  <div class="flex items-center gap-3 px-3 py-2.5">
                    <div class="w-8 h-8 bg-gray-200 rounded shrink-0"></div>
                    <div class="h-4 bg-gray-200 rounded w-3/4"></div>
                  </div>
                }
              </div>
            </div>
          } @else if (lottery) {
            <div class="sticky top-20 space-y-4">
              <!-- Card del logo -->
              <div class="bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center">
                <div class="w-36 h-36 lg:w-40 lg:h-40 mx-auto flex items-center justify-center p-3">
                  <img
                    [src]="'logos/' + lottery.slug + '/logo.png'"
                    [alt]="lottery.name"
                    class="w-full h-full object-contain" />
                </div>
                <h1 class="font-heading font-bold text-xl lg:text-2xl text-gray-900 mt-3 mb-1">{{ lottery.name }}</h1>
                @if (lottery.draw_day) {
                  <p class="text-gray-500 text-sm">
                    Juega los <span class="text-gray-700 font-semibold">{{ drawDayLabel }}</span>
                  </p>
                }
                <div class="flex gap-5 mt-4 justify-center">
                  <div class="text-center">
                    <p class="font-bold text-xl" [style.color]="brandColor" style="font-family: 'Fredoka', sans-serif;">{{ draws.length }}</p>
                    <p class="text-gray-400 text-[10px] uppercase tracking-wider">Sorteos</p>
                  </div>
                  @if (draws.length) {
                    <div class="text-center">
                      <p class="font-bold text-xl" [style.color]="brandColor" style="font-family: 'Fredoka', sans-serif;">{{ draws[0].number }}</p>
                      <p class="text-gray-400 text-[10px] uppercase tracking-wider">Último</p>
                    </div>
                  }
                </div>
              </div>

              <!-- Otras loterías -->
              <div class="bg-white rounded-2xl shadow-md border border-gray-100 p-4">
                <p class="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-3 px-1">Otras loterías</p>
                <div class="space-y-0.5 max-h-60 overflow-y-auto">
                  @for (lot of otherLotteries; track lot.id) {
                    <a
                      [routerLink]="['/loteria', lot.slug]"
                      class="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      [class.bg-gray-50]="lot.slug === lottery.slug">
                      <img
                        [src]="'logos/' + lot.slug + '/logo.png'"
                        [alt]="lot.name"
                        class="w-8 h-8 object-contain rounded shrink-0" />
                      <span class="text-gray-700 text-sm truncate">{{ lot.name }}</span>
                    </a>
                  }
                </div>
              </div>
            </div>
          }
        </div>

        <!-- 70% Tabla -->
        <div class="w-full lg:w-[70%]">
          @if (isLoading) {
            <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
              <div class="grid grid-cols-4 py-3.5 px-5 bg-gray-200">
                <div class="h-3 w-12 bg-gray-300 rounded"></div>
                <div class="h-3 w-14 bg-gray-300 rounded mx-auto"></div>
                <div class="h-3 w-10 bg-gray-300 rounded mx-auto"></div>
                <div class="h-3 w-12 bg-gray-300 rounded mx-auto"></div>
              </div>
              @for (_ of [1,2,3,4,5,6,7,8]; track $index) {
                <div class="grid grid-cols-4 items-center px-5 py-3.5 border-b border-gray-50">
                  <div class="h-4 w-24 bg-gray-100 rounded"></div>
                  <div class="h-8 w-16 bg-gray-100 rounded-full mx-auto"></div>
                  <div class="h-4 w-10 bg-gray-100 rounded mx-auto"></div>
                  <div class="h-4 w-8 bg-gray-100 rounded mx-auto"></div>
                </div>
              }
            </div>
          } @else {
            <!-- Números más repetidos -->
            @if (hotDigits.length) {
              <div class="bg-white rounded-2xl shadow-md border border-gray-100 p-5 mb-4">
                <p class="text-gray-500 text-xs uppercase tracking-wider font-semibold mb-3">Números más repetidos <span class="text-gray-400 font-normal">— {{ hotTotalDraws }} sorteos analizados</span></p>
                <div class="flex gap-3">
                  @for (hot of hotDigits; track hot.digit) {
                    <div class="flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-50">
                      <span
                        class="w-14 h-14 rounded-full text-white flex items-center justify-center font-bold text-2xl shadow-sm"
                        [style.background-color]="brandColor"
                        style="font-family: 'Fredoka', sans-serif;">
                        {{ hot.digit }}
                      </span>
                      <div>
                        <p class="font-bold text-lg text-gray-800" style="font-family: 'Fredoka', sans-serif;">{{ hot.count }}</p>
                        <p class="text-xs text-gray-400">veces</p>
                      </div>
                    </div>
                  }
                </div>
              </div>
            }

            <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
              <!-- Header -->
              <div
                class="grid grid-cols-5 text-white text-xs font-semibold uppercase tracking-wider"
                [style.background-color]="brandColor">
                <div class="px-5 py-3.5">Fecha</div>
                <div class="px-5 py-3.5 text-center">Número</div>
                <div class="px-5 py-3.5 text-center">Serie</div>
                <div class="px-5 py-3.5 text-center">Sorteo</div>
                <div class="px-5 py-3.5 text-center">Secos</div>
              </div>

              <!-- Body con scroll -->
              <div class="max-h-[520px] overflow-y-auto">
                @for (draw of draws; track draw.id; let i = $index) {
                  <!-- Fila principal -->
                  <div
                    class="grid grid-cols-5 items-center border-b border-gray-50 hover:bg-gray-50/80 transition-colors"
                    [class.bg-gray-50/40]="i % 2 === 1">
                    <div class="px-5 py-3.5 text-gray-600 text-sm">{{ formatDate(draw.draw_date) }}</div>
                    <div class="px-5 py-3.5 text-center">
                      <span
                        class="inline-block px-4 py-1 rounded-full text-white font-bold text-base shadow-sm"
                        [style.background-color]="brandColor"
                        style="font-family: 'Fredoka', sans-serif; letter-spacing: 0.1em;">
                        {{ draw.number }}
                      </span>
                    </div>
                    <div class="px-5 py-3.5 text-center font-bold text-gray-700" style="font-family: 'Fredoka', sans-serif;">
                      {{ draw.series || '—' }}
                    </div>
                    <div class="px-5 py-3.5 text-center text-gray-400 text-sm">
                      {{ draw.sorteo || '—' }}
                    </div>
                    <div class="px-5 py-3.5 text-center">
                      @if (draw.secos_count) {
                        <a
                          [routerLink]="['/loteria', lottery!.slug, 'sorteo', draw.draw_date]"
                          class="btn btn-ghost btn-xs gap-1 text-gray-400 hover:text-brand-600">
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          {{ draw.secos_count }}
                        </a>
                      } @else {
                        <span class="text-gray-300 text-xs">—</span>
                      }
                    </div>
                  </div>
                }

                @if (!draws.length) {
                  <div class="px-5 py-12 text-center text-gray-400">
                    No hay resultados disponibles para esta lotería.
                  </div>
                }
              </div>
            </div>

            <!-- Cargar más -->
            @if (hasMore) {
              <div class="flex justify-center mt-4">
                <button
                  class="btn btn-ghost btn-sm text-gray-500"
                  [disabled]="isLoadingMore"
                  (click)="loadMore()">
                  @if (isLoadingMore) {
                    <span class="loading loading-spinner loading-sm"></span>
                  } @else {
                    Cargar más resultados
                  }
                </button>
              </div>
            }
          }
        </div>

      </div>
    </div>
  `,
})
export class LotteryDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private lotteryService = inject(LotteryService);
  private seo = inject(SeoService);

  lottery: Lottery | null = null;
  draws: Draw[] = [];
  otherLotteries: Lottery[] = [];
  hotDigits: HotDigit[] = [];
  hotTotalDraws = 0;
  brandColor = '#075985';
  drawDayLabel = '';
  isLoading = true;
  isLoadingMore = false;
  hasMore = true;
  private offset = 0;
  private readonly limit = 50;

  ngOnInit(): void {
    // Cargar lista de loterías para el sidebar
    this.lotteryService.getLotteries().subscribe({
      next: (lotteries) => this.otherLotteries = lotteries,
    });

    // Reaccionar a cambios de slug (navegación entre loterías)
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      this.isLoading = true;
      this.draws = [];
      this.offset = 0;

      this.lotteryService.getLotteryBySlug(slug).subscribe({
        next: (lottery) => {
          this.lottery = lottery;
          this.brandColor = BRAND_COLORS[lottery.slug] || '#075985';
          this.drawDayLabel = DRAW_DAYS[lottery.draw_day ?? ''] || '';
          const dayLabel = this.drawDayLabel ? ` — Juega los ${this.drawDayLabel}` : '';
          this.seo.update({
            title: `${lottery.name} — Resultados, Premios Secos e Histórico`,
            description: `Últimos resultados de la ${lottery.name}${dayLabel}. Números ganadores, serie, premios secos, histórico de sorteos y estadísticas.`,
            url: `/loteria/${lottery.slug}`,
            jsonLd: {
              '@type': 'WebPage',
              name: `Resultados ${lottery.name}`,
              description: `Resultados actualizados de la ${lottery.name}`,
              url: `https://loteriasdehoy.pro/loteria/${lottery.slug}`,
              breadcrumb: {
                '@type': 'BreadcrumbList',
                itemListElement: [
                  { '@type': 'ListItem', position: 1, name: 'Inicio', item: 'https://loteriasdehoy.pro' },
                  { '@type': 'ListItem', position: 2, name: lottery.name, item: `https://loteriasdehoy.pro/loteria/${lottery.slug}` },
                ],
              },
            },
          });
          this.hotDigits = [];
          this.lotteryService.getHotNumbers(lottery.id).subscribe({
            next: (res) => {
              this.hotDigits = res.hotDigits;
              this.hotTotalDraws = res.totalDraws;
            },
          });
          this.loadDraws(lottery.id);
        },
        error: () => {
          this.isLoading = false;
        },
      });
    });
  }

  private loadDraws(lotteryId: number): void {
    this.lotteryService.getDraws(lotteryId, this.limit).subscribe({
      next: (draws) => {
        this.draws = draws;
        this.offset = draws.length;
        this.hasMore = draws.length === this.limit;
        this.isLoading = false;
      },
    });
  }

  loadMore(): void {
    if (!this.lottery || this.isLoadingMore) return;
    this.isLoadingMore = true;

    this.lotteryService.getDrawsWithOffset(this.lottery.id, this.limit, this.offset).subscribe({
      next: (draws) => {
        this.draws = [...this.draws, ...draws];
        this.offset += draws.length;
        this.hasMore = draws.length === this.limit;
        this.isLoadingMore = false;
      },
    });
  }

  formatDate(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
