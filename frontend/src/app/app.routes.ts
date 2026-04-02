import { Routes } from '@angular/router';
import { authGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./landing/landing.component').then(m => m.LandingComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./auth/register/register.component').then(m => m.RegisterComponent),
  },
  {
    path: 'predictions',
    canActivate: [authGuard],
    loadComponent: () => import('./predictions/predictions.component').then(m => m.PredictionsComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
