export const environment = {
  production: true,
  staging: false,
  apiUrl: '/api',
  signalRUrl: '/messagebushub',

  // Feature flags
  enableDebugTools: false,
  enablePerformanceLogging: false,

  // Refresh intervals (milliseconds)
  dashboardRefreshInterval: 30000,
  queueRefreshInterval: 15000,
  metricsRefreshInterval: 60000,

  // API settings
  apiTimeout: 30000,
  maxRetries: 3,

  // App info
  version: '1.0.0',
  buildDate: new Date().toISOString()
};
