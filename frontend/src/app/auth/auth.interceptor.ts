import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { Router } from '@angular/router';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const token = auth.getAccessToken();
  const authReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(authReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && auth.isLoggedIn() && !req.url.includes('/auth/')) {
        return auth.refreshAccessToken().pipe(
          switchMap(({ accessToken }) => {
            const retried = req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });
            return next(retried);
          }),
          catchError(() => {
            auth.logout();
            router.navigate(['/login']);
            return throwError(() => err);
          })
        );
      }
      return throwError(() => err);
    })
  );
};
