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
    monitorConfirmed: false, // Monitor confirmed transactions in blocks
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
    addresses: ["@allDexes"], // Monitor any tx from/to all DEXes

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

  // DEX Price Monitoring Configuration
  dexPrices: {
    enabled: true, // Enable/disable DEX price monitoring
    interval: 3000, // Query interval in milliseconds (30 seconds)
    baseAmount: "1000000000000000000", // Base amount for price queries (1 token with 18 decimals)

    // DEX Routers to query (Uniswap V2 compatible)
    dexRouters: [
      {
        name: "QuickSwap",
        address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
      },
      {
        name: "SushiSwap",
        address: "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
      },
      {
        name: "Uniswap V3",
        address: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
      },
    ],

    // Trading pairs to monitor
    tradingPairs: [
      {
        name: "WMATIC/USDC",
        tokenIn: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
        tokenOut: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        tokenInSymbol: "WMATIC",
        tokenOutSymbol: "USDC",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
      },
      {
        name: "WETH/USDC",
        tokenIn: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
        tokenOut: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        tokenInSymbol: "WETH",
        tokenOutSymbol: "USDC",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
      },
      {
        name: "WMATIC/USDT",
        tokenIn: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
        tokenOut: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
        tokenInSymbol: "WMATIC",
        tokenOutSymbol: "USDT",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
      },
    ],

    // Display configuration
    display: {
      enabled: true, // Show prices in console
      style: "table", // 'table' or 'detailed'
      showReserves: true,
      showAmounts: true,
    },
  },

  // Performance Configuration
  performance: {
    // Future: Add rate limiting, caching, etc.
  },
};
