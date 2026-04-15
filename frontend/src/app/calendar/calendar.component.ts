import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LotteryService, Lottery } from '../services/lottery.service';
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

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const DAY_MAP: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

interface CalendarDay {
  date: number;
  fullDate: string; // YYYY-MM-DD
  isCurrentMonth: boolean;
  isToday: boolean;
  isHoliday: boolean;
  holidayName?: string;
  lotteries: LotteryEntry[];
}

interface LotteryEntry {
  lottery: Lottery;
  moved: boolean; // true if moved from a holiday
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [RouterLink],
  template: `
    @if (isLoading) {
      <!-- Skeleton -->
      <div class="animate-pulse">
        <div class="flex items-center justify-between mb-8">
          <div class="h-8 w-48 bg-gray-200 rounded-lg"></div>
          <div class="flex gap-2">
            <div class="h-9 w-9 bg-gray-200 rounded-lg"></div>
            <div class="h-9 w-28 bg-gray-200 rounded-lg"></div>
            <div class="h-9 w-9 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
        <div class="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
          <div class="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
            @for (_ of [1,2,3,4,5,6,7]; track $index) {
              <div class="px-2 py-3 text-center"><div class="h-3 w-8 bg-gray-200 rounded mx-auto"></div></div>
            }
          </div>
          @for (_ of [1,2,3,4,5]; track $index) {
            <div class="grid grid-cols-7 border-b border-gray-50">
              @for (_ of [1,2,3,4,5,6,7]; track $index) {
                <div class="min-h-[100px] lg:min-h-[120px] p-2 border-r border-gray-50">
                  <div class="h-5 w-5 bg-gray-200 rounded mb-2"></div>
                  <div class="space-y-1.5">
                    <div class="h-5 w-full bg-gray-100 rounded"></div>
                    <div class="h-5 w-3/4 bg-gray-100 rounded"></div>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    } @else {
      <!-- Header -->
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
        <h1 class="font-heading font-bold text-2xl text-gray-900">Calendario de Sorteos</h1>
        <div class="flex items-center gap-2">
          <button
            class="btn btn-ghost btn-sm btn-square"
            (click)="prevMonth()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            class="btn btn-ghost btn-sm font-heading font-bold text-base min-w-[160px]"
            (click)="goToday()">
            {{ monthLabel }}
          </button>
          <button
            class="btn btn-ghost btn-sm btn-square"
            (click)="nextMonth()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Calendar -->
      <div class="bg-white rounded-2xl border border-gray-100 shadow-md overflow-hidden">
        <!-- Day headers -->
        <div class="grid grid-cols-7 bg-gray-50 border-b border-gray-100">
          @for (dayName of dayNames; track dayName) {
            <div class="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wider text-gray-400">
              {{ dayName }}
            </div>
          }
        </div>

        <!-- Weeks -->
        @for (week of weeks; track $index) {
          <div class="grid grid-cols-7 border-b border-gray-50 last:border-b-0">
            @for (day of week; track $index) {
              <div
                class="min-h-[90px] lg:min-h-[120px] p-1.5 lg:p-2 border-r border-gray-50 last:border-r-0 transition-colors"
                [class.bg-white]="day.isCurrentMonth"
                [class.bg-gray-50/50]="!day.isCurrentMonth">
                <!-- Day number -->
                <div class="flex items-center justify-center mb-1 gap-1">
                  <span
                    class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium"
                    [class.bg-brand-600]="day.isToday"
                    [class.text-white]="day.isToday"
                    [class.font-bold]="day.isToday"
                    [class.text-gray-800]="day.isCurrentMonth && !day.isToday"
                    [class.text-gray-300]="!day.isCurrentMonth">
                    {{ day.date }}
                  </span>
                  @if (day.isHoliday && day.isCurrentMonth) {
                    <span class="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" [title]="day.holidayName"></span>
                  }
                </div>
                <!-- Lotteries for this day -->
                <div class="space-y-0.5">
                  @for (entry of day.lotteries; track entry.lottery.id) {
                    <a
                      [routerLink]="['/loteria', entry.lottery.slug]"
                      class="flex items-center gap-1 px-1 py-0.5 rounded text-[10px] lg:text-xs hover:opacity-80 transition-opacity cursor-pointer truncate"
                      [style.background-color]="getColor(entry.lottery.slug) + '15'"
                      [style.color]="getColor(entry.lottery.slug)"
                      [class.ring-1]="entry.moved"
                      [class.ring-amber-300]="entry.moved"
                      [title]="entry.moved ? shortName(entry.lottery.name) + ' (movida por festivo)' : shortName(entry.lottery.name)">
                      <img
                        [src]="'logos/' + entry.lottery.slug + '/logo.png'"
                        class="w-3.5 h-3.5 lg:w-4 lg:h-4 object-contain rounded shrink-0" />
                      <span class="truncate font-medium hidden sm:inline">{{ shortName(entry.lottery.name) }}</span>
                      @if (entry.moved) {
                        <span class="text-amber-500 text-[8px] shrink-0">*</span>
                      }
                    </a>
                  }
                </div>
              </div>
            }
          </div>
        }
      </div>

      <!-- Legend -->
      <div class="mt-6 bg-white rounded-2xl border border-gray-100 shadow-md p-5">
        <div class="flex flex-wrap items-center gap-4 mb-4 text-xs text-gray-500">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span> Festivo
          </span>
          <span class="flex items-center gap-1.5">
            <span class="inline-block w-4 h-3 rounded border border-amber-300 bg-amber-50"></span> Movida por festivo
          </span>
        </div>
        <h3 class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Loterías por día de sorteo</h3>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          @for (entry of lotteriesByDay; track entry.day) {
            <div>
              <p class="text-xs font-bold text-gray-700 mb-1.5">{{ entry.dayLabel }}</p>
              <div class="space-y-1">
                @for (lot of entry.lotteries; track lot.id) {
                  <a
                    [routerLink]="['/loteria', lot.slug]"
                    class="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <span class="w-2 h-2 rounded-full shrink-0" [style.background-color]="getColor(lot.slug)"></span>
                    <span class="text-gray-600 text-xs truncate">{{ lot.name }}</span>
                  </a>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }
  `,
})
export class CalendarComponent implements OnInit {
  private lotteryService = inject(LotteryService);
  private seo = inject(SeoService);

