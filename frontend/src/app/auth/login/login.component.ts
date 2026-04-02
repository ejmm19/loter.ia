import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { Title, Meta } from '@angular/platform-browser';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly titleService = inject(Title);
  private readonly metaService = inject(Meta);

  email = '';
  password = '';
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.titleService.setTitle('Iniciar sesión — loter.ia');
    this.metaService.updateTag({ name: 'description', content: 'Accede a tu cuenta de loter.ia y consulta tus predicciones personalizadas.' });
  }

  submit(): void {
    if (!this.email || !this.password) return;
    this.loading.set(true);
    this.error.set(null);

    this.auth.login(this.email, this.password).subscribe({
      next: () => {
        const next = this.route.snapshot.queryParamMap.get('next') ?? '/predictions';
        this.router.navigateByUrl(next);
      },
      error: (err) => {
        this.error.set(err?.error?.error ?? 'Error al iniciar sesión.');
        this.loading.set(false);
      },
    });
  }
}
