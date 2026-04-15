import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LotteryService, Lottery, Draw, Seco } from '../services/lottery.service';
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

@Component({
  selector: 'app-draw-detail',
  standalone: true,
  imports: [RouterLink, FormsModule],
  host: { class: 'block relative' },
  template: `
    <!-- Background band -->
    <div
      class="absolute top-0 h-[30vh] overflow-hidden -left-[calc((100vw-100%)/2)] -right-[calc((100vw-100%)/2)]"
      [style.background]="isLoading ? '#e5e7eb' : 'linear-gradient(135deg, ' + brandColor + ', ' + brandColor + 'bb)'">
      @if (!isLoading) {
        <div class="absolute inset-0 opacity-[0.05]"
          style="background-image: url('data:image/svg+xml,%3Csvg width=&quot;40&quot; height=&quot;40&quot; viewBox=&quot;0 0 40 40&quot; xmlns=&quot;http://www.w3.org/2000/svg&quot;%3E%3Ccircle cx=&quot;20&quot; cy=&quot;20&quot; r=&quot;3&quot; fill=&quot;white&quot;/%3E%3C/svg%3E'); background-size: 40px 40px;"></div>
        <div class="absolute -top-16 -right-16 w-56 h-56 bg-white/5 rounded-full"></div>
        <div class="absolute -bottom-12 -left-12 w-40 h-40 bg-white/5 rounded-full"></div>
      }
    </div>

    <div class="relative z-10 pt-10 lg:pt-14">

      <!-- ============ SKELETON ============ -->
      @if (isLoading) {
        <div class="animate-pulse">
          <div class="flex items-center gap-2 mb-6">
            <div class="h-4 w-12 bg-gray-300/40 rounded"></div>
            <div class="h-4 w-4 bg-gray-300/20 rounded"></div>
            <div class="h-4 w-32 bg-gray-300/40 rounded"></div>
            <div class="h-4 w-4 bg-gray-300/20 rounded"></div>
            <div class="h-4 w-24 bg-gray-300/40 rounded"></div>
          </div>

          <div class="flex flex-col lg:flex-row gap-8">
            <!-- Sidebar skeleton -->
            <div class="w-full lg:w-[30%]">
              <div class="bg-white rounded-2xl border border-gray-100 shadow-md p-6 space-y-4">
                <div class="w-28 h-28 bg-gray-200 rounded-2xl mx-auto"></div>
                <div class="h-6 w-36 bg-gray-200 rounded-lg mx-auto"></div>
                <div class="h-4 w-48 bg-gray-200 rounded mx-auto"></div>
                <div class="border-t border-gray-100 pt-5 space-y-3">
                  <div class="h-3 w-20 bg-gray-200 rounded mx-auto"></div>
                  <div class="flex gap-1.5 justify-center">
                    @for (_ of [1,2,3,4]; track $index) {
                      <div class="w-14 h-16 bg-gray-200 rounded-xl"></div>
                    }
                  </div>
                  <div class="flex justify-center gap-5 mt-3">
                    <div class="text-center space-y-1">
                      <div class="h-3 w-10 bg-gray-200 rounded mx-auto"></div>
                      <div class="h-6 w-8 bg-gray-200 rounded mx-auto"></div>
                    </div>
                    <div class="text-center space-y-1">
                      <div class="h-3 w-10 bg-gray-200 rounded mx-auto"></div>
                      <div class="h-6 w-8 bg-gray-200 rounded mx-auto"></div>
                    </div>
                  </div>
                  <div class="h-5 w-32 bg-gray-200 rounded-lg mx-auto mt-2"></div>
                </div>
              </div>
              <div class="bg-white rounded-2xl border border-gray-100 shadow-md h-12 mt-4"></div>
            </div>

            <!-- Table skeleton -->
            <div class="w-full lg:w-[70%]">
              <div class="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div class="h-5 w-32 bg-gray-200 rounded"></div>
                  <div class="h-8 w-48 bg-gray-200 rounded-lg"></div>
                </div>
                <div class="grid grid-cols-4 py-3 px-5 bg-gray-200">
                  <div class="h-3 w-20 bg-gray-300 rounded"></div>
                  <div class="h-3 w-14 bg-gray-300 rounded mx-auto"></div>
                  <div class="h-3 w-10 bg-gray-300 rounded mx-auto"></div>
                  <div class="h-3 w-14 bg-gray-300 rounded text-right ml-auto"></div>
                </div>
                @for (_ of [1,2,3,4,5,6,7,8,9,10]; track $index) {
                  <div class="grid grid-cols-4 items-center px-5 py-3.5 border-b border-gray-50">
                    <div class="h-4 w-28 bg-gray-100 rounded"></div>
                    <div class="h-8 w-16 bg-gray-100 rounded-full mx-auto"></div>
                    <div class="h-4 w-10 bg-gray-100 rounded mx-auto"></div>
                    <div class="h-4 w-16 bg-gray-100 rounded ml-auto"></div>
                  </div>
                }
              </div>
            </div>
          </div>
        </div>

      <!-- ============ CONTENT ============ -->
      } @else if (lottery && mayor) {
        <!-- Breadcrumb -->
        <nav class="flex items-center gap-2 text-sm mb-6 flex-wrap">
          <a routerLink="/" class="text-white/60 hover:text-white transition-colors">Inicio</a>
          <span class="text-white/40">/</span>
          <a [routerLink]="['/loteria', lottery.slug]" class="text-white/60 hover:text-white transition-colors">{{ lottery.name }}</a>
          <span class="text-white/40">/</span>
          <span class="text-white font-semibold">Sorteo {{ mayor.sorteo ? '#' + mayor.sorteo : formatDateShort(date) }}</span>
        </nav>

        <div class="flex flex-col lg:flex-row gap-8">

          <!-- ===== 30% Sidebar: Premio Mayor ===== -->
          <div class="w-full lg:w-[30%]">
            <div class="lg:sticky lg:top-20 space-y-4">
              <div class="bg-white rounded-2xl shadow-md border border-gray-100 p-6 text-center">
                <div class="w-28 h-28 mx-auto flex items-center justify-center p-2">
                  <img
                    [src]="'logos/' + lottery.slug + '/logo.png'"
                    [alt]="lottery.name"
                    class="w-full h-full object-contain" />
                </div>

                <h1 class="font-heading font-bold text-xl text-gray-900 mt-3">{{ lottery.name }}</h1>
                <p class="text-gray-500 text-sm mt-1">{{ formatDateLong(date) }}</p>
                @if (mayor.sorteo) {
                  <p class="text-gray-400 text-xs mt-0.5">Sorteo #{{ mayor.sorteo }}</p>
                }

                <div class="border-t border-gray-100 mt-5 pt-5">
                  <p class="text-gray-400 text-[10px] uppercase tracking-wider font-semibold mb-3">Premio Mayor</p>
                  <div class="flex gap-1.5 justify-center">
                    @for (digit of mayor.number.split(''); track $index) {
                      <span
                        class="w-14 h-16 rounded-xl text-white flex items-center justify-center font-bold text-2xl shadow-md"
                        [style.background-color]="brandColor"
                        style="font-family: 'Fredoka', sans-serif;">
                        {{ digit }}
                      </span>
                    }
                  </div>
                  <div class="flex justify-center gap-5 mt-4">
                    <div class="text-center">
                      <p class="text-gray-400 text-[10px] uppercase tracking-wider">Serie</p>
                      <p class="font-bold text-xl text-gray-700 mt-0.5" style="font-family: 'Fredoka', sans-serif;">{{ mayor.series || '—' }}</p>
                    </div>
                    @if (secos.length) {
                      <div class="text-center">
                        <p class="text-gray-400 text-[10px] uppercase tracking-wider">Secos</p>
                        <p class="font-bold text-xl mt-0.5" [style.color]="brandColor" style="font-family: 'Fredoka', sans-serif;">{{ secos.length }}</p>
                      </div>
                    }
                  </div>
                  @if (mayor.prize_value) {
                    <div class="mt-4 px-4 py-2 rounded-xl bg-gray-50">
                      <p class="text-gray-400 text-[10px] uppercase tracking-wider">Valor</p>
                      <p class="font-bold text-lg" [style.color]="brandColor" style="font-family: 'Fredoka', sans-serif;">
                        {{ formatPrize(mayor.prize_value) }}
                      </p>
                    </div>
                  }
                </div>
              </div>

              <a
                [routerLink]="['/loteria', lottery.slug]"
                class="flex items-center justify-center gap-2 w-full bg-white rounded-2xl shadow-md border border-gray-100 px-4 py-3 text-gray-500 text-sm hover:bg-gray-50 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver al historial
              </a>
            </div>
          </div>

          <!-- ===== 70% Tabla de Secos ===== -->
          <div class="w-full lg:w-[70%]">
            @if (secos.length) {
              <div class="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
                <!-- Header con buscador -->
                <div class="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <h2 class="font-heading font-bold text-base text-gray-800">
                    Premios Secos
                    <span class="text-gray-400 font-normal text-sm ml-1">({{ filteredSecos.length }})</span>
                  </h2>
                  <div class="relative">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-300 absolute left-3 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      [(ngModel)]="secosFilter"
                      placeholder="Buscar número, serie o premio"
                      class="input input-sm input-bordered pl-9 w-60 text-sm bg-gray-50 focus:outline-none" />
                  </div>
                </div>

                <!-- Tabla header -->
                <div
                  class="grid grid-cols-[1fr_auto_auto_auto] lg:grid-cols-4 text-white text-xs font-semibold uppercase tracking-wider"
                  [style.background-color]="brandColor">
                  <div class="px-5 py-3">Premio</div>
                  <div class="px-5 py-3 text-center">Número</div>
                  <div class="px-5 py-3 text-center">Serie</div>
                  <div class="px-5 py-3 text-right">Valor</div>
                </div>

                <!-- Tabla body -->
                <div class="max-h-[520px] overflow-y-auto">
                  @for (seco of filteredSecos; track $index; let i = $index) {
                    <div
                      class="grid grid-cols-[1fr_auto_auto_auto] lg:grid-cols-4 items-center border-b border-gray-50 hover:bg-gray-50/80 transition-colors"
                      [class.bg-gray-50/40]="i % 2 === 1">
                      <div class="px-5 py-3 text-gray-600 text-sm truncate">
                        {{ seco.prize_name || 'Seco' }}
                      </div>
                      <div class="px-5 py-3 text-center">
                        <span
                          class="inline-block px-4 py-1 rounded-full text-white font-bold text-base shadow-sm"
                          [style.background-color]="brandColor"
                          style="font-family: 'Fredoka', sans-serif; letter-spacing: 0.1em;">
                          {{ seco.number }}
                        </span>
                      </div>
                      <div class="px-5 py-3 text-center font-bold text-gray-700" style="font-family: 'Fredoka', sans-serif;">
                        {{ seco.series || '—' }}
                      </div>
                      <div class="px-5 py-3 text-right text-gray-500 text-sm font-medium whitespace-nowrap">
                        @if (seco.prize_value) {
                          {{ formatPrize(seco.prize_value) }}
                        } @else {
                          <span class="text-gray-300">—</span>
                        }
                      </div>
                    </div>
                  }

                  @if (filteredSecos.length === 0) {
                    <div class="px-5 py-12 text-center text-gray-400">
                      No se encontraron resultados para "{{ secosFilter }}"
                    </div>
                  }
                </div>
              </div>
            } @else {
              <div class="bg-white rounded-2xl shadow-md border border-gray-100 px-5 py-12 text-center text-gray-400">
                No hay premios secos disponibles para este sorteo.
              </div>
            }
          </div>

        </div>

      <!-- ============ NOT FOUND ============ -->
      } @else {
        <div class="bg-white rounded-2xl shadow-md border border-gray-100 px-5 py-12 text-center text-gray-400">
          No se encontró el sorteo solicitado.
        </div>
      }
    </div>
  `,
})
export class DrawDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private lotteryService = inject(LotteryService);
  private seo = inject(SeoService);

  lottery: Lottery | null = null;
  mayor: Draw | null = null;
  secos: Seco[] = [];
  brandColor = '#075985';
  date = '';
  isLoading = true;
  secosFilter = '';

  get filteredSecos(): Seco[] {
    if (!this.secosFilter.trim()) return this.secos;
    const q = this.secosFilter.trim().toLowerCase();
    return this.secos.filter(
      s => s.number.includes(q)
        || (s.series && s.series.includes(q))
        || (s.prize_name && s.prize_name.toLowerCase().includes(q))
    );
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe((params) => {
      const slug = params.get('slug') ?? '';
      this.date = params.get('date') ?? '';
      this.isLoading = true;

      this.lotteryService.getLotteryBySlug(slug).subscribe({
        next: (lottery) => {
          this.lottery = lottery;
          this.brandColor = BRAND_COLORS[lottery.slug] || '#075985';
          this.loadDrawData(lottery.id);
        },
        error: () => this.isLoading = false,
      });
    });
  }

  private loadDrawData(lotteryId: number): void {
    this.lotteryService.getDrawByDate(lotteryId, this.date).subscribe({
      next: (draw) => {
        this.mayor = draw;
        const sorteoLabel = draw.sorteo ? `Sorteo #${draw.sorteo}` : this.formatDateShort(this.date);
        this.seo.update({
          title: `${this.lottery!.name} ${sorteoLabel} — Resultado y Premios Secos`,
          description: `Resultado ${this.lottery!.name} ${this.formatDateLong(this.date)}: número ganador ${draw.number} serie ${draw.series || ''}. Premio mayor y todos los premios secos.`,
          url: `/loteria/${this.lottery!.slug}/sorteo/${this.date}`,
        });
        this.lotteryService.getSecos(lotteryId, this.date).subscribe({
          next: (secos) => {
            this.secos = secos;
            this.isLoading = false;
          },
          error: () => this.isLoading = false,
        });
      },
      error: () => this.isLoading = false,
    });
  }

  formatPrize(millions: number): string {
    if (millions >= 1000) {
      const billions = millions / 1000;
      return `$${billions.toLocaleString('es-CO', { maximumFractionDigits: 1 })} Mil Millones`;
    }
    return `$${millions.toLocaleString('es-CO')} Millones`;
  }

  formatDateLong(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-CO', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatDateShort(dateStr: string): string {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('es-CO', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
}