  lotteries: Lottery[] = [];
  isLoading = true;
  currentYear = new Date().getFullYear();
  currentMonth = new Date().getMonth();
  dayNames = DAY_NAMES;
  weeks: CalendarDay[][] = [];
  lotteriesByDay: { day: string; dayLabel: string; lotteries: Lottery[] }[] = [];
  private holidays: Map<string, string> = new Map(); // date -> name
  private loadedYears = new Set<number>();

  private dayLabels: Record<string, string> = {
    monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles',
    thursday: 'Jueves', friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo',
  };

  get monthLabel(): string {
    return `${MONTH_NAMES[this.currentMonth]} ${this.currentYear}`;
  }

  ngOnInit(): void {
    this.seo.update({
      title: 'Calendario de Sorteos de Loterías Colombianas 2026',
      description: 'Calendario completo de sorteos de todas las loterías de Colombia. Consulta qué loterías juegan cada día, festivos y cambios de fecha.',
      url: '/calendario',
    });
    this.lotteryService.getLotteries().subscribe({
      next: (lotteries) => {
        this.lotteries = lotteries;
        this.buildLegend();
        this.loadHolidaysAndBuild();
      },
    });
  }

  prevMonth(): void {
    this.currentMonth--;
    if (this.currentMonth < 0) {
      this.currentMonth = 11;
      this.currentYear--;
    }
    this.loadHolidaysAndBuild();
  }

