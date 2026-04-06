import * as Sentry from '@sentry/nextjs';

if (!process.env.NEXT_PUBLIC_SENTRY_DSN && process.env.NODE_ENV === 'production') {
  console.error('[Sentry] NEXT_PUBLIC_SENTRY_DSN is not set — server errors will not be captured');
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.05,
  debug: false,
});
