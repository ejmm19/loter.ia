import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Plan {
  id: 'free' | 'pro';
  name: string;
  price: number;
  predictionsPerDay: number | null;
  features: string[];
}

export interface SubscriptionStatus {
  plan: 'free' | 'pro';
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  planExpiresAt: string | null;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getPlans(): Observable<{ plans: Plan[] }> {
    return this.http.get<{ plans: Plan[] }>(`${this.apiUrl}/billing/plans`);
  }

  getSubscription(): Observable<SubscriptionStatus> {
    return this.http.get<SubscriptionStatus>(`${this.apiUrl}/billing/subscription`);
  }

  createCheckoutSession(priceId: string): Observable<{ checkoutUrl: string }> {
    return this.http.post<{ checkoutUrl: string }>(`${this.apiUrl}/billing/checkout`, { priceId });
  }

  openBillingPortal(): Observable<{ portalUrl: string }> {
    return this.http.post<{ portalUrl: string }>(`${this.apiUrl}/billing/portal`, {});
  }
}
