/**
 * Sentry browser SDK initialisation.
 * This file is automatically imported by Next.js via next.config.ts.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Capture React component tree in error breadcrumbs
  integrations: [Sentry.breadcrumbsIntegration()],
  // Filter out noisy errors
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "Non-Error promise rejection captured",
  ],
  enabled: process.env.NODE_ENV === "production",
});
