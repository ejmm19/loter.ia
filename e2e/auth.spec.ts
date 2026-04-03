/**
 * E2E — Auth Flow
 *
 * Covers: registro → confirmación → login → logout
 * Precondition: app running at BASE_URL (default http://localhost:4200)
 * and API running at API_URL (default http://localhost:8787)
 *
 * After login, the app redirects to /predictions by default.
 */

import { test, expect } from '@playwright/test';

const testUser = {
  name: 'Test QA User',
  email: `qa-${Date.now()}@test.loter.ia`,
  password: 'SecurePassword123!',
};

test.describe('Auth flow', () => {
  test('Register — new user can create an account', async ({ page }) => {
    await page.goto('/register');
    await page.fill('[data-testid="name-input"]', testUser.name);
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="register-submit"]');

    // Login redirects to /predictions by default (no ?next= param)
    await expect(page).toHaveURL('/predictions');
    await expect(page.locator('[data-testid="logout-button"]')).toBeVisible();
  });

  test('Login — registered user can sign in', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-submit"]');

    // Default post-login redirect is /predictions
    await expect(page).toHaveURL('/predictions');
  });

  test('Login — shows error for wrong password', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', 'WrongPassword!');
    await page.click('[data-testid="login-submit"]');

    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('Protected routes redirect to login when unauthenticated', async ({ page }) => {
    await page.goto('/dashboard');
    // Auth guard appends ?next=/dashboard, so check via regex
    await expect(page).toHaveURL(/\/login/);
  });

  test('Logout — user is redirected to home', async ({ page }) => {
    // Login first (lands on /predictions)
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', testUser.email);
    await page.fill('[data-testid="password-input"]', testUser.password);
    await page.click('[data-testid="login-submit"]');
    await expect(page).toHaveURL('/predictions');

    // Logout button is on the predictions page nav
    await page.click('[data-testid="logout-button"]');
    await expect(page).toHaveURL('/');

    // Verify token is gone — try to revisit a protected route
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
