import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

// Source maps are uploaded only when SENTRY_AUTH_TOKEN, SENTRY_ORG and
// SENTRY_PROJECT are set at build time; otherwise the build skips the upload.
export default withSentryConfig(nextConfig, {
  silent: !process.env.CI,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  treeshake: { removeDebugLogging: true },
  telemetry: false,
});
