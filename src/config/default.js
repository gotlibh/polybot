/**
 * Default configuration for Polybot
 * Override these values by creating config/custom.js or using environment variables
 */
export default {
  // RPC Provider Configuration
  rpc: {
    url: process.env.RPC_URL || 'ws://192.168.1.10:8546',
    reconnect: true,
    reconnectDelay: 5000,
    maxReconnectAttempts: 10
  },

  // Transaction Monitoring Configuration
  monitor: {
    monitorPending: true,      // Monitor mempool transactions
    monitorConfirmed: true,    // Monitor confirmed transactions in blocks
    batchSize: 1               // Process transactions individually
  },

  // Transaction Filter Configuration
  filter: {
    // Example: Filter transactions by specific addresses
    // addresses: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],  // Monitor any tx from/to these addresses
    // fromAddresses: [],     // Only monitor tx FROM these addresses
    // toAddresses: [],       // Only monitor tx TO these addresses

    // Example: Filter by transaction value
    // minValue: '1000000000000000000',  // 1 ETH in wei
    // maxValue: null
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    debug: process.env.DEBUG === 'true'
  },

  // Performance Configuration
  performance: {
    // Future: Add rate limiting, caching, etc.
  }
};
