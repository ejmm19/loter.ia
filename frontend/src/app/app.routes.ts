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
    path: 'analysis',
    canActivate: [authGuard],
    loadComponent: () => import('./analysis/analysis.component').then(m => m.AnalysisComponent),
  },
  {
    path: 'pricing',
    loadComponent: () => import('./billing/pricing/pricing.component').then(m => m.PricingComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () => import('./dashboard/dashboard.component').then(m => m.DashboardComponent),
  },
  {
    path: '**',
    redirectTo: '',
  },
];
