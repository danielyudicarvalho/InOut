// Sentry's Expo metro config adds debug IDs so uploaded source maps match
// release bundles. Everything else is Expo's default config.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
