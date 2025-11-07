# Swap API Documentation

The Swap API provides REST endpoints for executing token swaps on DEXes (Decentralized Exchanges) through a secure and validated interface.

## Table of Contents

- [Configuration](#configuration)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
- [Request Examples](#request-examples)
- [Error Handling](#error-handling)
- [Security Best Practices](#security-best-practices)

## Configuration

Enable the swap system in `src/config/default.js` or `src/config/custom.js`:

```javascript
swap: {
  enabled: true, // Enable swap functionality

  executor: {
    maxSlippage: 0.5,        // Default slippage tolerance (0.5%)
    deadlineMinutes: 20,     // Default deadline (20 minutes)
    gasLimitBuffer: 1.2,     // Gas limit buffer (20% extra)
  },

  validation: {
    maxSlippage: 5,          // Maximum allowed slippage (5%)
    minSlippage: 0.1,        // Minimum allowed slippage (0.1%)
    maxGasPrice: 500,        // Maximum gas price (500 gwei)
    allowedDexes: [],        // Empty = all DEXes allowed
    allowedTokens: [],       // Empty = all tokens allowed
  },

  api: {
    enabled: true,           // Enable REST API
    port: 3000,              // API port
    host: "localhost",       // API host
    apiKey: "your-secret-api-key", // API key for authentication
    rateLimit: {
      maxRequests: 100,      // Max requests per window
      windowMs: 60000,       // Window duration (60 seconds)
    },
  },
}
```

## Authentication

All API requests (except `/health`) require authentication using an API key.

### Set API Key via Environment Variable:

```bash
export SWAP_API_KEY="your-secret-api-key"
```

### Include API Key in Requests:

**Option 1: Header (Recommended)**
```bash
curl -H "X-API-Key: your-secret-api-key" http://localhost:3000/api/v1/routers
```

**Option 2: Query Parameter**
```bash
curl http://localhost:3000/api/v1/routers?apiKey=your-secret-api-key
```

## API Endpoints

### Health Check

**GET** `/health`

Check API server health (no authentication required).

```bash
curl http://localhost:3000/health
```

**Response:**
```json
{
  "success": true,
  "status": "healthy",
  "timestamp": 1699000000000,
  "uptime": 123.45
}
```

---

### Get Available Routers

**GET** `/api/v1/routers`

Get list of available DEX routers.

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/v1/routers
```

**Response:**
```json
{
  "success": true,
  "routers": ["QuickSwap", "SushiSwap", "ApeSwap"],
  "count": 3
}
```

---

### Get Swap Quote

**POST** `/api/v1/swap/quote`

Get a quote for a swap without executing it.

**Request Body (with symbols - recommended):**
```json
{
  "dexName": "QuickSwap",
  "tokenIn": "WMATIC",
  "tokenOut": "USDC",
  "amountIn": "1.5"
}
```

**Request Body (with addresses):**
```json
{
  "dexName": "QuickSwap",
  "tokenIn": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  "tokenOut": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amountIn": "1.5",
  "tokenInDecimals": 18,
  "tokenOutDecimals": 6,
  "slippage": 0.5
}
```

**Note:** You can now use token symbols (USDC, WMATIC, GHST, etc.) instead of addresses! The system will automatically resolve them and fetch decimals from the blockchain or registry.

**Example with symbols:**
```bash
curl -X POST http://localhost:3000/api/v1/swap/quote \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": "QuickSwap",
    "tokenIn": "WMATIC",
    "tokenOut": "USDC",
    "amountIn": "1.5"
  }'
```

**Response:**
```json
{
  "success": true,
  "dex": "QuickSwap",
  "tokenIn": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  "tokenOut": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "tokenInSymbol": "WMATIC",
  "tokenOutSymbol": "USDC",
  "amountIn": "1.5",
  "expectedAmountOut": "0.825",
  "minAmountOut": "0.82088",
  "exchangeRate": "1 WMATIC = 0.550000 USDC",
  "reserves": {
    "WMATIC": "1250000.5",
    "USDC": "687500.25",
    "pairAddress": "0x6e7a5FAFcec6BB1e78bAE2A1F0B612012BF14827"
  },
  "slippage": "0.5%",
  "priceImpact": "0.0012%",
  "estimatedGas": "150000",
  "timestamp": 1699000000000
}
```

---

### Get Multi-DEX Quote

**POST** `/api/v1/swap/quote`

Get quotes from multiple DEXes simultaneously to compare prices and find the best rate.

**Request Body:**
```json
{
  "dexName": ["QuickSwap", "SushiSwap", "ApeSwap"],
  "tokenIn": "USDC",
  "tokenOut": "WBTC",
  "amountIn": "100000"
}
```

**Note:** Pass `dexName` as an array to query multiple DEXes. All other parameters remain the same as single DEX quotes.

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/swap/quote \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "SushiSwap"],
    "tokenIn": "USDC",
    "tokenOut": "WBTC",
    "amountIn": "100000"
  }'
```

**Response:**
```json
{
  "success": true,
  "tokenIn": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "tokenOut": "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
  "tokenInSymbol": "USDC",
  "tokenOutSymbol": "WBTC",
  "amountIn": "100000",
  "quotes": [
    {
      "success": true,
      "dex": "SushiSwap",
      "tokenIn": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "tokenOut": "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      "tokenInSymbol": "USDC",
      "tokenOutSymbol": "WBTC",
      "amountIn": "100000",
      "expectedAmountOut": "1.586234",
      "minAmountOut": "1.578293",
      "exchangeRate": "1 USDC = 0.000016 WBTC",
      "reserves": {
        "USDC": "285000.5",
        "WBTC": "4.25",
        "pairAddress": "0x..."
      },
      "slippage": "0.5%",
      "priceImpact": "35.0877%",
      "estimatedGas": "150000",
      "timestamp": 1699000000000
    },
    {
      "success": true,
      "dex": "QuickSwap",
      "tokenIn": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "tokenOut": "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
      "tokenInSymbol": "USDC",
      "tokenOutSymbol": "WBTC",
      "amountIn": "100000",
      "expectedAmountOut": "0.961538",
      "minAmountOut": "0.956731",
      "exchangeRate": "1 USDC = 0.000010 WBTC",
      "reserves": {
        "USDC": "175000.25",
        "WBTC": "1.75",
        "pairAddress": "0x..."
      },
      "slippage": "0.5%",
      "priceImpact": "57.1429%",
      "estimatedGas": "150000",
      "timestamp": 1699000000000
    }
  ],
  "comparison": {
    "bestDex": "SushiSwap",
    "bestPrice": "1.586234",
    "bestExchangeRate": "1 USDC = 0.000016 WBTC",
    "worstDex": "QuickSwap",
    "worstPrice": "0.961538",
    "worstExchangeRate": "1 USDC = 0.000010 WBTC",
    "averagePrice": "1.273886",
    "priceSpread": "64.9712%",
    "totalDexesQueried": 2,
    "successfulQuotes": 2,
    "failedQuotes": 0
  },
  "arbitrageOpportunity": true,
  "timestamp": 1699000000000
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `quotes` | Array of individual quote results from each DEX |
| `comparison.bestDex` | DEX offering the best rate |
| `comparison.bestPrice` | Highest output amount |
| `comparison.worstDex` | DEX offering the worst rate |
| `comparison.worstPrice` | Lowest output amount |
| `comparison.averagePrice` | Average output across all DEXes |
| `comparison.priceSpread` | Percentage difference between best and worst |
| `comparison.totalDexesQueried` | Total number of DEXes queried |
| `comparison.successfulQuotes` | Number of successful quotes |
| `comparison.failedQuotes` | Number of failed quotes |
| `arbitrageOpportunity` | `true` if price spread > 0.5% |
| `failedQuotes` | Array of failed quotes (if any) |

---

### Get Arbitrage Analysis

**POST** `/api/v1/swap/quote`

Analyze arbitrage opportunities for a token pair across multiple DEXes. This endpoint queries both swap directions (A→B and B→A) and calculates real profit/loss for round-trip swaps.

**Request Body:**
```json
{
  "token": "WBTC/USDC",
  "dexName": ["QuickSwap", "SushiSwap", "ApeSwap"],
  "amountIn": "1"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | Yes | Token pair in format "TOKEN1/TOKEN2" |
| `dexName` | array | Yes | Array of DEX names (minimum 2) |
| `amountIn` | string | Yes | Initial amount to start with |
| `slippage` | number | No | Slippage tolerance % |

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/swap/quote \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "WBTC/USDC",
    "dexName": ["QuickSwap", "SushiSwap"],
    "amountIn": "1"
  }'
```

**Response:**
```json
{
  "success": true,
  "pair": "WBTC/USDC",
  "token1": {
    "symbol": "WBTC",
    "address": "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
    "decimals": 8
  },
  "token2": {
    "symbol": "USDC",
    "address": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "decimals": 6
  },
  "initialAmount": "1",
  "dexesAnalyzed": ["QuickSwap", "SushiSwap"],
  "summary": {
    "totalOpportunities": 4,
    "profitableOpportunities": 0,
    "hasArbitrage": false,
    "bestProfit": null,
    "bestProfitPercentage": null,
    "bestProfitPath": null
  },
  "bestProfitableOpportunity": null,
  "bestOverallOpportunity": {
    "path": "SushiSwap → SushiSwap",
    "dexA": "SushiSwap",
    "dexB": "SushiSwap",
    "route": "WBTC → USDC → WBTC",
    "initialAmount": "1",
    "intermediateAmount": "63024.510000",
    "finalAmount": "0.98500000",
    "profitLoss": "-0.01500000",
    "profitLossPercentage": "-1.5000%",
    "profitLossToken": "WBTC",
    "isProfit": false,
    "gasEstimate": {
      "totalGasUnits": "400000",
      "gasPriceGwei": "50.00",
      "gasCostNative": "0.020000",
      "gasCostInToken": "0.00100000",
      "nativeToken": "WPOL"
    },
    "netProfit": {
      "profitLoss": "-0.01600000",
      "profitLossPercentage": "-1.6000%",
      "profitLossToken": "WBTC",
      "isProfit": false
    },
    "swapADetails": {
      "dex": "SushiSwap",
      "from": "WBTC",
      "to": "USDC",
      "amountIn": "1",
      "amountOut": "63024.510000",
      "priceImpact": "0.7234%",
      "reserves": {
        "WBTC": "138.25000000",
        "USDC": "8725000.250000",
        "pairAddress": "0x..."
      },
      "estimatedGas": "200000"
    },
    "swapBDetails": {
      "dex": "SushiSwap",
      "from": "USDC",
      "to": "WBTC",
      "amountIn": "63024.510000",
      "amountOut": "0.98500000",
      "priceImpact": "0.7234%",
      "reserves": {
        "USDC": "8788024.760000",
        "WBTC": "137.25000000",
        "pairAddress": "0x..."
      },
      "estimatedGas": "200000"
    }
  },
  "allOpportunities": [
    {
      "path": "SushiSwap → SushiSwap",
      "profitLoss": "-0.01500000",
      "profitLossPercentage": "-1.5000%",
      "isProfit": false
    },
    {
      "path": "SushiSwap → QuickSwap",
      "profitLoss": "-0.02300000",
      "profitLossPercentage": "-2.3000%",
      "isProfit": false
    },
    {
      "path": "QuickSwap → SushiSwap",
      "profitLoss": "-0.03100000",
      "profitLossPercentage": "-3.1000%",
      "isProfit": false
    },
    {
      "path": "QuickSwap → QuickSwap",
      "profitLoss": "-0.04200000",
      "profitLossPercentage": "-4.2000%",
      "isProfit": false
    }
  ],
  "timestamp": 1699000000000
}
```

**How It Works:**

1. **Direction A**: Swaps `amountIn` of token1 → token2 on each DEX
2. **Direction B**: Takes the output from step 1 and swaps token2 → token1 on each DEX
3. **Analysis**: Calculates profit/loss by comparing final amount to initial amount
4. **Results**: Shows all combinations sorted by best profit/loss

**Response Fields:**

| Field | Description |
|-------|-------------|
| `summary.hasArbitrage` | `true` if any profitable round-trip exists (after gas fees) |
| `summary.bestProfit` | Best NET profit amount after gas fees (null if no profit) |
| `summary.bestProfitPercentage` | Best NET profit percentage after gas fees |
| `summary.bestGrossProfit` | Best GROSS profit before gas fees |
| `summary.bestProfitPath` | DEX path for best profit (e.g., "QuickSwap → SushiSwap") |
| `bestProfitableOpportunity` | Best profitable round-trip after gas fees (null if none) |
| `bestOverallOpportunity` | Best round-trip overall (even if unprofitable) |
| `allOpportunities` | All round-trip combinations sorted by NET profit |
| `profitLoss` | Gross profit/loss before gas fees |
| `netProfit.profitLoss` | Net profit/loss after deducting gas fees |
| `gasEstimate.gasCostInToken` | Estimated gas cost converted to the trading token |
| `gasEstimate.totalGasUnits` | Total gas units for both swaps |
| `gasEstimate.gasPriceGwei` | Current gas price in Gwei |

**Gas Fee Calculation:**

The arbitrage analysis now includes **automatic gas fee estimation** for both swaps:

1. **Gas Units**: Estimates gas required for each swap (default: 200,000 units per swap)
2. **Gas Price**: Fetches current gas price from the network (default: 50 Gwei for Polygon)
3. **Gas Cost**: Calculates total cost in WPOL (native token)
4. **Conversion**: Converts gas cost to the trading token if different from WPOL
5. **Net Profit**: Deducts gas fees from gross profit to show real profitability

**Important Notes:**
- All opportunities are now **sorted by NET profit** (after gas fees)
- `hasArbitrage` flag indicates profitability **after gas fees**
- Gas estimates are approximate and actual costs may vary
- For non-WPOL tokens, gas cost is converted using DEX prices

**Use Cases:**

- **Find Arbitrage**: Discover profitable round-trip swaps across DEXes (after gas costs)
- **Compare DEXes**: See which DEX combinations have least slippage and fees
- **Market Analysis**: Understand price efficiency and true profitability
- **Risk Assessment**: Evaluate actual net profit potential including all costs

---

### Scan All Token Pairs for Arbitrage

**POST** `/api/v1/swap/scan-arbitrage`

Automatically scans all possible token pair combinations from the token registry to find arbitrage opportunities. This is a comprehensive scan that checks every pair against multiple DEXes.

**Request Body:**
```json
{
  "dexName": ["QuickSwap", "SushiSwap", "ApeSwap"],
  "amountIn": "1000",
  "minProfitPercentage": 0.5,
  "slippage": 0.5
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dexName` | array | Yes | Array of DEX names to scan |
| `amountIn` | string | Yes | Test amount for arbitrage calculations |
| `minProfitPercentage` | number | No | Minimum profit % to report (default: 0.1%) |
| `slippage` | number | No | Slippage tolerance % |

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/swap/scan-arbitrage \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "SushiSwap"],
    "amountIn": "1000",
    "minProfitPercentage": 0.5
  }'
```

**Response:**
```json
{
  "success": true,
  "scan": {
    "totalPairs": 190,
    "scannedPairs": 190,
    "errorCount": 12,
    "profitableOpportunities": 3,
    "minProfitThreshold": "0.5%"
  },
  "dexesAnalyzed": ["QuickSwap", "SushiSwap"],
  "initialAmount": "1000",
  "profitableOpportunities": [
    {
      "pair": "WMATIC/USDC",
      "token1": {
        "symbol": "WMATIC",
        "address": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        "decimals": 18
      },
      "token2": {
        "symbol": "USDC",
        "address": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        "decimals": 6
      },
      "hasArbitrage": true,
      "bestProfit": "8.5000",
      "bestProfitPercentage": "0.85%",
      "bestProfitPath": "QuickSwap → SushiSwap",
      "totalOpportunities": 4,
      "opportunity": {
        "path": "QuickSwap → SushiSwap",
        "dexA": "QuickSwap",
        "dexB": "SushiSwap",
        "route": "WMATIC → USDC → WMATIC",
        "initialAmount": "1000",
        "intermediateAmount": "550.25",
        "finalAmount": "1008.50",
        "profitLoss": "8.5000",
        "profitLossPercentage": "0.85%",
        "profitLossToken": "WMATIC",
        "isProfit": true,
        "swapADetails": {
          "dex": "QuickSwap",
          "from": "WMATIC",
          "to": "USDC",
          "amountIn": "1000",
          "amountOut": "550.25",
          "priceImpact": "0.0234%"
        },
        "swapBDetails": {
          "dex": "SushiSwap",
          "from": "USDC",
          "to": "WMATIC",
          "amountIn": "550.25",
          "amountOut": "1008.50",
          "priceImpact": "0.0198%"
        }
      }
    },
    {
      "pair": "WETH/USDC",
      "bestProfit": "5.2500",
      "bestProfitPercentage": "0.53%",
      "bestProfitPath": "SushiSwap → QuickSwap",
      "opportunity": { }
    }
  ],
  "allResults": [
    {
      "pair": "WMATIC/USDC",
      "hasArbitrage": true,
      "bestProfitPercentage": "0.85%"
    },
    {
      "pair": "WETH/USDC",
      "hasArbitrage": true,
      "bestProfitPercentage": "0.53%"
    }
  ],
  "timestamp": 1699000000000
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `scan.totalPairs` | Total number of token pairs generated |
| `scan.scannedPairs` | Number of pairs successfully scanned |
| `scan.errorCount` | Number of pairs that failed to scan |
| `scan.profitableOpportunities` | Count of profitable opportunities found |
| `profitableOpportunities` | Top 20 profitable opportunities (sorted by profit %) |
| `allResults` | All pairs with any arbitrage detected |

**How It Works:**

1. Fetches all tokens from the registry (e.g., 20 tokens)
2. Generates all unique pairs (e.g., 190 combinations from 20 tokens)
3. For each pair:
   - Runs full arbitrage analysis across specified DEXes
   - Checks both swap directions
   - Calculates real profit/loss
4. Filters results by minimum profit threshold
5. Returns sorted list of profitable opportunities

**Performance Notes:**

- With 20 tokens: ~190 pairs to scan
- With 2 DEXes: ~760 individual swap quotes (190 × 2 × 2)
- Estimated time: 30-60 seconds (with 100ms rate limiting)
- Consider running during off-peak hours for faster results

**Use Cases:**

- **Automated Discovery**: Find arbitrage opportunities without manual pair selection
- **Market Monitoring**: Regular scans to detect temporary price inefficiencies
- **Strategy Development**: Identify which pairs have consistent arbitrage potential
- **Portfolio Optimization**: Discover most profitable trading pairs

**Tips:**

- Use higher `minProfitPercentage` (e.g., 1%) to reduce noise
- Start with 2 DEXes to minimize scan time
- Use reasonable `amountIn` that reflects actual trading volume
- Run scans periodically to catch new opportunities

---

### Execute Arbitrage by ID

**POST** `/api/v1/swap/execute-arbitrage`

Execute a previously scanned arbitrage opportunity by its unique ID. This endpoint executes both swaps (round-trip) automatically.

**Request Body:**
```json
{
  "arbitrageId": "arb_1762508284502_a3b4c5d6e",
  "privateKey": "0x...",
  "amountIn": "100",
  "slippage": 0.5
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `arbitrageId` | string | Yes | Unique ID from scan-arbitrage response |
| `privateKey` | string | Yes | Private key for signing transactions |
| `amountIn` | string | No | Override amount (uses cached if not provided) |
| `slippage` | number | No | Override slippage % (uses cached if not provided) |

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/swap/execute-arbitrage \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "arbitrageId": "arb_1762508284502_a3b4c5d6e",
    "privateKey": "0x1234...",
    "slippage": 0.5
  }'
```

**Response (Success):**
```json
{
  "success": true,
  "arbitrageId": "arb_1762508284502_a3b4c5d6e",
  "pair": "WMATIC/UNI",
  "path": "SushiSwap → QuickSwap",
  "swapA": {
    "success": true,
    "dex": "SushiSwap",
    "transactionHash": "0x...",
    "tokenIn": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "tokenOut": "0xb33EaAd8d922B1083446DC23f610c2567fB5180f",
    "amountIn": "100",
    "amountOut": "5.234567",
    "gasUsed": "185000"
  },
  "swapB": {
    "success": true,
    "dex": "QuickSwap",
    "transactionHash": "0x...",
    "tokenIn": "0xb33EaAd8d922B1083446DC23f610c2567fB5180f",
    "tokenOut": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "amountIn": "5.234567",
    "amountOut": "100.061505",
    "gasUsed": "178000"
  },
  "profitAnalysis": {
    "initialAmount": "100",
    "finalAmount": "100.061505",
    "actualProfit": "0.061505",
    "actualProfitPercentage": "0.0615%",
    "expectedProfit": "0.000061504893943937",
    "expectedProfitPercentage": "0.0615%",
    "profitToken": "WMATIC",
    "slippage": "Better than expected"
  },
  "timestamp": 1762508320000
}
```

**Response (Expired ID):**
```json
{
  "success": false,
  "error": "Arbitrage opportunity not found or expired",
  "message": "The arbitrage ID is invalid or the opportunity has expired (TTL: 5 minutes)",
  "arbitrageId": "arb_1762508284502_a3b4c5d6e"
}
```

**Response (First Swap Failed):**
```json
{
  "success": false,
  "error": "First swap failed",
  "swapA": {
    "success": false,
    "error": "Insufficient token balance"
  },
  "arbitrageId": "arb_1762508284502_a3b4c5d6e"
}
```

**Response (Second Swap Failed):**
```json
{
  "success": false,
  "error": "Second swap failed (first swap succeeded)",
  "warning": "You may have partial position. Check your wallet.",
  "swapA": {
    "success": true,
    "transactionHash": "0x..."
  },
  "swapB": {
    "success": false,
    "error": "Insufficient liquidity"
  },
  "arbitrageId": "arb_1762508284502_a3b4c5d6e"
}
```

**Important Notes:**

- **TTL (Time To Live)**: Arbitrage IDs expire after 5 minutes by default
- **Atomic Execution**: Both swaps are executed sequentially (not atomic - first swap must succeed before second)
- **Partial Failure Risk**: If first swap succeeds but second fails, you'll have a partial position
- **Price Movement**: Prices may have changed since the scan - actual profit may differ from expected
- **Gas Costs**: Remember to account for gas costs when calculating net profit

**Workflow:**

1. Run `/api/v1/swap/scan-arbitrage` to find opportunities
2. Pick an `id` from the `allResults` or `profitableOpportunities` array
3. Execute immediately using `/api/v1/swap/execute-arbitrage` with that ID
4. Monitor the result for both transaction hashes and profit analysis

---

### Execute Swap

**POST** `/api/v1/swap/execute`

Execute a token swap transaction.

**Request Body:**
```json
{
  "dexName": "QuickSwap",
  "tokenIn": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
  "tokenOut": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amountIn": "1.5",
  "tokenInDecimals": 18,
  "tokenOutDecimals": 6,
  "privateKey": "0x...",
  "slippage": 0.5,
  "deadline": 20,
  "maxFeePerGas": "50",
  "maxPriorityFeePerGas": "30"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `dexName` | string | Yes | DEX router name (e.g., "QuickSwap") |
| `tokenIn` | string | Yes | Input token address |
| `tokenOut` | string | Yes | Output token address |
| `amountIn` | string | Yes | Amount to swap (e.g., "1.5") |
| `tokenInDecimals` | number | Yes | Input token decimals (0-18) |
| `tokenOutDecimals` | number | Yes | Output token decimals (0-18) |
| `privateKey` | string | Yes | Private key for signing (0x...) |
| `recipient` | string | No | Recipient address (defaults to sender) |
| `slippage` | number | No | Slippage tolerance % (default: 0.5) |
| `deadline` | number | No | Deadline in minutes (default: 20) |
| `gasLimit` | string | No | Gas limit (auto-estimated if not provided) |
| `gasPrice` | string | No | Gas price in gwei (legacy) |
| `maxFeePerGas` | string | No | Max fee per gas in gwei (EIP-1559) |
| `maxPriorityFeePerGas` | string | No | Max priority fee per gas in gwei (EIP-1559) |

**Example:**
```bash
curl -X POST http://localhost:3000/api/v1/swap/execute \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": "QuickSwap",
    "tokenIn": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "tokenOut": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amountIn": "1.5",
    "tokenInDecimals": 18,
    "tokenOutDecimals": 6,
    "privateKey": "0x1234567890abcdef...",
    "slippage": 0.5,
    "maxFeePerGas": "50",
    "maxPriorityFeePerGas": "30"
  }'
```

**Success Response:**
```json
{
  "success": true,
  "transactionHash": "0xabc123...",
  "blockNumber": 45678901,
  "gasUsed": "142850",
  "effectiveGasPrice": "45000000000",
  "from": "0xYourAddress...",
  "to": "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
  "swap": {
    "dex": "QuickSwap",
    "tokenIn": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "tokenOut": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amountIn": "1.5",
    "amountInWei": "1500000000000000000",
    "expectedAmountOut": "0.825",
    "minAmountOut": "0.82088",
    "actualAmountOut": "0.826543",
    "slippage": "0.5%",
    "deadline": "2024-01-01T12:30:00.000Z"
  },
  "timestamp": 1699000000000
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Execution failed",
  "code": "INSUFFICIENT_FUNDS",
  "details": "insufficient funds for gas * price + value",
  "timestamp": 1699000000000
}
```

---

### Get Statistics

**GET** `/api/v1/stats`

Get swap executor statistics.

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/v1/stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalSwaps": 25,
    "successfulSwaps": 23,
    "failedSwaps": 2,
    "totalVolumeUSD": 0,
    "successRate": "92.00%",
    "availableRouters": 3
  }
}
```

---

### Reset Statistics

**POST** `/api/v1/stats/reset`

Reset swap executor statistics.

```bash
curl -X POST -H "X-API-Key: your-api-key" http://localhost:3000/api/v1/stats/reset
```

---

### Get Validator Configuration

**GET** `/api/v1/config/validator`

Get current validator configuration.

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/v1/config/validator
```

**Response:**
```json
{
  "success": true,
  "config": {
    "maxSlippage": 5,
    "minSlippage": 0.1,
    "maxDeadlineMinutes": 60,
    "minDeadlineMinutes": 1,
    "maxGasPrice": 500,
    "allowedDexes": [],
    "allowedTokens": []
  }
}
```

---

### Get All Tokens

**GET** `/api/v1/tokens`

Get list of all tokens in the registry.

```bash
curl -H "X-API-Key: your-api-key" http://localhost:3000/api/v1/tokens
```

**Response:**
```json
{
  "success": true,
  "tokens": [
    {
      "symbol": "USDC",
      "address": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "name": "USD Coin (PoS)",
      "decimals": 6,
      "type": "stablecoin"
    },
    {
      "symbol": "WMATIC",
      "address": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
      "name": "Wrapped Matic",
      "decimals": 18,
      "type": "native"
    }
  ],
  "count": 20
}
```

---

### Search Tokens

**GET** `/api/v1/tokens/search?q=USDC`

Search for tokens by symbol, name, or address.

```bash
curl -H "X-API-Key: your-api-key" "http://localhost:3000/api/v1/tokens/search?q=USDC"
```

**Response:**
```json
{
  "success": true,
  "query": "USDC",
  "results": [
    {
      "symbol": "USDC",
      "address": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "name": "USD Coin (PoS)",
      "decimals": 6,
      "type": "stablecoin"
    },
    {
      "symbol": "USDC.e",
      "address": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "name": "USD Coin (PoS)",
      "decimals": 6,
      "type": "stablecoin"
    }
  ],
  "count": 2
}
```

---

### Resolve Token

**POST** `/api/v1/tokens/resolve`

Resolve a token by symbol or address. Fetches metadata from blockchain if not in registry.

```bash
curl -X POST http://localhost:3000/api/v1/tokens/resolve \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{"token": "GHST"}'
```

**Response (from registry):**
```json
{
  "success": true,
  "token": {
    "address": "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7",
    "symbol": "GHST",
    "name": "Aavegotchi GHST Token",
    "decimals": 18,
    "type": "gaming",
    "source": "registry"
  }
}
```

**Response (from blockchain):**
```json
{
  "success": true,
  "token": {
    "address": "0x...",
    "symbol": "CUSTOM",
    "name": "Custom Token",
    "decimals": 18,
    "source": "blockchain"
  }
}
```

---

### Get Token Balance

**POST** `/api/v1/balance`

Get token balance for a specific address. Can check a single token or all tokens in the registry.

**Request Body (single token):**
```json
{
  "address": "0xcdaA95C0c9859063614Ad9f9fd114B914B490B9c",
  "token": "WPOL"
}
```

**Request Body (all tokens):**
```json
{
  "address": "0xcdaA95C0c9859063614Ad9f9fd114B914B490B9c"
}
```

**Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `address` | string | Yes | Wallet address to check balance for |
| `token` | string | No | Token symbol or address (if omitted, checks all tokens) |

**Example (single token):**
```bash
curl -X POST http://localhost:3000/api/v1/balance \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xcdaA95C0c9859063614Ad9f9fd114B914B490B9c",
    "token": "WPOL"
  }'
```

**Response (single token):**
```json
{
  "success": true,
  "address": "0xcdaA95C0c9859063614Ad9f9fd114B914B490B9c",
  "token": {
    "symbol": "WPOL",
    "address": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "name": "Wrapped POL",
    "decimals": 18,
    "balance": "27.845116034158749827",
    "balanceRaw": "27845116034158749827"
  },
  "timestamp": 1699000000000
}
```

**Example (all tokens):**
```bash
curl -X POST http://localhost:3000/api/v1/balance \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "address": "0xcdaA95C0c9859063614Ad9f9fd114B914B490B9c"
  }'
```

**Response (all tokens):**
```json
{
  "success": true,
  "address": "0xcdaA95C0c9859063614Ad9f9fd114B914B490B9c",
  "summary": {
    "totalTokens": 16,
    "tokensWithBalance": 3,
    "tokensWithoutBalance": 13,
    "errors": 0
  },
  "balances": {
    "withBalance": [
      {
        "symbol": "WPOL",
        "address": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
        "name": "Wrapped POL",
        "decimals": 18,
        "balance": "27.845116034158749827",
        "balanceRaw": "27845116034158749827",
        "hasBalance": true
      },
      {
        "symbol": "USDC",
        "address": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
        "name": "USD Coin (PoS)",
        "decimals": 6,
        "balance": "150.250000",
        "balanceRaw": "150250000",
        "hasBalance": true
      },
      {
        "symbol": "UNI",
        "address": "0xb33EaAd8d922B1083446DC23f610c2567fB5180f",
        "name": "Uniswap (PoS)",
        "decimals": 18,
        "balance": "5.234567891234567890",
        "balanceRaw": "5234567891234567890",
        "hasBalance": true
      }
    ],
    "withoutBalance": [
      {
        "symbol": "USDT",
        "address": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        "name": "Tether USD (PoS)",
        "decimals": 6,
        "balance": "0.0",
        "balanceRaw": "0",
        "hasBalance": false
      }
    ]
  },
  "timestamp": 1699000000000
}
```

**Response Fields:**

| Field | Description |
|-------|-------------|
| `address` | Wallet address that was queried |
| `token` | Token details (single token mode only) |
| `summary` | Summary of balance results (all tokens mode) |
| `balances.withBalance` | Array of tokens with non-zero balance |
| `balances.withoutBalance` | Array of tokens with zero balance |
| `balances.errors` | Array of tokens that failed to query (if any) |

**Use Cases:**

- **Wallet Monitoring**: Check token holdings before executing trades
- **Portfolio Overview**: Get complete view of all token balances
- **Balance Verification**: Confirm sufficient balance before swap execution
- **Multi-Token Tracking**: Monitor multiple token balances in one call

---

## Request Examples

### Example 1: Get Quote and Execute Swap

```bash
# 1. Get a quote first
QUOTE=$(curl -X POST http://localhost:3000/api/v1/swap/quote \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": "QuickSwap",
    "tokenIn": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "tokenOut": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amountIn": "1.0",
    "tokenInDecimals": 18,
    "tokenOutDecimals": 6
  }')

echo "Quote: $QUOTE"

# 2. Review quote, then execute if acceptable
curl -X POST http://localhost:3000/api/v1/swap/execute \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": "QuickSwap",
    "tokenIn": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "tokenOut": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amountIn": "1.0",
    "tokenInDecimals": 18,
    "tokenOutDecimals": 6,
    "privateKey": "0x...",
    "slippage": 0.5
  }'
```

### Example 2: Python Integration

```python
import requests
import json

API_URL = "http://localhost:3000"
API_KEY = "your-api-key"

headers = {
    "X-API-Key": API_KEY,
    "Content-Type": "application/json"
}

# Get quote
quote_request = {
    "dexName": "QuickSwap",
    "tokenIn": "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    "tokenOut": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amountIn": "1.5",
    "tokenInDecimals": 18,
    "tokenOutDecimals": 6
}

response = requests.post(
    f"{API_URL}/api/v1/swap/quote",
    headers=headers,
    json=quote_request
)

quote = response.json()
print(f"Expected output: {quote['expectedAmountOut']}")

# Execute swap if quote is acceptable
if float(quote['expectedAmountOut']) > 0.8:
    swap_request = {
        **quote_request,
        "privateKey": "0x...",
        "slippage": 0.5,
        "maxFeePerGas": "50",
        "maxPriorityFeePerGas": "30"
    }

    response = requests.post(
        f"{API_URL}/api/v1/swap/execute",
        headers=headers,
        json=swap_request
    )

    result = response.json()
    if result['success']:
        print(f"Swap successful! TX: {result['transactionHash']}")
    else:
        print(f"Swap failed: {result['error']}")
```

### Example 3: JavaScript/Node.js Integration

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:3000';
const API_KEY = 'your-api-key';

const headers = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json'
};

async function executeSwap() {
  try {
    // Get quote
    const quoteResponse = await axios.post(
      `${API_URL}/api/v1/swap/quote`,
      {
        dexName: 'QuickSwap',
        tokenIn: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
        tokenOut: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
        amountIn: '1.5',
        tokenInDecimals: 18,
        tokenOutDecimals: 6
      },
      { headers }
    );

    const quote = quoteResponse.data;
    console.log('Expected output:', quote.expectedAmountOut);

    // Execute swap
    const swapResponse = await axios.post(
      `${API_URL}/api/v1/swap/execute`,
      {
        ...quote,
        privateKey: '0x...',
        slippage: 0.5,
        maxFeePerGas: '50',
        maxPriorityFeePerGas: '30'
      },
      { headers }
    );

    const result = swapResponse.data;
    if (result.success) {
      console.log('Swap successful!', result.transactionHash);
    } else {
      console.error('Swap failed:', result.error);
    }
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

executeSwap();
```

## Error Handling

### Common Error Responses

**Validation Error (400)**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": [
    "tokenIn must be a valid Ethereum address",
    "slippage must be between 0.1% and 5%"
  ]
}
```

**Unauthorized (401)**
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```

**Rate Limit Exceeded (429)**
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "message": "Maximum 100 requests per 60 seconds"
}
```

**Server Error (500)**
```json
{
  "success": false,
  "error": "Internal server error",
  "message": "Error description"
}
```

## Security Best Practices

### 1. **Protect Your Private Keys**
- Never commit private keys to version control
- Use environment variables for sensitive data
- Consider using a hardware wallet or key management service

### 2. **Use Strong API Keys**
```bash
# Generate a secure API key
openssl rand -hex 32
```

### 3. **Enable HTTPS in Production**
- Use a reverse proxy (nginx, Apache) with SSL/TLS
- Never send private keys over unencrypted connections

### 4. **Restrict API Access**
- Use firewall rules to limit access to trusted IPs
- Consider implementing IP whitelisting

### 5. **Set Appropriate Limits**
```javascript
validation: {
  maxSlippage: 2,              // Lower max slippage
  maxGasPrice: 200,            // Lower max gas price
  allowedDexes: ['QuickSwap'], // Restrict to specific DEXes
  allowedTokens: ['0x...'],    // Whitelist specific tokens
  requireRecipientWhitelist: true,
  recipientWhitelist: ['0xYourAddress']
}
```

### 6. **Monitor and Alert**
- Set up monitoring for failed swaps
- Alert on suspicious activity (high volume, failed validations)
- Review statistics regularly using `/api/v1/stats`

### 7. **Test on Testnet First**
- Always test new configurations on a testnet
- Verify gas estimates and slippage tolerances
- Start with small amounts in production

## Common Token Addresses (Polygon Mainnet)

| Token | Address |
|-------|---------|
| WMATIC | `0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270` |
| USDC | `0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174` |
| USDT | `0xc2132D05D31c914a87C6611C10748AEb04B58e8F` |
| WETH | `0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619` |
| DAI | `0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063` |

## Support

For issues or questions:
1. Check the logs for detailed error messages
2. Review validator configuration limits
3. Ensure sufficient token balance and gas
4. Verify token approvals are set for the DEX router

## License

This swap system is part of PolyBot. Use at your own risk. Always test thoroughly before executing real swaps.
