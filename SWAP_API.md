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
  "amountIn": "1.5",
  "expectedAmountOut": "0.825",
  "minAmountOut": "0.82088",
  "slippage": "0.5%",
  "priceImpact": "N/A",
  "estimatedGas": "150000",
  "timestamp": 1699000000000
}
```

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
