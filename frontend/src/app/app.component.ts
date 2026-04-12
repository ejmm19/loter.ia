import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  styles: [`:host { display: block; }`],
  template: `
    <header class="bg-base-100 shadow-sm">
      <div class="container navbar">
        <div class="flex-1">
          <a class="font-heading text-lg font-bold text-brand-600">
            <img src="logo.png" alt="Loterias De Hoy" class="h-10" />
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
            <li><a class="text-[14px] font-medium">Loterías</a></li>
            <li><a class="text-[14px] font-medium">Resultados Anteriores</a></li>
            <li><a class="text-[14px] font-medium">Horarios</a></li>
            <li><a class="text-[14px] font-medium">Iniciar Sesión</a></li>
          </ul>
        </div>
        <!-- Desktop menu -->
        <nav class="hidden lg:flex items-center gap-1">
          <ul class="menu menu-horizontal gap-1">
            <li><a class="text-[14px] font-medium">Loterías</a></li>
            <li><a class="text-[14px] font-medium">Resultados Anteriores</a></li>
            <li><a class="text-[14px] font-medium">Horarios</a></li>
          </ul>
          <a class="btn btn-primary btn-sm ml-2 text-[14px] font-medium">Iniciar Sesión</a>
        </nav>
      </div>
    </header>
    <main class="container py-6">
      <router-outlet />
    </main>
  `,
})
export class AppComponent {}
