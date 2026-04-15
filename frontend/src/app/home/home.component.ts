import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LotteryService, LatestResult, HotDigit, Lottery, DreamCategory, DreamResult } from '../services/lottery.service';
import { AuthService } from '../services/auth.service';
import { SeoService } from '../services/seo.service';
import { AuthModalComponent } from '../auth/auth-modal.component';
import { CheckerComponent } from '../checker/checker.component';

interface Slide {
  name: string;
  slug: string;
  date: string;
  digits: string[];
  series: string;
  colorClass: string;
  brandColor: string;
}

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
};

const BADGE_COLORS = [
  'badge-success', 'badge-info', 'badge-warning',
  'badge-error', 'badge-primary', 'badge-secondary',
  'badge-accent',
];

@Component({
  selector: 'app-home',
  imports: [NgClass, FormsModule, RouterLink, CheckerComponent, AuthModalComponent],
  template: `
    <section class="py-8 lg:py-12">
      <div class="flex flex-col lg:flex-row gap-10 items-center">

        <!-- Izquierda: Carousel -->
        <div class="w-full lg:w-1/2">
          @if (slides.length) {
            <a
              [routerLink]="['/loteria', slides[activeIndex].slug]"
              class="block relative rounded-3xl p-8 shadow-xl overflow-hidden min-h-[500px] flex flex-col justify-end cursor-pointer hover:shadow-2xl transition-shadow duration-300"
              [style.background-image]="'url(logos/' + slides[activeIndex].slug + '/logo.png)'"
              style="background-size: 45%; background-position: center 12%; background-repeat: no-repeat; background-color: #fff;">
              <!-- Overlay degradado en el 60% inferior -->
              <div
                class="absolute inset-x-0 bottom-0 h-[60%] transition-colors duration-700"
                [style.background]="'linear-gradient(to top, ' + slides[activeIndex].brandColor + ', ' + slides[activeIndex].brandColor + 'e6 40%, transparent)'"></div>

              <!-- Contenido sobre el overlay -->
              <div class="relative z-10">
              <!-- Bolitas de números -->
              <div class="flex justify-center gap-5 mb-4">
                @for (digit of displayDigits; track $index) {
                  <div class="relative group">
                    <!-- Glow -->
                    <div
                      class="absolute inset-0 rounded-full blur-md opacity-50 transition-transform duration-300"
                      [class.scale-125]="isSpinning"
                      [ngClass]="ballGlow[$index]"></div>
                    <!-- Ball -->
                    <div
                      class="relative w-[68px] h-[68px] rounded-full flex items-center justify-center text-[28px] shadow-xl ring-2 ring-white/25 transition-transform duration-150"
                      [class.scale-90]="isSpinning"
                      style="font-family: 'Fredoka', sans-serif; font-weight: 700;"
                      [ngClass]="ballColors[$index]">
                      {{ digit }}
                    </div>
                  </div>
                }
              </div>

              <!-- Serie -->
              <p class="text-center text-white/80 text-sm">
                Serie <span class="text-white text-2xl ml-1" style="font-family: 'Fredoka', sans-serif; font-weight: 700;">{{ slides[activeIndex].series }}</span>
              </p>

              <!-- Fecha -->
              <p class="text-center text-white/60 text-xs mt-3">{{ slides[activeIndex].date }}</p>
              </div>

              <!-- Controles -->
              <div class="flex items-center justify-between mt-6 relative z-10">
                <button
                  class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  (click)="prev(); $event.preventDefault(); $event.stopPropagation()"
                  aria-label="Anterior">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                <div class="flex gap-2">
                  @for (slide of slides; track $index) {
                    <button
                      class="h-2 rounded-full transition-all duration-300"
                      [ngClass]="$index === activeIndex ? 'bg-white w-6' : 'bg-white/30 w-2'"
                      (click)="goTo($index); $event.preventDefault(); $event.stopPropagation()"
                      [attr.aria-label]="'Ir a ' + slide.name">
                    </button>
                  }
                </div>

                <button
                  class="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  (click)="next(); $event.preventDefault(); $event.stopPropagation()"
                  aria-label="Siguiente">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </a>
            <p class="text-gray-400 text-[11px] text-center mt-3">Última actualización: {{ lastUpdate }}</p>
          } @else {
            <!-- Skeleton loader -->
            <div class="rounded-3xl bg-gray-200 shadow-xl min-h-[500px] p-8 flex flex-col justify-between animate-pulse">
              <!-- Logo skeleton -->
              <div class="flex justify-center pt-4">
                <div class="w-40 h-40 bg-gray-300 rounded-2xl"></div>
              </div>
              <!-- Balls skeleton -->
              <div class="space-y-4">
                <div class="flex justify-center gap-5">
                  <div class="w-[68px] h-[68px] rounded-full bg-gray-300"></div>
                  <div class="w-[68px] h-[68px] rounded-full bg-gray-300"></div>
                  <div class="w-[68px] h-[68px] rounded-full bg-gray-300"></div>
                  <div class="w-[68px] h-[68px] rounded-full bg-gray-300"></div>
                </div>
                <!-- Serie skeleton -->
                <div class="flex justify-center">
                  <div class="h-5 w-32 bg-gray-300 rounded-full"></div>
                </div>
                <!-- Date skeleton -->
                <div class="flex justify-center">
                  <div class="h-3 w-48 bg-gray-300 rounded-full"></div>
                </div>
              </div>
              <!-- Controls skeleton -->
              <div class="flex items-center justify-between">
                <div class="w-10 h-10 rounded-full bg-gray-300"></div>
                <div class="flex gap-2">
                  <div class="w-6 h-2 bg-gray-300 rounded-full"></div>
                  <div class="w-2 h-2 bg-gray-300 rounded-full"></div>
                  <div class="w-2 h-2 bg-gray-300 rounded-full"></div>
                </div>
                <div class="w-10 h-10 rounded-full bg-gray-300"></div>
              </div>
            </div>
          }
        </div>

        <!-- Derecha: Info -->
        <div class="w-full lg:w-1/2">
          @if (isLoading) {
            <!-- Skeleton panel derecho -->
            <div class="animate-pulse space-y-4">
              <div class="h-8 w-3/4 bg-gray-200 rounded-lg"></div>
              <div class="h-4 w-full bg-gray-200 rounded-lg"></div>
              <div class="h-4 w-5/6 bg-gray-200 rounded-lg"></div>
              <div class="h-4 w-2/3 bg-gray-200 rounded-lg"></div>
              <!-- Tags skeleton -->
              <div class="flex flex-wrap gap-2 mt-4">
                <div class="h-8 w-20 bg-gray-200 rounded-full"></div>
                <div class="h-8 w-24 bg-gray-200 rounded-full"></div>
                <div class="h-8 w-28 bg-gray-200 rounded-full"></div>
                <div class="h-8 w-18 bg-gray-200 rounded-full"></div>
                <div class="h-8 w-22 bg-gray-200 rounded-full"></div>
                <div class="h-8 w-20 bg-gray-200 rounded-full"></div>
                <div class="h-8 w-26 bg-gray-200 rounded-full"></div>
                <div class="h-8 w-16 bg-gray-200 rounded-full"></div>
              </div>
            </div>
          } @else {
          <h1 class="font-heading font-bold text-[28px] text-gray-900 leading-tight mb-4">
            Resultados de las principales
            <span class="text-brand-600">loterías</span>
          </h1>
          <p class="text-gray-600 mb-6">
            Consulta los resultados actualizados de las principales loterías.
            Números ganadores, histórico de resultados por lotería y horarios de sorteos en un solo lugar.
          </p>

          <!-- Verificador de número ganador -->
          <app-checker></app-checker>

          }
        </div>

      </div>
    </section>

    <!-- Sección: Todas las loterías -->
    <section id="loterias" class="py-12 lg:py-16">
      <div class="text-center mb-10">
        <h2 class="font-heading font-bold text-2xl lg:text-3xl text-gray-900 mb-2">
          Todas las loterías
        </h2>
        <p class="text-gray-500 text-sm">Selecciona una lotería para ver su historial completo de resultados</p>
      </div>

      @if (lotteries.length) {
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-1 max-w-4xl mx-auto">
          @for (lot of lotteries; track lot.id) {
            <a
              [routerLink]="['/loteria', lot.slug]"
              class="group flex flex-col items-center gap-1.5 p-1.5 rounded-2xl hover:bg-gray-50 transition-all duration-300 hover:-translate-y-1">
              <div class="w-32 h-32 sm:w-36 sm:h-36 bg-white rounded-xl shadow-md border border-gray-100 flex items-center justify-center p-4 group-hover:shadow-lg transition-shadow">
                <img
                  [src]="'logos/' + lot.slug + '/logo.png'"
                  [alt]="lot.name"
                  class="w-full h-full object-contain" />
              </div>
              <span class="text-gray-500 text-[11px] sm:text-xs text-center leading-tight group-hover:text-brand-600 transition-colors font-medium">{{ lot.name }}</span>
              <span class="text-gray-400 text-[10px]">{{ drawDayLabel(lot.draw_day) }}</span>
            </a>
          }
        </div>
      } @else {
        <!-- Skeleton -->
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 gap-2 max-w-4xl mx-auto animate-pulse">
          @for (_ of [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]; track $index) {
            <div class="flex flex-col items-center gap-1.5 p-1.5">
              <div class="w-32 h-32 sm:w-36 sm:h-36 bg-gray-200 rounded-xl"></div>
              <div class="h-3 w-14 bg-gray-200 rounded"></div>
            </div>
          }
        </div>
      }
    </section>

    <!-- Sección: Números más frecuentes (full-width con parallax) -->
    <section
      class="relative py-16 lg:py-20 -mx-[calc((100vw-100%)/2)] px-[calc((100vw-100%)/2)] overflow-hidden"
      style="background: linear-gradient(135deg, #14532d 0%, #166534 30%, #15803d 60%, #16a34a 100%); background-attachment: fixed;">

      <!-- Tréboles cayendo animados -->
      @for (clover of clovers; track $index) {
        <div
          class="absolute pointer-events-none"
          [style.left.%]="clover.left"
          [style.width.px]="clover.size"
          [style.height.px]="clover.size"
          [style.opacity]="clover.opacity"
          [style.animation]="'cloverFall ' + clover.duration + 's linear ' + clover.delay + 's infinite'">
          <svg [attr.viewBox]="'0 0 80 90'" xmlns="http://www.w3.org/2000/svg"
            [style.transform]="'rotate(' + clover.rotate + 'deg)'">
            <g fill="white">
              <circle cx="40" cy="24" r="13"/>
              <circle cx="26" cy="40" r="13"/>
              <circle cx="54" cy="40" r="13"/>
              <rect x="37" y="48" width="6" height="18" rx="3"/>
            </g>
          </svg>
        </div>
      }

      <div class="relative z-10">
        <div class="text-center mb-10">
          <h2 class="font-heading font-bold text-2xl lg:text-3xl text-white mb-2">
            Estos son los números que más salen
          </h2>
          <p class="text-emerald-200 text-sm">Los dígitos más repetidos en los últimos 30 días — basado en {{ hotTotalDraws }} sorteos</p>
        </div>

        @if (hotDigits.length) {
          <div class="flex justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-14">
            @for (hot of hotDigits; track hot.digit) {
              <div class="flex flex-col items-center">
                <!-- Bolita grande -->
                <div class="relative mb-4">
                  <div class="absolute inset-0 rounded-full bg-white blur-2xl opacity-20 scale-150"></div>
                  <div
                    class="relative w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full bg-white flex items-center justify-center shadow-2xl ring-4 ring-white/20"
                    style="font-family: 'Fredoka', sans-serif; font-weight: 700;">
                    <span class="text-emerald-700 text-4xl sm:text-5xl lg:text-6xl">{{ hot.digit }}</span>
                  </div>
                </div>
                <!-- Contador -->
                <span class="text-white font-bold text-xl" style="font-family: 'Fredoka', sans-serif;">{{ hot.count }}</span>
                <span class="text-emerald-200 text-xs">apariciones</span>
              </div>
            }
          </div>
        } @else {
          <!-- Skeleton -->
          <div class="flex justify-center gap-4 sm:gap-6 md:gap-8 lg:gap-14 animate-pulse">
            @for (_ of [1,2,3,4]; track $index) {
              <div class="flex flex-col items-center gap-3">
                <div class="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 rounded-full bg-white/10"></div>
                <div class="w-10 h-5 bg-white/10 rounded"></div>
                <div class="w-16 h-3 bg-white/10 rounded"></div>
              </div>
            }
          </div>
        }
      </div>
    </section>

    <!-- Sección: Soñador de números -->
    <section
      id="sonar"
      class="relative py-16 lg:py-20 -mx-[calc((100vw-100%)/2)] px-[calc((100vw-100%)/2)] overflow-hidden scroll-mt-20"
      style="background: linear-gradient(135deg, #312e81 0%, #4338ca 40%, #6366f1 100%);">

      <!-- Estrellas decorativas -->
      @for (star of dreamStars; track $index) {
        <div
          class="absolute rounded-full bg-white pointer-events-none"
          [style.left.%]="star.left"
          [style.top.%]="star.top"
          [style.width.px]="star.size"
          [style.height.px]="star.size"
          [style.opacity]="star.opacity"
          [style.animation]="'pulse ' + star.duration + 's ease-in-out ' + star.delay + 's infinite'">
        </div>
      }
      <div class="absolute -top-20 -right-20 w-72 h-72 bg-white/5 rounded-full"></div>
      <div class="absolute -bottom-16 -left-16 w-56 h-56 bg-white/5 rounded-full"></div>

      <div class="relative z-10 max-w-3xl mx-auto">
        <!-- Header visual -->
        <div class="text-center mb-8">
          <div class="text-5xl mb-4">🌙</div>
          <h2 class="font-heading font-bold text-3xl lg:text-4xl text-white mb-3">
            Convierte tus sueños en números
          </h2>
          <p class="text-indigo-200 text-base lg:text-lg max-w-lg mx-auto">
            Cuéntanos qué soñaste y nuestra IA te dará tu número de la suerte
          </p>
        </div>

        <!-- Card principal -->
        <div class="bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 overflow-hidden shadow-2xl">
          <!-- Tabs -->
          <div class="flex">
            <button
              class="flex-1 py-4 text-sm font-bold transition-all text-center"
              style="font-family: 'Raleway', sans-serif; letter-spacing: 0.02em;"
              [class.bg-white/15]="dreamTab === 'ai'"
              [class.text-white]="dreamTab === 'ai'"
              [class.text-white/50]="dreamTab !== 'ai'"
              (click)="dreamTab = 'ai'">
              <span class="text-lg mr-1.5">✨</span> Describe tu sueño
            </button>
            <button
              class="flex-1 py-4 text-sm font-bold transition-all text-center"
              style="font-family: 'Raleway', sans-serif; letter-spacing: 0.02em;"
              [class.bg-white/15]="dreamTab === 'table'"
              [class.text-white]="dreamTab === 'table'"
              [class.text-white/50]="dreamTab !== 'table'"
              (click)="dreamTab = 'table'; loadDreamTable()">
              <span class="text-lg mr-1.5">🔮</span> Tabla chancera
            </button>
          </div>

          <div class="p-6 lg:p-8">
            <!-- Ya usó su revelación hoy -->
            @if (dreamUsedToday && dreamResult) {
              <div class="text-center">
                <p class="text-amber-300 text-xs uppercase tracking-widest font-bold mb-4" style="font-family: 'Raleway', sans-serif;">Tu revelación de hoy</p>
                <div class="flex justify-center gap-3 sm:gap-4 mb-4">
                  @for (d of dreamResult.number.split(''); track $index) {
                    <div class="relative group">
                      <div class="absolute inset-0 rounded-full bg-amber-400 blur-lg opacity-30"></div>
                      <div
                        class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl shadow-2xl ring-2 ring-amber-300/30"
                        style="font-family: 'Fredoka', sans-serif; font-weight: 700; background: linear-gradient(135deg, #f59e0b, #f97316); color: white;">
                        {{ d }}
                      </div>
                    </div>
                  }
                </div>
                <p class="text-white/70 text-sm">
                  Serie <span class="text-white text-2xl ml-1" style="font-family: 'Fredoka', sans-serif; font-weight: 700;">{{ dreamResult.series }}</span>
                </p>
                @if (dreamResult.interpretation) {
                  <p class="text-indigo-200 text-sm mt-4 max-w-md mx-auto leading-relaxed">{{ dreamResult.interpretation }}</p>
                }
                @if (dreamResult.symbols.length) {
                  <div class="flex justify-center gap-2 mt-3">
                    @for (sym of dreamResult.symbols; track sym) {
                      <span class="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium">{{ sym }}</span>
                    }
                  </div>
                }
                <div class="mt-6 pt-6 border-t border-white/10">
                  <div class="flex items-center justify-center gap-2 text-indigo-300 text-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span style="font-family: 'Raleway', sans-serif;">Nueva revelación disponible mañana</span>
                  </div>
                  <p class="text-indigo-400/60 text-xs mt-1">Tienes 1 revelación diaria — ¡que la suerte te acompañe!</p>
                </div>
              </div>
            } @else {

            <!-- AI Tab -->
            @if (dreamTab === 'ai') {
              <div class="space-y-5">
                <textarea
                  [(ngModel)]="dreamText"
                  placeholder="Soñé con un gato negro que caminaba sobre un río de plata..."
                  class="w-full h-28 rounded-2xl bg-white/90 text-gray-800 placeholder-gray-400 px-5 py-4 text-base resize-none focus:outline-none focus:ring-2 focus:ring-white/50 shadow-inner"
                  [disabled]="dreamLoading"
                  maxlength="500"></textarea>
                <div class="flex items-center justify-between">
                  <span class="text-indigo-300 text-xs">{{ dreamText.length }}/500</span>
                  <button
                    class="group relative px-8 py-3.5 rounded-full font-bold text-base transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
                    style="background: linear-gradient(135deg, #f59e0b, #f97316); color: white; font-family: 'Raleway', sans-serif; letter-spacing: 0.03em;"
                    [disabled]="!dreamText.trim() || dreamLoading"
                    (click)="interpretDream()">
                    @if (dreamLoading) {
                      <span class="loading loading-spinner loading-sm mr-2"></span>
                      <span style="font-family: 'Raleway', sans-serif;">Interpretando...</span>
                    } @else {
                      <span class="mr-1.5 text-lg">✨</span> Descubrir mi número
                    }
                    <div class="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  </button>
                </div>
                @if (dreamError) {
                  <div class="p-4 rounded-2xl bg-red-500/20 border border-red-400/30">
                    <p class="text-red-200 text-sm">{{ dreamError }}</p>
                    @if (dreamRequiresAuth) {
                      <button
                        class="mt-2 px-4 py-1.5 rounded-full bg-white text-indigo-700 text-sm font-bold hover:bg-indigo-50 transition-colors"
                        (click)="showDreamAuthModal = true">
                        Iniciar Sesión para más consultas
                      </button>
                    }
                  </div>
                }
              </div>
            }

            <!-- Table Tab -->
            @if (dreamTab === 'table') {
              @if (dreamCategories.length) {
                <div class="space-y-5">
                  <!-- Category tabs -->
                  <div class="flex gap-2 overflow-x-auto pb-1">
                    @for (cat of dreamCategories; track cat.name) {
                      <button
                        class="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all"
                        style="font-family: 'Raleway', sans-serif;"
                        [class.bg-white]="dreamCategory === cat.name"
                        [class.text-indigo-700]="dreamCategory === cat.name"
                        [class.shadow-md]="dreamCategory === cat.name"
                        [class.bg-white/10]="dreamCategory !== cat.name"
                        [class.text-white/70]="dreamCategory !== cat.name"
                        [class.hover:bg-white/20]="dreamCategory !== cat.name"
                        (click)="dreamCategory = cat.name">
                        {{ cat.icon }} {{ cat.name }}
                      </button>
                    }
                  </div>
                  <!-- Items grid -->
                  <div class="grid grid-cols-4 sm:grid-cols-5 gap-2">
                    @for (item of currentCategoryItems; track item.label) {
                      <button
                        class="flex flex-col items-center gap-1 p-2.5 rounded-2xl border-2 transition-all hover:scale-105 cursor-pointer"
                        [class.border-amber-400]="selectedDreamItems.has(item.label)"
                        [class.bg-white/20]="selectedDreamItems.has(item.label)"
                        [class.shadow-lg]="selectedDreamItems.has(item.label)"
                        [class.border-white/10]="!selectedDreamItems.has(item.label)"
                        [class.bg-white/5]="!selectedDreamItems.has(item.label)"
                        [class.hover:bg-white/15]="!selectedDreamItems.has(item.label)"
                        (click)="toggleDreamItem(item)">
                        <span class="text-2xl sm:text-3xl">{{ item.emoji }}</span>
                        <span class="text-[10px] sm:text-xs text-white/80 font-medium">{{ item.label }}</span>
                        <span class="text-xs font-bold text-amber-300" style="font-family: 'Fredoka', sans-serif;">{{ item.number }}</span>
                      </button>
                    }
                  </div>
                  @if (selectedDreamItems.size > 0) {
                    <div class="flex justify-center">
                      <button
                        class="px-8 py-3.5 rounded-full font-bold text-base shadow-lg hover:shadow-xl hover:scale-[1.03] active:scale-[0.98] transition-all"
                        style="background: linear-gradient(135deg, #f59e0b, #f97316); color: white; font-family: 'Raleway', sans-serif; letter-spacing: 0.03em;"
                        (click)="generateFromTable()">
                        <span class="mr-1.5 text-lg">🔮</span> Revelar mi número ({{ selectedDreamItems.size }})
                      </button>
                    </div>
                  }
                </div>
              } @else {
                <div class="flex justify-center py-8">
                  <span class="loading loading-spinner loading-lg text-white"></span>
                </div>
              }
            }

            <!-- Result (first reveal) -->
            @if (dreamResult) {
              <div class="mt-8 pt-8 border-t border-white/10">
                <div class="text-center">
                  <p class="text-amber-300 text-xs uppercase tracking-widest font-bold mb-4" style="font-family: 'Raleway', sans-serif;">Tu número de la suerte</p>
                  <div class="flex justify-center gap-3 sm:gap-4 mb-4">
                    @for (d of dreamResult.number.split(''); track $index) {
                      <div class="relative group">
                        <div class="absolute inset-0 rounded-full bg-amber-400 blur-lg opacity-30 group-hover:opacity-50 transition-opacity"></div>
                        <div
                          class="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl shadow-2xl ring-2 ring-amber-300/30"
                          style="font-family: 'Fredoka', sans-serif; font-weight: 700; background: linear-gradient(135deg, #f59e0b, #f97316); color: white;">
                          {{ d }}
                        </div>
                      </div>
                    }
                  </div>
                  <p class="text-white/70 text-sm">
                    Serie <span class="text-white text-2xl ml-1" style="font-family: 'Fredoka', sans-serif; font-weight: 700;">{{ dreamResult.series }}</span>
                  </p>
                  @if (dreamResult.interpretation) {
                    <p class="text-indigo-200 text-sm mt-4 max-w-md mx-auto leading-relaxed">{{ dreamResult.interpretation }}</p>
                  }
                  @if (dreamResult.symbols.length) {
                    <div class="flex justify-center gap-2 mt-3">
                      @for (sym of dreamResult.symbols; track sym) {
                        <span class="px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs font-medium">{{ sym }}</span>
                      }
                    </div>
                  }
                </div>
              </div>
            }

            }
          </div>
        </div>
      </div>

      @if (showDreamAuthModal) {
        <app-auth-modal (close)="showDreamAuthModal = false" />
      }
    </section>
  `,
})
export class HomeComponent implements OnInit, OnDestroy {
  private lotteryService = inject(LotteryService);
  private seo = inject(SeoService);

