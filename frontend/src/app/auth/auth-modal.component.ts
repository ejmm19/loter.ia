import { Component, inject, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    <!-- Backdrop -->
    <div
      class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
      (click)="close.emit()">

      <!-- Modal -->
      <div
        class="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
        (click)="$event.stopPropagation()">

        <!-- Header -->
        <div class="relative bg-brand-600 px-6 py-8 text-center">
          <button
            class="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
            (click)="close.emit()">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img src="logo.png" alt="Loterías de Hoy" class="h-10 brightness-0 invert mx-auto mb-3" />
          <h2 class="text-white font-heading font-bold text-xl">
            {{ mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta' }}
          </h2>
          <p class="text-white/70 text-sm mt-1">
            {{ mode === 'login' ? 'Accede a todas las funciones' : 'Regístrate gratis en segundos' }}
          </p>
        </div>

        <!-- Body -->
        <div class="p-6">
          @if (error) {
            <div class="alert alert-error text-sm mb-4 py-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              {{ error }}
            </div>
          }

          @if (success) {
            <div class="alert alert-success text-sm mb-4 py-2">
              {{ success }}
            </div>
          }

          <form (submit)="onSubmit($event)" class="space-y-4">
            @if (mode === 'register') {
              <div>
                <label class="text-sm font-medium text-gray-700 mb-1 block">Nombre</label>
                <input
                  type="text"
                  [(ngModel)]="name"
                  name="name"
                  placeholder="Tu nombre"
                  class="input input-bordered w-full focus:outline-none"
                  required />
              </div>
            }

            <div>
              <label class="text-sm font-medium text-gray-700 mb-1 block">Correo electrónico</label>
              <input
                type="email"
                [(ngModel)]="email"
                name="email"
                placeholder="tu@email.com"
                class="input input-bordered w-full focus:outline-none"
                required />
            </div>

            <div>
              <label class="text-sm font-medium text-gray-700 mb-1 block">Contraseña</label>
              <input
                type="password"
                [(ngModel)]="password"
                name="password"
                [placeholder]="mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'"
                class="input input-bordered w-full focus:outline-none"
                required
                minlength="8" />
            </div>

            <button
              type="submit"
              class="btn btn-primary w-full"
              [disabled]="loading">
              @if (loading) {
                <span class="loading loading-spinner loading-sm"></span>
              }
              {{ mode === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta' }}
            </button>
          </form>

          <!-- Toggle -->
          <div class="text-center mt-5 text-sm text-gray-500">
            @if (mode === 'login') {
              ¿No tienes cuenta?
              <button class="text-brand-600 font-semibold hover:underline" (click)="switchMode()">Regístrate</button>
            } @else {
              ¿Ya tienes cuenta?
              <button class="text-brand-600 font-semibold hover:underline" (click)="switchMode()">Inicia Sesión</button>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class AuthModalComponent {
  private auth = inject(AuthService);

  close = output<void>();

  mode: 'login' | 'register' = 'login';
  email = '';
  password = '';
  name = '';
  loading = false;
  error = '';
  success = '';

  switchMode(): void {
    this.mode = this.mode === 'login' ? 'register' : 'login';
    this.error = '';
    this.success = '';
  }

  onSubmit(event: Event): void {
    event.preventDefault();
    if (this.loading) return;

    this.loading = true;
    this.error = '';
    this.success = '';

    if (this.mode === 'login') {
      this.auth.login(this.email, this.password).subscribe({
        next: () => {
          this.loading = false;
          this.close.emit();
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.error || 'Error al iniciar sesión';
        },
      });
    } else {
      this.auth.register(this.email, this.password, this.name).subscribe({
        next: () => {
          this.loading = false;
          this.close.emit();
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.error || 'Error al registrarse';
        },
      });
    }
  }
}
