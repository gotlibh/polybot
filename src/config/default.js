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

  statsEnabled: false,

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
    enabled: false, // Enable/disable DEX price monitoring
    interval: 3000, // Query interval in milliseconds (30 seconds)
    baseAmount: "1000000000000000000", // Base amount for price queries (1 token with 18 decimals)

    // DEX Routers to query (Uniswap V2 compatible only)
    // Note: Only verified Polygon mainnet Uniswap V2 compatible routers
    // Set enabled: true/false to enable/disable individual DEXes
    dexRouters: [
      {
        name: "QuickSwap",
        address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
        enabled: true, // QuickSwap V2 Router (verified)

        // Pair filtering - control which pairs to query
        // Format: ["TOKEN1/TOKEN2", "TOKEN3/TOKEN4"]

        // supportedPairs: Whitelist of pairs this DEX supports
        // - If defined (non-empty), ONLY these pairs will be queried
        // - If empty/undefined, all pairs are allowed (except unsupported)
        // Example: ["USDC/WPOL", "WETH/USDC", "DAI/USDC"]
        supportedPairs: [],

        // unsupportedPairs: Blacklist of pairs this DEX doesn't support
        // - These pairs will be skipped
        // - Only used when supportedPairs is empty
        // - Ignored if supportedPairs is defined
        // Example: ["LINK/CRV", "AAVE/UNI"]
        unsupportedPairs: [],
      },
      {
        name: "SushiSwap",
        address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        enabled: true, // SushiSwap Router (verified)
        supportedPairs: [],
        unsupportedPairs: [],
      },
      {
        name: "ApeSwap",
        address: "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607",
        enabled: true, // ApeSwap Router (not verified)
        supportedPairs: [],
        unsupportedPairs: [],
      },
      {
        name: "Dfyn",
        address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        enabled: true, // Dfyn Router V2 (verified)
        supportedPairs: [],
        unsupportedPairs: [],
      },
      {
        name: "Polycat Finance",
        address: "0x94930a328162957FF1dd48900aF67B5439336cBD",
        enabled: true, // Polycat Router (verified)
        supportedPairs: [],
        unsupportedPairs: [],
      },
      {
        name: "Cometh",
        address: "0x93bcDc45f7e62f89a8e901DC4A0E2c6C427D9F25",
        enabled: false, // Cometh Router (unverified)
        supportedPairs: [],
        unsupportedPairs: [],
      },
      {
        name: "JetSwap",
        address: "0x5C6EC38fb0e2609672BDf628B1fD605A523E5923",
        enabled: true, // JetSwap Router (unverified)
        supportedPairs: [],
        unsupportedPairs: [],
      },
    ],

    // Trading pairs to monitor
    // Set enabled: true/false to enable/disable individual pairs
    tradingPairs: [
      {
        name: "WMATIC/USDC",
        tokenIn: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
        tokenOut: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        tokenInSymbol: "WMATIC",
        tokenOutSymbol: "USDC",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        enabled: true,
      },
      {
        name: "WETH/USDC",
        tokenIn: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
        tokenOut: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        tokenInSymbol: "WETH",
        tokenOutSymbol: "USDC",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        enabled: false,
      },
      {
        name: "WMATIC/USDT",
        tokenIn: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
        tokenOut: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
        tokenInSymbol: "WMATIC",
        tokenOutSymbol: "USDT",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        enabled: false,
      },
      {
        name: "POL/WETH",
        tokenIn: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // POL (WMATIC - same address on Polygon)
        tokenOut: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH
        tokenInSymbol: "POL",
        tokenOutSymbol: "WETH",
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        enabled: false,
      },
      {
        name: "TEL/USDC",
        tokenIn: "0xdF7837DE1F2Fa4631D716CF2502f8b230F1dcc32", // TEL
        tokenOut: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        tokenInSymbol: "TEL",
        tokenOutSymbol: "USDC",
        tokenInDecimals: 2, // שים לב - לטוקן הזה רק 2 דצימלים!
        tokenOutDecimals: 6,
        enabled: false,
      },
      {
        name: "DOGA/USDC",
        tokenIn: "0xdda40cdfe4a0090f42ff49f264a831402adb801a", // DOGA
        tokenOut: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        tokenInSymbol: "DOGA",
        tokenOutSymbol: "USDC",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        enabled: false,
      },
      {
        name: "XCAD/USDT",
        tokenIn: "0x4318f6a6a1e6a2a02e0d2f6cbf48a1e6b17b57d8", // XCAD
        tokenOut: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // USDT
        tokenInSymbol: "XCAD",
        tokenOutSymbol: "USDT",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        enabled: false,
      },
      {
        name: "GAME/USDC",
        tokenIn: "0x1c7bA6b24A514dC2b4C76f77820d8C910A8A9fF9", // GAME Credits
        tokenOut: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        tokenInSymbol: "GAME",
        tokenOutSymbol: "USDC",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        enabled: false,
      },
      {
        name: "MATICX/WPOL",
        tokenIn: "0xfa68FB4628DFF1028CF9bB9fD97dFddD93dE1E3E", // MATICX (Staked MATIC)
        tokenOut: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC / WPOL
        tokenInSymbol: "MATICX",
        tokenOutSymbol: "WPOL",
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        enabled: false,
      },
      {
        name: "PAW/WPOL",
        tokenIn: "0x1D921368a6f28da5cF3D4c71b8a0BFD8D8bA67E3", // PAW
        tokenOut: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
        tokenInSymbol: "PAW",
        tokenOutSymbol: "WPOL",
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        enabled: false,
      },
      {
        name: "GHST/USDC",
        tokenIn: "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7", // GHST (Aavegotchi)
        tokenOut: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        tokenInSymbol: "GHST",
        tokenOutSymbol: "USDC",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        enabled: false,
      },
      {
        name: "SAND/USDT",
        tokenIn: "0xbbba073c31bf03b8acf7c28ef0738decf3695683", // SAND
        tokenOut: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // sUSDT
        tokenInSymbol: "SAND",
        tokenOutSymbol: "USDT",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        enabled: false,
      },
      {
        name: "REVV/WPOL",
        tokenIn: "0x70C006878a5A50Ed185ac4C87d837633923De296", // REVV
        tokenOut: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270", // WMATIC
        tokenInSymbol: "REVV",
        tokenOutSymbol: "WPOL",
        tokenInDecimals: 18,
        tokenOutDecimals: 18,
        enabled: false,
      },
      {
        name: "BANANA/USDC",
        tokenIn: "0x5d47baba0d66083c52009271faf3f50dcc01023c", // BANANA (ApeSwap)
        tokenOut: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC
        tokenInSymbol: "BANANA",
        tokenOutSymbol: "USDC",
        tokenInDecimals: 18,
        tokenOutDecimals: 6,
        enabled: false,
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

  // Swap Execution Configuration
  swap: {
    enabled: true, // Enable/disable swap API (IMPORTANT: Set to true to enable swap functionality)

    // Executor Configuration
    executor: {
      maxSlippage: 0.5, // Default slippage tolerance in %
      deadlineMinutes: 20, // Default deadline in minutes
      gasLimitBuffer: 1.2, // Gas limit buffer multiplier (20% extra)
    },

    // Validator Configuration
    validation: {
      maxSlippage: 5, // Maximum allowed slippage in %
      minSlippage: 0.1, // Minimum allowed slippage in %
      maxDeadlineMinutes: 60, // Maximum deadline in minutes
      minDeadlineMinutes: 1, // Minimum deadline in minutes
      maxGasPrice: 500, // Maximum gas price in gwei
      allowedDexes: [], // Empty array = all DEXes allowed, or specify: ['QuickSwap', 'SushiSwap']
      allowedTokens: [], // Empty array = all tokens allowed, or specify token addresses
      requireRecipientWhitelist: false, // Require recipient to be in whitelist
      recipientWhitelist: [], // Allowed recipient addresses
    },

    // API Configuration
    api: {
      enabled: true, // Enable/disable REST API
      port: 30000, // API server port
      host: "localhost", // API server host
      apiKey: process.env.SWAP_API_KEY || null, // API key for authentication (set via environment variable)
      rateLimit: {
        maxRequests: 100, // Maximum requests per window
        windowMs: 60000, // Time window in milliseconds (60 seconds)
      },
    },
  },

  // Performance Configuration
  performance: {
    // Future: Add rate limiting, caching, etc.
  },
};