  slides: Slide[] = [];
  displayDigits: string[] = [];
  isSpinning = false;
  isLoading = true;
  ballColors = ['bg-white text-gray-900', 'bg-white text-gray-900', 'bg-white text-gray-900', 'bg-white text-gray-900'];
  ballGlow = ['bg-white', 'bg-white', 'bg-white', 'bg-white'];

  lotteryTags = [
    { name: 'Medellín', color: '#1E3A8A' },
    { name: 'Bogotá', color: '#B91C1C' },
    { name: 'Cundinamarca', color: '#1E40AF' },
    { name: 'Valle', color: '#991B1B' },
    { name: 'Manizales', color: '#1E3A5F' },
    { name: 'Tolima', color: '#7F1D1D' },
    { name: 'Boyacá', color: '#BE123C' },
    { name: 'Huila', color: '#166534' },
    { name: 'Cauca', color: '#0F766E' },
    { name: 'Santander', color: '#15803D' },
    { name: 'Quindío', color: '#14532D' },
    { name: 'Risaralda', color: '#15803D' },
    { name: 'Meta', color: '#92400E' },
    { name: 'Cruz Roja', color: '#DC2626' },
  ];

  lastUpdate = '';
  activeIndex = 0;
  // Dreams
  dreamTab: 'ai' | 'table' = 'ai';
  dreamText = '';
  dreamLoading = false;
  dreamResult: DreamResult | null = null;
  dreamError = '';
  dreamRequiresAuth = false;
  dreamUsedToday = false;
  showDreamAuthModal = false;
  dreamCategories: DreamCategory[] = [];
  dreamCategory = '';
  selectedDreamItems = new Map<string, string>(); // label -> number
  private dreamTableLoaded = false;

