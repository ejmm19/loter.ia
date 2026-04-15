import { Component, OnInit, inject, HostListener, ElementRef } from '@angular/core';
import { NgClass } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LotteryService, Lottery, Draw, CheckResult } from '../services/lottery.service';

@Component({
  selector: 'app-checker',
  standalone: true,
  imports: [NgClass, FormsModule],
  template: `
    <div class="bg-gradient-to-br from-gray-50 to-white rounded-2xl shadow-md border border-gray-100 p-7">
      <h2 class="font-heading font-bold text-lg text-gray-900 mb-5 text-center">¡Consulta si tu número es el ganador!</h2>

      <div class="space-y-4">
        <!-- Lotería (custom dropdown con logos) -->
        <div class="relative">
          <button
            type="button"
            class="flex items-center gap-3 w-full px-4 py-3 bg-white border border-gray-300 rounded-lg text-left cursor-pointer hover:border-brand-500 transition-colors"
            (click)="dropdownOpen = !dropdownOpen">
            @if (selectedLottery) {
              <img
                [src]="'logos/' + selectedLottery.slug + '/logo.png'"
                [alt]="selectedLottery.name"
                class="w-7 h-7 object-contain rounded shrink-0" />
              <span class="text-gray-800 text-sm flex-1">{{ selectedLottery.name }}</span>
            } @else {
              <span class="text-gray-400 text-sm flex-1">Selecciona lotería</span>
            }
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-gray-400 shrink-0 transition-transform" [class.rotate-180]="dropdownOpen" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          @if (dropdownOpen) {
            <div class="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-60 overflow-y-auto">
              @for (lot of lotteries; track lot.id) {
                <button
                  type="button"
                  class="flex items-center gap-3 w-full px-4 py-2.5 hover:bg-gray-50 transition-colors text-left"
                  [class.bg-brand-50]="lot.id === checkLotteryId"
                  (click)="selectLottery(lot.id)">
                  <img
                    [src]="'logos/' + lot.slug + '/logo.png'"
                    [alt]="lot.name"
                    class="w-7 h-7 object-contain rounded shrink-0" />
                  <span class="text-gray-700 text-sm">{{ lot.name }}</span>
                </button>
              }
            </div>
          }
        </div>

        <!-- Sorteo -->
        <select
          class="select select-bordered w-full bg-white focus:border-brand-500 focus:outline-brand-500"
          [(ngModel)]="checkDrawId"
          [disabled]="!draws.length">
          <option [ngValue]="0" disabled>Selecciona sorteo</option>
          @for (draw of draws; track draw.id) {
            <option [ngValue]="draw.id">{{ draw.number }} — {{ formatDate(draw.draw_date) }}</option>
          }
        </select>

        <!-- Número y Serie -->
        <div class="flex gap-4">
          <div class="flex-1">
            <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 block">Número</label>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              class="input input-bordered w-full bg-white text-center text-lg tracking-widest focus:border-brand-500 focus:outline-brand-500"
              style="font-family: 'Fredoka', sans-serif; font-weight: 700;"
              placeholder="0000"
              maxlength="4"
              (input)="onNumberInput($event)"
              [(ngModel)]="checkNumber" />
          </div>
          <div class="w-28">
            <label class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5 block">Serie</label>
            <input
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              class="input input-bordered w-full bg-white text-center text-lg tracking-widest focus:border-brand-500 focus:outline-brand-500"
              style="font-family: 'Fredoka', sans-serif; font-weight: 700;"
              placeholder="000"
              maxlength="3"
              (input)="onNumberInput($event)"
              [(ngModel)]="checkSeries" />
          </div>
        </div>

        <!-- Botón -->
        <button
          class="btn btn-primary w-full text-base tracking-wide shadow-md hover:shadow-lg transition-shadow"
          [disabled]="!checkLotteryId || !checkNumber || isChecking"
          (click)="checkWinner()">
          @if (isChecking) {
            <span class="loading loading-spinner loading-sm"></span>
          } @else {
            CONSULTAR
          }
        </button>
      </div>
    </div>

    <!-- Modal de resultado -->
    @if (showModal) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
        (click)="closeModal()">
        <!-- Backdrop -->
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"></div>

        <!-- Modal -->
        <div
          class="relative bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center animate-popIn"
          (click)="$event.stopPropagation()">

          @if (checkResult?.match && matchedDraw) {
            <!-- Ganador -->
            <div class="mb-4">
              <div class="w-24 h-24 mx-auto bg-emerald-100 rounded-full flex items-center justify-center animate-bounceIn">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 class="font-heading font-bold text-2xl text-emerald-700 mb-2">¡Felicidades!</h3>
            <p class="text-gray-600 mb-1">Tu número coincide con un sorteo</p>
            <div class="my-4 py-3 px-4 bg-emerald-50 rounded-xl">
              <p class="text-emerald-800 font-bold text-3xl mb-1" style="font-family: 'Fredoka', sans-serif;">
                {{ matchedDraw.number }}
              </p>
              <p class="text-emerald-600 text-sm">
                Serie <span class="font-bold" style="font-family: 'Fredoka', sans-serif;">{{ matchedDraw.series }}</span>
              </p>
            </div>
            <p class="text-gray-400 text-xs">{{ formatDate(matchedDraw.draw_date) }}</p>

            <!-- Confetti particles -->
            <div class="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
              @for (p of confettiParticles; track $index) {
                <div
                  class="absolute w-2 h-2 rounded-full"
                  [style.left.%]="p.x"
                  [style.background-color]="p.color"
                  [style.animation]="'confettiFall ' + p.duration + 's ease-out ' + p.delay + 's forwards'">
                </div>
              }
            </div>
          } @else {
            <!-- No ganador -->
            <div class="mb-4">
              <div class="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center animate-shakeX">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <h3 class="font-heading font-bold text-2xl text-red-500 mb-2">No esta vez</h3>
            <p class="text-gray-500 mb-1">Tu número no coincide con este sorteo</p>
            <p class="text-gray-400 text-sm mt-3">¡Sigue intentando, la suerte está de tu lado!</p>
          }

          <button
            class="btn btn-ghost btn-sm mt-5 text-gray-400 hover:text-gray-600"
            (click)="closeModal()">
            Cerrar
          </button>
        </div>
      </div>
    }
  `,
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    @keyframes popIn {
      0% { opacity: 0; transform: scale(0.8) translateY(20px); }
      60% { transform: scale(1.05) translateY(-5px); }
      100% { opacity: 1; transform: scale(1) translateY(0); }
    }
    @keyframes bounceIn {
      0% { transform: scale(0); }
      50% { transform: scale(1.2); }
      70% { transform: scale(0.9); }
      100% { transform: scale(1); }
    }
    @keyframes shakeX {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-10px); }
      40% { transform: translateX(10px); }
      60% { transform: translateX(-6px); }
      80% { transform: translateX(6px); }
    }
    @keyframes confettiFall {
      0% { top: -10%; opacity: 1; transform: rotate(0deg) scale(1); }
      100% { top: 110%; opacity: 0; transform: rotate(720deg) scale(0.5); }
    }
    .animate-fadeIn { animation: fadeIn 0.3s ease-out forwards; }
    .animate-popIn { animation: popIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
    .animate-bounceIn { animation: bounceIn 0.6s ease-out 0.2s both; }
    .animate-shakeX { animation: shakeX 0.6s ease-out 0.2s both; }
  `],
})
export class CheckerComponent implements OnInit {
  private lotteryService = inject(LotteryService);
  private el = inject(ElementRef);

  @HostListener('document:click', ['$event'])
  onDocClick(event: MouseEvent): void {
    if (!this.el.nativeElement.contains(event.target)) {
      this.dropdownOpen = false;
    }
  }

  lotteries: Lottery[] = [];
  draws: Draw[] = [];
  checkLotteryId = 0;
  checkDrawId = 0;
  checkNumber = '';
  checkSeries = '';
  isChecking = false;
  checkResult: CheckResult | null = null;
  showModal = false;
  dropdownOpen = false;

  get matchedDraw() { return this.checkResult?.draw ?? null; }
  get selectedLottery() { return this.lotteries.find(l => l.id === this.checkLotteryId) ?? null; }

  confettiColors = ['#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6', '#ec4899'];
  confettiParticles: { x: number; color: string; duration: number; delay: number }[] = [];

  ngOnInit(): void {
    this.lotteryService.getLotteries().subscribe({
      next: (lotteries) => this.lotteries = lotteries,
    });
  }

  selectLottery(id: number): void {
    this.checkLotteryId = id;
    this.dropdownOpen = false;
    this.onLotteryChange();
  }

  onNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '');
  }

  onLotteryChange(): void {
    this.draws = [];
    this.checkDrawId = 0;
    this.checkResult = null;
    if (this.checkLotteryId) {
      this.lotteryService.getDraws(this.checkLotteryId, 10).subscribe({
        next: (draws) => this.draws = draws,
      });
    }
  }

  checkWinner(): void {
    if (!this.checkLotteryId || !this.checkNumber || this.isChecking) return;
    this.isChecking = true;
    this.checkResult = null;

    this.lotteryService.checkNumber(this.checkLotteryId, this.checkNumber, this.checkSeries || undefined).subscribe({
      next: (result) => {
        this.checkResult = result;
        this.isChecking = false;
        if (result.match) {
          this.generateConfetti();
        }
        this.showModal = true;
      },
      error: () => {
        this.checkResult = { match: false, message: 'Error al consultar. Intenta de nuevo.' };
        this.isChecking = false;
        this.showModal = true;
      },
    });
  }

  closeModal(): void {
    this.showModal = false;
  }

  private generateConfetti(): void {
    this.confettiParticles = Array.from({ length: 30 }, () => ({
      x: Math.random() * 100,
      color: this.confettiColors[Math.floor(Math.random() * this.confettiColors.length)],
      duration: 1 + Math.random() * 2,
      delay: Math.random() * 0.5,
    }));
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
}