  nextMonth(): void {
    this.currentMonth++;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear++;
    }
    this.loadHolidaysAndBuild();
  }

  goToday(): void {
    const now = new Date();
    this.currentYear = now.getFullYear();
    this.currentMonth = now.getMonth();
    this.loadHolidaysAndBuild();
  }

  getColor(slug: string): string {
    return BRAND_COLORS[slug] || '#6B7280';
  }

  shortName(name: string): string {
    return name
      .replace('Lotería de ', '')
      .replace('Lotería del ', '')
      .replace('Extra de ', 'Extra ');
  }

  private loadHolidaysAndBuild(): void {
    if (this.loadedYears.has(this.currentYear)) {
      this.buildCalendar();
      this.isLoading = false;
      return;
    }
    this.lotteryService.getHolidays(this.currentYear).subscribe({
      next: (holidays) => {
        this.loadedYears.add(this.currentYear);
        holidays.forEach(h => this.holidays.set(h.date, h.name));
        this.buildCalendar();
        this.isLoading = false;
      },
      error: () => {
        // If holidays API fails, build without them
        this.buildCalendar();
        this.isLoading = false;
      },
    });
  }

  private toDateStr(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  private isHoliday(dateStr: string): boolean {
    return this.holidays.has(dateStr);
  }

  /** Given a date that is a holiday, find the next business day (not Sunday, not holiday) */
  private nextBusinessDay(date: Date): Date {
    const next = new Date(date);
    do {
      next.setDate(next.getDate() + 1);
    } while (next.getDay() === 0 || this.isHoliday(this.toDateStr(next)));
    return next;
  }

  private buildCalendar(): void {
    const firstDay = new Date(this.currentYear, this.currentMonth, 1);
    const lastDay = new Date(this.currentYear, this.currentMonth + 1, 0);
    const startOffset = firstDay.getDay();

    const today = new Date();
    const todayStr = this.toDateStr(today);

    // Build a map of dateStr -> LotteryEntry[] for the visible range
    // We need to check a wider range to catch holidays from prev/next month spilling in
    const rangeStart = new Date(this.currentYear, this.currentMonth - 1, 1);
    const rangeEnd = new Date(this.currentYear, this.currentMonth + 2, 0);
    const lotteryMap = new Map<string, LotteryEntry[]>();

    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
      const dateStr = this.toDateStr(d);
      const jsDay = d.getDay();
      const normalLotteries = this.lotteries.filter(l =>
        l.draw_day && DAY_MAP[l.draw_day] === jsDay
      );

      if (this.isHoliday(dateStr) || jsDay === 0) {
        // Holiday: move lotteries to next business day
        if (normalLotteries.length > 0) {
          const nbd = this.nextBusinessDay(d);
          const nbdStr = this.toDateStr(nbd);
          if (!lotteryMap.has(nbdStr)) lotteryMap.set(nbdStr, []);
          for (const lot of normalLotteries) {
            lotteryMap.get(nbdStr)!.push({ lottery: lot, moved: true });
          }
        }
      } else {
        if (!lotteryMap.has(dateStr)) lotteryMap.set(dateStr, []);
        for (const lot of normalLotteries) {
          lotteryMap.get(dateStr)!.push({ lottery: lot, moved: false });
        }
      }
    }

    const days: CalendarDay[] = [];

    // Previous month fill
    const prevLastDay = new Date(this.currentYear, this.currentMonth, 0);
    for (let i = startOffset - 1; i >= 0; i--) {
      const dd = prevLastDay.getDate() - i;
      const date = new Date(this.currentYear, this.currentMonth - 1, dd);
      const dateStr = this.toDateStr(date);
      days.push({
        date: dd,
        fullDate: dateStr,
        isCurrentMonth: false,
        isToday: false,
        isHoliday: this.isHoliday(dateStr),
        holidayName: this.holidays.get(dateStr),
        lotteries: lotteryMap.get(dateStr) || [],
      });
    }

    // Current month
    for (let dd = 1; dd <= lastDay.getDate(); dd++) {
      const date = new Date(this.currentYear, this.currentMonth, dd);
      const dateStr = this.toDateStr(date);
      days.push({
        date: dd,
        fullDate: dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
        isHoliday: this.isHoliday(dateStr),
        holidayName: this.holidays.get(dateStr),
        lotteries: lotteryMap.get(dateStr) || [],
      });
    }

    // Next month fill
    const remaining = 7 - (days.length % 7);
    if (remaining < 7) {
      for (let dd = 1; dd <= remaining; dd++) {
        const date = new Date(this.currentYear, this.currentMonth + 1, dd);
        const dateStr = this.toDateStr(date);
        days.push({
          date: dd,
          fullDate: dateStr,
          isCurrentMonth: false,
          isToday: false,
          isHoliday: this.isHoliday(dateStr),
          holidayName: this.holidays.get(dateStr),
          lotteries: lotteryMap.get(dateStr) || [],
        });
      }
    }

    this.weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      this.weeks.push(days.slice(i, i + 7));
    }
  }

  private buildLegend(): void {
    const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    this.lotteriesByDay = dayOrder
      .map(day => ({
        day,
        dayLabel: this.dayLabels[day] || day,
        lotteries: this.lotteries.filter(l => l.draw_day === day),
      }))
      .filter(entry => entry.lotteries.length > 0);
  }
}
