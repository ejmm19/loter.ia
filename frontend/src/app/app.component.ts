import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { LotteryService, Lottery } from './services/lottery.service';
import { AuthService } from './services/auth.service';
import { AuthModalComponent } from './auth/auth-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, AuthModalComponent],
  styles: [`:host { display: block; }`],
  template: `
    <header class="bg-base-100/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-50 transition-all duration-300">
      <div class="container navbar">
        <div class="flex-1">
          <a routerLink="/" class="font-heading text-lg font-bold text-brand-600 cursor-pointer">
            <img src="logo.png" alt="Loterías de Hoy" class="h-10" />
          </a>
        </div>
        <!-- Mobile hamburger -->
        <div class="dropdown dropdown-end lg:hidden">
          <label tabindex="0" class="btn btn-ghost">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </label>
          <ul tabindex="0" class="menu dropdown-content bg-base-100 rounded-box mt-3 w-52 p-2 shadow">
            <li><a href="#loterias" class="text-[14px] font-medium">Loterías</a></li>
            <li><a href="/#sonar" class="text-[14px] font-medium">Tu Sueño</a></li>
            <li><a routerLink="/calendario" class="text-[14px] font-medium">Calendario</a></li>
            <li>
              <details>
                <summary class="text-[14px] font-medium">Resultados</summary>
                <ul class="bg-base-100 rounded-box p-2">
                  @for (lot of lotteries; track lot.id) {
                    <li>
                      <a [routerLink]="['/loteria', lot.slug]" class="text-[13px] flex items-center gap-2">
                        <img [src]="'logos/' + lot.slug + '/logo.png'" class="w-5 h-5 object-contain rounded" />
                        {{ lot.name }}
                      </a>
                    </li>
                  }
                </ul>
              </details>
            </li>
            @if (auth.isLoggedIn()) {
              <li><a class="text-[14px] font-medium" (click)="auth.logout()">Cerrar Sesión</a></li>
            } @else {
              <li><a class="text-[14px] font-medium" (click)="showAuthModal = true">Iniciar Sesión</a></li>
            }
          </ul>
        </div>
        <!-- Desktop menu -->
        <nav class="hidden lg:flex items-center gap-1">
          <ul class="menu menu-horizontal gap-1">
            <li><a href="#loterias" class="text-[14px] font-medium">Loterías</a></li>
            <li><a href="/#sonar" class="text-[14px] font-medium">Tu Sueño</a></li>
            <li><a routerLink="/calendario" class="text-[14px] font-medium">Calendario</a></li>
            <li class="relative group">
              <a class="text-[14px] font-medium cursor-pointer">Resultados</a>
              <ul class="absolute top-full left-0 bg-base-100 rounded-box shadow-lg p-2 w-64 max-h-80 overflow-y-auto z-50 hidden group-hover:block">
                @for (lot of lotteries; track lot.id) {
                  <li>
                    <a [routerLink]="['/loteria', lot.slug]" class="text-[13px] flex items-center gap-2 py-2 hover:bg-gray-50 rounded-lg px-3">
                      <img [src]="'logos/' + lot.slug + '/logo.png'" class="w-6 h-6 object-contain rounded" />
                      {{ lot.name }}
                    </a>
                  </li>
                }
              </ul>
            </li>
          </ul>
          @if (auth.isLoggedIn()) {
            <div class="dropdown dropdown-end ml-2">
              <label tabindex="0" class="btn btn-ghost btn-sm gap-2 text-[14px] font-medium">
                <div class="w-7 h-7 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold">
                  {{ auth.user()?.name?.charAt(0)?.toUpperCase() }}
                </div>
                {{ auth.user()?.name?.split(' ')?.[0] }}
              </label>
              <ul tabindex="0" class="menu dropdown-content bg-base-100 rounded-box mt-3 w-44 p-2 shadow z-50">
                <li><a (click)="auth.logout()" class="text-red-500">Cerrar Sesión</a></li>
              </ul>
            </div>
          } @else {
            <a class="btn btn-primary btn-sm ml-2 text-[14px] font-medium cursor-pointer" (click)="showAuthModal = true">Iniciar Sesión</a>
          }
        </nav>
      </div>
    </header>
    <main class="container pt-6">
      <router-outlet />
    </main>

    <footer class="bg-gray-900 text-white">
      <div class="container py-12">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">

          <!-- Logo y descripción -->
          <div>
            <img src="logo.png" alt="Loterías de Hoy" class="h-10 brightness-0 invert mb-4" />
            <p class="text-gray-400 text-sm leading-relaxed">
              Resultados actualizados de las principales loterías colombianas. Números ganadores, histórico de resultados y más.
            </p>
          </div>

          <!-- Loterías -->
          <div>
            <h4 class="font-heading font-bold text-sm uppercase tracking-wider mb-4 text-gray-300">Loterías</h4>
            <div class="grid grid-cols-2 gap-1">
              @for (lot of lotteries; track lot.id) {
                <a [routerLink]="['/loteria', lot.slug]" class="text-gray-400 text-sm hover:text-white transition-colors py-1">
                  {{ lot.name }}
                </a>
              }
            </div>
          </div>

          <!-- Links -->
          <div>
            <h4 class="font-heading font-bold text-sm uppercase tracking-wider mb-4 text-gray-300">Enlaces</h4>
            <div class="flex flex-col gap-2">
              <a routerLink="/" class="text-gray-400 text-sm hover:text-white transition-colors">Inicio</a>
              <a href="/#sonar" class="text-gray-400 text-sm hover:text-white transition-colors">Tu Sueño</a>
              <a routerLink="/calendario" class="text-gray-400 text-sm hover:text-white transition-colors">Calendario de sorteos</a>
              <a href="#loterias" class="text-gray-400 text-sm hover:text-white transition-colors">Todas las loterías</a>
            </div>
          </div>

        </div>

        <!-- Línea divisoria y copyright -->
        <div class="border-t border-gray-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p class="text-gray-500 text-xs">&copy; {{ currentYear }} Loterías de Hoy. Todos los derechos reservados.</p>
          <p class="text-gray-600 text-[11px]">Los resultados son de carácter informativo. Juega responsablemente.</p>
        </div>
      </div>
    </footer>

    @if (showAuthModal) {
      <app-auth-modal (close)="showAuthModal = false" />
    }
  `,
})
export class AppComponent implements OnInit {
  private lotteryService = inject(LotteryService);
  auth = inject(AuthService);
  lotteries: Lottery[] = [];
  currentYear = new Date().getFullYear();
  showAuthModal = false;

  ngOnInit(): void {
    this.lotteryService.getLotteries().subscribe({
      next: (lotteries) => this.lotteries = lotteries,
    });
  }
}
