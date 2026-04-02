import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        // External-service integrations (Stripe, email, OpenAI, Cloudflare Workers ingestion)
        // require live API credentials — covered by integration/E2E tests, not unit tests
        'src/services/email.ts',
        'src/services/ingestion.ts',
        'src/services/openai.ts',
        'src/services/stripe.ts',
        'src/routes/webhook.ts',
        // Billing checkout/portal routes require live Stripe API calls
        'src/routes/billing.ts',
        // Cloudflare Workers entry point — route registration only, no testable logic
        'src/index.ts',
      ],
    },
  },
});
