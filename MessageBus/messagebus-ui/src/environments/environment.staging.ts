export const environment = {
  production: false,
  staging: true,
  apiUrl: 'https://messagebus-staging.conedison.com/api',
  signalRUrl: 'https://messagebus-staging.conedison.com/messagebushub',

  // Feature flags
  enableDebugTools: true,
  enablePerformanceLogging: true,

  // Refresh intervals (milliseconds)
  dashboardRefreshInterval: 30000,
  queueRefreshInterval: 15000,
  metricsRefreshInterval: 60000,

  // API settings
  apiTimeout: 30000,
  maxRetries: 3,

  // App info
  version: '1.0.0-staging',
  buildDate: new Date().toISOString()
};
