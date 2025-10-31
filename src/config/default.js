/**
 * Default configuration for Polybot
 * Override these values by creating config/custom.js or using environment variables
 */
export default {
  // RPC Provider Configuration
  rpc: {
    url:
      process.env.RPC_URL ||
      "wss://polygon-mainnet.g.alchemy.com/v2/wowndxPeV_wApZY_Ulv28NIxnq2R3Gw0" ||
      "ws://192.168.1.10:8546",
    reconnect: true,
    reconnectDelay: 5000,
    maxReconnectAttempts: 10,
  },

  // Transaction Monitoring Configuration
  monitor: {
    monitorPending: false, // Monitor mempool transactions
    monitorConfirmed: true, // Monitor confirmed transactions in blocks
    enrichTransactions: false, // Fetch transaction receipts for detailed information
    batchSize: 1, // Process transactions individually
  },

  // Transaction Filter Configuration
  filter: {
    // Filter transactions by specific addresses or address groups
    // Use '@groupName' to reference a group from addresses.js
    // Examples:
    //   ['@myAddresses'] - Only your wallets
    //   ['@allDexes'] - All DEX contracts
    //   ['@myAddresses', '@quickswap'] - Your wallets and QuickSwap
    //   ['0x123...', '@myAddresses'] - Mix of individual addresses and groups
    addresses: ['@allDexes'], // Monitor any tx from/to all DEXes

    // Alternative: use specific from/to filters
    // fromAddresses: ['@myAddresses'], // Only monitor tx FROM your wallets
    // toAddresses: ['@allDexes'], // Only monitor tx TO DEXes

    // Example: Filter by transaction value
    // minValue: '1000000000000000000',  // 1 ETH in wei
    // maxValue: null
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
    debug: process.env.DEBUG === "true",
  },

  // Output Configuration
  output: {
    // Output style: 'detailed', 'compact', 'json'
    style: "detailed",

    // Which categories to display
    fields: {
      basic: true, // Basic transaction info (hash, from, to, value, etc.)
      gas: true, // Gas and fee information
      block: true, // Block information
      data: true, // Transaction data (size, method signature, etc.)
      decodedData: true, // Decoded function calls and parameters (NEW!)
      network: false, // Network information (chain ID, logs count)
      receipt: true, // Receipt information (status, gas used, etc.)
      tokenTransfers: true, // Token transfer events (ERC20/721/1155)
    },

    // Detailed field configuration - customize which specific fields to show
    basicFields: ["hash", "status", "from", "to", "value", "nonce", "type"],
    gasFields: [
      "limit",
      "used",
      "efficiency",
      "transactionFee",
      "effectiveGasPrice",
      "feeSavings",
    ],
    blockFields: ["number", "timestamp", "transactionIndex"],
    dataFields: ["size", "methodSignature", "contractAddress"],
    decodedDataFields: [
      "methodName",
      "contractType",
      "description",
      "parameters",
    ], // NEW!
    networkFields: ["chainId", "logsCount"],

    // Formatting options
    showEmptyFields: false, // Show fields with N/A values
    groupByCategory: true, // Group fields by category
    maxHashLength: 66, // Full hash (set to 20 for shortened: 0x1234...5678)
    maxAddressLength: 42, // Full address (set to 10 for shortened: 0x1234...5678)
  },

  // Performance Configuration
  performance: {
    // Future: Add rate limiting, caching, etc.
  },
};