  // Estrellas para sección de sueños
  dreamStars = Array.from({ length: 25 }, () => ({
    left: Math.random() * 100,
    top: Math.random() * 100,
    size: 1 + Math.random() * 3,
    opacity: 0.2 + Math.random() * 0.5,
    duration: 2 + Math.random() * 4,
    delay: Math.random() * -4,
  }));

  // Tréboles animados
  clovers = Array.from({ length: 15 }, () => ({
    left: Math.random() * 100,
    size: 16 + Math.random() * 32,
    opacity: 0.04 + Math.random() * 0.08,
    duration: 6 + Math.random() * 10,
    delay: Math.random() * -16,
    rotate: Math.random() * 360,
  }));

  // Loterías
  lotteries: Lottery[] = [];

  // Números calientes
  hotDigits: HotDigit[] = [];
  hotTotalDraws = 0;

  private intervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.seo.update({
      title: 'Resultados de Loterías de Colombia Hoy 2026',
      description: 'Consulta los resultados actualizados de todas las loterías colombianas: Bogotá, Medellín, Boyacá, Cundinamarca, Tolima, Valle, Cruz Roja y más. Números ganadores, premios secos, histórico y tabla de sueños.',
      url: '/',
    });

    // Restaurar revelación del día
    this.restoreDreamResult();

