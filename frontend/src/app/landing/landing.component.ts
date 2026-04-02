import { Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../auth/auth.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing.component.html',
})
export class LandingComponent {
  private readonly auth = inject(AuthService);
  readonly isLoggedIn = computed(() => this.auth.isLoggedIn());
}
