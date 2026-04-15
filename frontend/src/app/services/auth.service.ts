import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';

export interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  private _user = signal<User | null>(null);
  private _token = signal<string | null>(null);

  user = this._user.asReadonly();
  isLoggedIn = computed(() => !!this._user());

  constructor() {
    this.loadFromStorage();
  }

  get accessToken(): string | null {
    return this._token();
  }

  register(email: string, password: string, name: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/register`, { email, password, name }).pipe(
      tap(res => this.saveAuth(res)),
    );
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap(res => this.saveAuth(res)),
    );
  }

  logout(): void {
    const refreshToken = localStorage.getItem('refreshToken');
    if (this._token() && refreshToken) {
      this.http.post(`${this.apiUrl}/auth/logout`, { refreshToken }, {
        headers: { Authorization: `Bearer ${this._token()}` },
      }).subscribe();
    }
    this.clearAuth();
  }

  refresh(): Observable<TokenResponse> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) {
      this.clearAuth();
      return throwError(() => new Error('No refresh token'));
    }

    return this.http.post<TokenResponse>(`${this.apiUrl}/auth/refresh`, { refreshToken }).pipe(
      tap(res => {
        this._token.set(res.accessToken);
        localStorage.setItem('accessToken', res.accessToken);
        localStorage.setItem('refreshToken', res.refreshToken);
      }),
      catchError(err => {
        this.clearAuth();
        return throwError(() => err);
      }),
    );
  }

  private saveAuth(res: AuthResponse): void {
    this._user.set(res.user);
    this._token.set(res.accessToken);
    localStorage.setItem('accessToken', res.accessToken);
    localStorage.setItem('refreshToken', res.refreshToken);
    localStorage.setItem('user', JSON.stringify(res.user));
  }

  private clearAuth(): void {
    this._user.set(null);
    this._token.set(null);
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
  }

  private loadFromStorage(): void {
    const token = localStorage.getItem('accessToken');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      try {
        this._user.set(JSON.parse(userStr));
        this._token.set(token);
      } catch {
        this.clearAuth();
      }
    }
  }
}
