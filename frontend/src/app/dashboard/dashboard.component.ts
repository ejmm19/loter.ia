import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { UserService, PredictionHistoryItem, UserStats, Favorite } from './user.service';
import { AuthService } from '../auth/auth.service';
import { BillingService, SubscriptionStatus } from '../billing/billing.service';

type Tab = 'history' | 'favorites' | 'stats';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-900 py-8 px-4">
      <div class="max-w-4xl mx-auto">

        <!-- Header -->
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold text-white">Mi Dashboard</h1>
            <p data-testid="user-greeting" class="text-purple-300 mt-1">Bienvenido, {{ auth.user()?.name }}</p>
          </div>
          <div class="flex items-center gap-3">
            <span
              data-testid="plan-badge"
              class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide"
              [class]="subscription()?.plan === 'pro'
                ? 'bg-purple-500 text-white'
                : 'bg-white/10 text-purple-300'">
              {{ subscription()?.plan === 'pro' ? 'Pro' : 'Free' }}
            </span>
            @if (subscription()?.plan !== 'pro') {
              <a routerLink="/pricing"
                 class="px-4 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-white text-sm font-semibold transition-colors">
                Actualizar a Pro
              </a>
            }
          </div>
        </div>

        <!-- Success banner (from checkout redirect) -->
        @if (showCheckoutSuccess()) {
          <div class="bg-green-900/50 border border-green-500 text-green-200 rounded-xl p-4 mb-6">
            ¡Suscripción activada correctamente! Ya tienes acceso a todas las funciones Pro.
          </div>
        }

        <!-- Stats cards -->
        @if (stats()) {
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div class="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <div class="text-2xl font-bold text-white">{{ stats()!.totalPredictions }}</div>
              <div class="text-purple-300 text-xs mt-1">Predicciones</div>
            </div>
            <div class="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <div class="text-2xl font-bold text-green-400">{{ stats()!.predictionsWithHits }}</div>
              <div class="text-purple-300 text-xs mt-1">Con aciertos</div>
            </div>
            <div class="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <div class="text-2xl font-bold text-yellow-400">{{ stats()!.avgMatchedNumbers }}</div>
              <div class="text-purple-300 text-xs mt-1">Promedio aciertos</div>
            </div>
            <div class="bg-white/5 rounded-xl p-4 text-center border border-white/10">
              <div class="text-2xl font-bold text-purple-400">{{ stats()!.bestMatch }}</div>
              <div class="text-purple-300 text-xs mt-1">Mejor racha</div>
            </div>
          </div>
        }

        <!-- Tabs -->
        <div class="flex gap-1 bg-white/5 rounded-xl p-1 mb-6 border border-white/10">
          @for (tab of tabs; track tab.id) {
            <button
              (click)="setTab(tab.id)"
              class="flex-1 py-2 rounded-lg text-sm font-semibold transition-colors"
              [class]="activeTab() === tab.id
                ? 'bg-purple-600 text-white'
                : 'text-purple-300 hover:text-white'">
              {{ tab.label }}
            </button>
          }
        </div>

        <!-- History tab -->
        @if (activeTab() === 'history') {
          @if (historyLoading()) {
            <div class="text-center text-purple-300 py-12">Cargando historial...</div>
          } @else if (history().length === 0) {
            <div class="text-center text-purple-400 py-12">
              <p class="text-lg">No hay predicciones todavía.</p>
              <a data-testid="predict-button" routerLink="/predictions"
                 class="mt-4 inline-block px-6 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold transition-colors">
                Generar mi primera predicción
              </a>
            </div>
          } @else {
            <div data-testid="lottery-list" class="space-y-3">
              @for (item of history(); track item.id) {
                <div data-testid="lottery-item" class="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div class="flex items-start justify-between gap-4">
                    <div>
                      <span class="text-purple-300 text-xs">{{ item.lotteryName }}</span>
                      <div class="flex flex-wrap gap-2 mt-2">
                        @for (n of item.predictedNumbers; track n) {
                          <span
                            class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
                            [class]="item.actualNumbers && item.actualNumbers.includes(n)
                              ? 'bg-green-500 text-white'
                              : 'bg-purple-700 text-purple-100'">
                            {{ n }}
                          </span>
                        }
                      </div>
                    </div>
                    <div class="text-right flex-shrink-0">
                      @if (item.matchedCount !== null) {
                        <span
                          class="text-xs font-bold px-2 py-1 rounded-full"
                          [class]="item.matchedCount > 0
                            ? 'bg-green-900/50 text-green-300 border border-green-600'
                            : 'bg-white/5 text-purple-400'">
                          {{ item.matchedCount }} acierto{{ item.matchedCount !== 1 ? 's' : '' }}
                        </span>
                      } @else {
                        <span class="text-xs text-purple-500">Pendiente</span>
                      }
                      <div class="text-purple-500 text-xs mt-1">
                        {{ item.createdAt | date:'dd/MM/yy' }}
                      </div>
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        }

        <!-- Favorites tab -->
        @if (activeTab() === 'favorites') {
          @if (favorites().length === 0) {
            <div class="text-center text-purple-400 py-12">
              <p class="text-lg">No tienes números favoritos guardados.</p>
              <p class="text-sm mt-2 text-purple-500">
                Guarda combinaciones desde la página de predicciones.
              </p>
            </div>
          } @else {
            <div class="space-y-3">
              @for (fav of favorites(); track fav.id) {
                <div class="bg-white/5 rounded-xl p-4 border border-white/10 flex items-center justify-between gap-4">
                  <div>
                    <div class="text-purple-300 text-xs mb-2">
                      {{ fav.lotteryName }}
                      @if (fav.label) { — <span class="text-purple-200">{{ fav.label }}</span> }
                    </div>
                    <div class="flex flex-wrap gap-2">
                      @for (n of fav.numbers; track n) {
                        <span class="w-9 h-9 rounded-full bg-purple-700 text-purple-100
                                     flex items-center justify-center text-sm font-bold">
                          {{ n }}
                        </span>
                      }
                    </div>
                  </div>
                  <button
                    (click)="deleteFavorite(fav.id)"
                    class="text-red-400 hover:text-red-300 text-xs transition-colors flex-shrink-0">
                    Eliminar
                  </button>
                </div>
              }
            </div>
          }
        }

        <!-- Stats tab -->
        @if (activeTab() === 'stats') {
          @if (!stats()) {
            <div class="text-center text-purple-300 py-12">Cargando estadísticas...</div>
          } @else {
            <div class="space-y-6">
              <div class="bg-white/5 rounded-xl p-6 border border-white/10">
                <h3 class="text-white font-semibold mb-4">Rendimiento general</h3>
                <dl class="grid grid-cols-2 gap-4">
                  <div>
                    <dt class="text-purple-400 text-xs">Total predicciones</dt>
                    <dd class="text-white text-xl font-bold">{{ stats()!.totalPredictions }}</dd>
                  </div>
                  <div>
                    <dt class="text-purple-400 text-xs">Evaluadas</dt>
                    <dd class="text-white text-xl font-bold">{{ stats()!.resolvedPredictions }}</dd>
                  </div>
                  <div>
                    <dt class="text-purple-400 text-xs">Con al menos 1 acierto</dt>
                    <dd class="text-green-400 text-xl font-bold">{{ stats()!.predictionsWithHits }}</dd>
                  </div>
                  <div>
                    <dt class="text-purple-400 text-xs">Mejor resultado</dt>
                    <dd class="text-yellow-400 text-xl font-bold">{{ stats()!.bestMatch }} aciertos</dd>
                  </div>
                  <div>
                    <dt class="text-purple-400 text-xs">Promedio de aciertos</dt>
                    <dd class="text-purple-200 text-xl font-bold">{{ stats()!.avgMatchedNumbers }}</dd>
                  </div>
                  @if (stats()!.topLottery) {
                    <div>
                      <dt class="text-purple-400 text-xs">Lotería favorita</dt>
                      <dd class="text-purple-200 text-xl font-bold">{{ stats()!.topLottery }}</dd>
                    </div>
                  }
                </dl>
              </div>

              @if (subscription()?.plan !== 'pro') {
                <div class="bg-purple-900/50 border border-purple-500/50 rounded-xl p-6 text-center">
                  <p class="text-purple-200 mb-4">
                    Actualiza a Pro para desbloquear estadísticas avanzadas, predicciones
                    ilimitadas y notificaciones por email.
                  </p>
                  <a routerLink="/pricing"
                     class="px-6 py-2 rounded-xl bg-purple-500 hover:bg-purple-400 text-white font-semibold transition-colors">
                    Ver planes
                  </a>
                </div>
              }
            </div>
          }
        }

      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly userSvc = inject(UserService);
  private readonly billingSvc = inject(BillingService);

  readonly history = signal<PredictionHistoryItem[]>([]);
  readonly historyLoading = signal(false);
  readonly favorites = signal<Favorite[]>([]);
  readonly stats = signal<UserStats | null>(null);
  readonly subscription = signal<SubscriptionStatus | null>(null);
  readonly activeTab = signal<Tab>('history');
  readonly showCheckoutSuccess = signal(false);

  readonly tabs = [
    { id: 'history' as Tab, label: 'Historial' },
    { id: 'favorites' as Tab, label: 'Favoritos' },
    { id: 'stats' as Tab, label: 'Estadísticas' },
  ];

  ngOnInit(): void {
    if (window.location.search.includes('checkout=success')) {
      this.showCheckoutSuccess.set(true);
    }

    this.loadHistory();
    this.loadStats();
    this.loadFavorites();
    this.loadSubscription();
  }

  setTab(tab: Tab): void {
    this.activeTab.set(tab);
  }

  loadHistory(): void {
    this.historyLoading.set(true);
    this.userSvc.getHistory().subscribe({
      next: ({ predictions }) => {
        this.history.set(predictions);
        this.historyLoading.set(false);
      },
      error: () => this.historyLoading.set(false),
    });
  }

  loadStats(): void {
    this.userSvc.getStats().subscribe({
      next: (s) => this.stats.set(s),
      error: () => {},
    });
  }

  loadFavorites(): void {
    this.userSvc.getFavorites().subscribe({
      next: ({ favorites }) => this.favorites.set(favorites),
      error: () => {},
    });
  }

  loadSubscription(): void {
    this.billingSvc.getSubscription().subscribe({
      next: (sub) => this.subscription.set(sub),
      error: () => {},
    });
  }

  deleteFavorite(id: number): void {
    this.userSvc.deleteFavorite(id).subscribe({
      next: () => this.favorites.update((favs) => favs.filter((f) => f.id !== id)),
      error: () => {},
    });
  }
}