    // Cargar loterías
    this.lotteryService.getLotteries().subscribe({
      next: (lotteries) => this.lotteries = lotteries,
    });

    // Cargar números calientes
    this.lotteryService.getHotNumbers().subscribe({
      next: (res) => {
        this.hotDigits = res.hotDigits;
        this.hotTotalDraws = res.totalDraws;
      },
    });

    this.lotteryService.getLatestResults().subscribe({
      next: (results) => {
        this.slides = results.map((r, i) => ({
          name: r.name,
          slug: r.slug,
          date: this.formatDate(r.draw_date),
          digits: r.number.split(''),
          series: r.series,
          colorClass: BADGE_COLORS[i % BADGE_COLORS.length],
          brandColor: BRAND_COLORS[r.slug] || '#075985',
        }));

        if (results.length) {
          this.lastUpdate = this.formatDate(results[0].draw_date);
          this.displayDigits = [...this.slides[0].digits];
        }

        this.isLoading = false;
        this.startAutoPlay();
      },
    });
  }

  ngOnDestroy(): void {
    this.stopAutoPlay();
  }

  next(): void {
    if (!this.slides.length || this.isSpinning) return;
    const newIndex = (this.activeIndex + 1) % this.slides.length;
    this.spinToSlide(newIndex);
    this.resetAutoPlay();
  }

  prev(): void {
    if (!this.slides.length || this.isSpinning) return;
    const newIndex = (this.activeIndex - 1 + this.slides.length) % this.slides.length;
    this.spinToSlide(newIndex);
    this.resetAutoPlay();
  }

  goTo(index: number): void {
    if (index === this.activeIndex || this.isSpinning) return;
    this.spinToSlide(index);
    this.resetAutoPlay();
  }

  private spinToSlide(newIndex: number): void {
    const targetDigits = this.slides[newIndex].digits;
    this.isSpinning = true;
    this.activeIndex = newIndex;

    const totalTicks = 8;
    const tickMs = 60;
    let tick = 0;

    const spinInterval = setInterval(() => {
      tick++;
      this.displayDigits = targetDigits.map((final, i) => {
        // Each digit settles one by one from left to right
        if (tick >= totalTicks - (targetDigits.length - 1 - i)) {
          return final;
        }
        return String(Math.floor(Math.random() * 10));
      });

      if (tick >= totalTicks) {
        clearInterval(spinInterval);
        this.displayDigits = [...targetDigits];
        this.isSpinning = false;
      }
    }, tickMs);
  }

  setTagHover(event: MouseEvent, color: string, isHover: boolean): void {
    const el = event.target as HTMLElement;
    if (!el) return;
    // Create or reuse the fill pseudo-element
    let fill = el.querySelector('.tag-fill') as HTMLElement;
    if (!fill) {
      fill = document.createElement('span');
      fill.className = 'tag-fill';
      fill.style.cssText = 'position:absolute;inset:0;transform:scaleX(0);transform-origin:left;transition:transform 0.35s cubic-bezier(0.4,0,0.2,1);z-index:0;border-radius:inherit;pointer-events:none;';
      el.insertBefore(fill, el.firstChild);
      // Wrap text in a span for z-index
      const textNodes = Array.from(el.childNodes).filter(n => n !== fill);
      if (!el.querySelector('.tag-text')) {
        const wrapper = document.createElement('span');
        wrapper.className = 'tag-text';
        wrapper.style.cssText = 'position:relative;z-index:1;';
        textNodes.forEach(n => wrapper.appendChild(n));
        el.appendChild(wrapper);
      }
    }
    fill.style.backgroundColor = color;
    if (isHover) {
      fill.style.transform = 'scaleX(1)';
      el.style.color = '#ffffff';
      el.style.borderColor = color;
    } else {
      fill.style.transform = 'scaleX(0)';
      el.style.color = '#4b5563';
      el.style.borderColor = '#9ca3af';
    }
  }

  loadDreamTable(): void {
    if (this.dreamTableLoaded) return;
    this.lotteryService.getDreamTable().subscribe({
      next: (res) => {
        this.dreamCategories = res.categories;
        if (res.categories.length) this.dreamCategory = res.categories[0].name;
        this.dreamTableLoaded = true;
      },
    });
  }

  get currentCategoryItems() {
    return this.dreamCategories.find(c => c.name === this.dreamCategory)?.items || [];
  }

  toggleDreamItem(item: { label: string; number: string }): void {
    if (this.selectedDreamItems.has(item.label)) {
      this.selectedDreamItems.delete(item.label);
    } else {
      this.selectedDreamItems.set(item.label, item.number);
    }
  }

  generateFromTable(): void {
    if (this.dreamUsedToday) return;
    const numbers = [...this.selectedDreamItems.values()];
    const combined = numbers.join('');
    const number = combined.slice(0, 4).padEnd(4, String(Math.floor(Math.random() * 10)));
    const series = combined.length > 4
      ? combined.slice(4, 7).padEnd(3, String(Math.floor(Math.random() * 10)))
      : String(Math.floor(Math.random() * 1000)).padStart(3, '0');

    const result: DreamResult = {
      number,
      series,
      interpretation: `Basado en la tabla chancera: ${[...this.selectedDreamItems.keys()].join(', ')}`,
      symbols: [...this.selectedDreamItems.keys()].slice(0, 3),
    };
    this.dreamResult = result;
    this.saveDreamResult(result);
  }

  private saveDreamResult(result: DreamResult): void {
    this.dreamUsedToday = true;
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('dreamReveal', JSON.stringify({ date: today, result }));
  }

  private restoreDreamResult(): void {
    const saved = localStorage.getItem('dreamReveal');
    if (!saved) return;
    try {
      const { date, result } = JSON.parse(saved);
      const today = new Date().toISOString().split('T')[0];
      if (date === today && result) {
        this.dreamResult = result;
        this.dreamUsedToday = true;
      } else {
        localStorage.removeItem('dreamReveal');
      }
    } catch {
      localStorage.removeItem('dreamReveal');
    }
  }

  interpretDream(): void {
    if (!this.dreamText.trim() || this.dreamLoading || this.dreamUsedToday) return;
    this.dreamLoading = true;
    this.dreamResult = null;
    this.dreamError = '';
    this.dreamRequiresAuth = false;

    this.lotteryService.interpretDream(this.dreamText).subscribe({
      next: (result) => {
        this.dreamResult = result;
        this.dreamLoading = false;
        this.saveDreamResult(result);
      },
      error: (err) => {
        this.dreamError = err.error?.error || 'Error al interpretar. Intenta de nuevo.';
        this.dreamRequiresAuth = !!err.error?.requiresAuth;
        this.dreamLoading = false;
      },
    });
  }

  drawDayLabel(day: string | null): string {
    return day ? DRAW_DAYS[day] || '' : 'Especial';
  }

  formatDate(dateStr: string): string {
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
      if (!this.isSpinning) {
        const newIndex = (this.activeIndex + 1) % this.slides.length;
        this.spinToSlide(newIndex);
      }
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
