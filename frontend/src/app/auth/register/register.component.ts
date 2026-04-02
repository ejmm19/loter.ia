import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
})
export class RegisterComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  name = '';
  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.titleService.setTitle('Crear cuenta gratis — loter.ia');
    this.metaService.updateTag({ name: 'description', content: 'Regístrate gratis y empieza a recibir predicciones de lotería con IA hoy mismo.' });
  }

  submit(): void {
    if (!this.name || !this.email || !this.password) return;
    if (this.password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    this.loading.set(true);
    this.error.set(null);

    this.auth.register(this.email, this.password, this.name).subscribe({
      next: () => this.router.navigate(['/predictions']),
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Error al registrarse.');
        this.loading.set(false);
      },
    });
  }
}
