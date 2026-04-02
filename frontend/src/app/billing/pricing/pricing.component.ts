import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BillingService, Plan, SubscriptionStatus } from '../billing.service';
import { AuthService } from '../../auth/auth.service';

// Stripe public price ID for the Pro plan — replace with your actual price ID
const PRO_PRICE_ID = 'price_YOUR_PRO_MONTHLY_PRICE_ID';

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div class="min-h-screen bg-gradient-to-br from-purple-950 via-purple-900 to-indigo-900 py-16 px-4">
      <div class="max-w-4xl mx-auto">

        <!-- Header -->
        <div class="text-center mb-12">
          <h1 class="text-4xl font-bold text-white mb-4">Planes de loter.ia</h1>
          <p class="text-purple-200 text-lg">
            Elige el plan que mejor se adapte a tus predicciones
          </p>
        </div>

        <!-- Error -->
        @if (error()) {
          <div class="bg-red-900/50 border border-red-500 text-red-200 rounded-lg p-4 mb-8 text-center">
            {{ error() }}
          </div>
        }

        <!-- Success -->
        @if (showSuccess()) {
          <div class="bg-green-900/50 border border-green-500 text-green-200 rounded-lg p-4 mb-8 text-center">
            ¡Suscripción activada! Ya tienes acceso a todas las funciones Pro.
          </div>
        }

        <!-- Plans -->
        <div class="grid md:grid-cols-2 gap-8">
          @for (plan of plans(); track plan.id) {
            <div
              class="rounded-2xl p-8 border-2 transition-all"
              [class]="plan.id === 'pro'
                ? 'bg-gradient-to-br from-purple-700/50 to-indigo-700/50 border-purple-400 shadow-xl shadow-purple-900/50'
                : 'bg-white/5 border-white/20'"
            >
              @if (plan.id === 'pro') {
                <div class="text-xs font-bold uppercase tracking-widest text-purple-300 mb-3">
                  Más popular
                </div>
              }

              <h2 class="text-2xl font-bold text-white mb-2">{{ plan.name }}</h2>

              <div class="mb-6">
                @if (plan.price === 0) {
                  <span class="text-4xl font-bold text-white">Gratis</span>
                } @else {
                  <span class="text-4xl font-bold text-white">
                    ${{ (plan.price / 100).toFixed(2) }}
                  </span>
                  <span class="text-purple-300 ml-1">USD / mes</span>
                }
              </div>

              <ul class="space-y-3 mb-8">
                @for (feature of plan.features; track feature) {
                  <li class="flex items-start gap-3 text-purple-100">
                    <span class="text-green-400 mt-0.5 flex-shrink-0">✓</span>
                    {{ feature }}
                  </li>
                }
              </ul>

              <!-- CTA -->
              @if (currentPlan() === plan.id) {
                <div class="w-full py-3 rounded-xl text-center font-semibold
                            bg-white/10 text-purple-200 border border-white/20">
                  Plan actual
                </div>
              } @else if (plan.id === 'free') {
                <a routerLink="/predictions"
                   class="block w-full py-3 rounded-xl text-center font-semibold
                          bg-white/10 text-purple-200 border border-white/20
                          hover:bg-white/20 transition-colors">
                  Empezar gratis
                </a>
              } @else {
                @if (!auth.isLoggedIn()) {
                  <a routerLink="/register"
                     class="block w-full py-3 rounded-xl text-center font-semibold
                            bg-purple-500 hover:bg-purple-400 text-white transition-colors">
                    Crear cuenta
                  </a>
                } @else {
                  <button
                    (click)="subscribePro()"
                    [disabled]="loading()"
                    class="w-full py-3 rounded-xl font-semibold bg-purple-500 hover:bg-purple-400
                           text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    @if (loading()) {
                      Redirigiendo...
                    } @else {
                      Suscribirse a Pro
                    }
                  </button>
                }
              }

              <!-- Manage subscription (Pro current users) -->
              @if (currentPlan() === 'pro' && plan.id === 'pro') {
                <button
                  (click)="manageSubscription()"
                  class="mt-3 w-full py-2 rounded-xl text-sm text-purple-300
                         hover:text-purple-100 transition-colors underline">
                  Gestionar suscripción
                </button>
              }
            </div>
          }
        </div>

        <!-- FAQ note -->
        <p class="text-center text-purple-400 text-sm mt-12">
          Los pagos son procesados de forma segura por Stripe.
          Cancela en cualquier momento sin penalizaciones.
        </p>

      </div>
    </div>
  `,
})
export class PricingComponent implements OnInit {
  readonly auth = inject(AuthService);
  private readonly billing = inject(BillingService);

  readonly plans = signal<Plan[]>([]);
  readonly currentPlan = signal<'free' | 'pro'>('free');
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly showSuccess = signal(false);

  ngOnInit(): void {
    // Check for Stripe success redirect
    if (window.location.search.includes('checkout=success')) {
      this.showSuccess.set(true);
    }

    this.billing.getPlans().subscribe({
      next: ({ plans }) => this.plans.set(plans),
      error: () => this.error.set('No se pudieron cargar los planes.'),
    });

    if (this.auth.isLoggedIn()) {
      this.billing.getSubscription().subscribe({
        next: (sub) => this.currentPlan.set(sub.plan),
        error: () => {},
      });
    }
  }

  subscribePro(): void {
    this.loading.set(true);
    this.error.set(null);

    this.billing.createCheckoutSession(PRO_PRICE_ID).subscribe({
      next: ({ checkoutUrl }) => {
        window.location.href = checkoutUrl;
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Error al iniciar el pago.');
        this.loading.set(false);
      },
    });
  }

  manageSubscription(): void {
    this.loading.set(true);
    this.billing.openBillingPortal().subscribe({
      next: ({ portalUrl }) => {
        window.location.href = portalUrl;
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Error al abrir el portal.');
        this.loading.set(false);
      },
    });
  }
}
