# Unsupported Pairs Configuration Guide

This guide explains how to configure and manage unsupported token pairs for DEXes to optimize arbitrage scanning performance.

## Overview

When scanning for arbitrage opportunities across multiple DEXes, not all DEXes have liquidity pools for every token pair. Querying these unsupported pairs wastes RPC calls and slows down scanning. By configuring known unsupported pairs, you can skip them automatically.

## Configuration

### 1. Define Unsupported Pairs in Config

Edit your `src/config/default.js` (or `src/config/custom.js`) and add the `unsupportedPairs` array to each DEX router:

```javascript
dexRouters: [
  {
    name: "QuickSwap",
    address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    enabled: true,
    unsupportedPairs: [
      "LINK/CRV",
      "AAVE/UNI",
      "GHST/SAND"
    ]
  },
  {
    name: "SushiSwap",
    address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    enabled: true,
    unsupportedPairs: [
      "USDC/AAVE"
    ]
  },
  {
    name: "ApeSwap",
    address: "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607",
    enabled: true,
    unsupportedPairs: [
      "WETH/LINK",
      "DAI/GHST"
    ]
  }
]
```

### 2. Pair Format

- **Format**: `"TOKEN1/TOKEN2"` (e.g., `"USDC/AAVE"`)
- **Direction**: Works in both directions - `"USDC/AAVE"` also matches `"AAVE/USDC"`
- **Case**: Case-insensitive - `"USDC/aave"` matches `"usdc/AAVE"`

### 3. How to Find Unsupported Pairs

#### Method 1: Run Arbitrage Scan and Check Results

Run a full arbitrage scan and check the `unsupportedPairs` section:

```bash
curl -X POST http://localhost:30000/api/v1/swap/scan-arbitrage \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "SushiSwap", "ApeSwap"],
    "amountIn": "1",
    "minProfitPercentage": 0.5
  }'
```

Look for the `unsupportedPairs` section in the response:

```json
{
  "unsupportedPairs": {
    "total": 45,
    "byDex": {
      "QuickSwap": [
        {
          "pair": "USDC/AAVE",
          "direction": "USDC → AAVE",
          "reason": "execution reverted"
        }
      ],
      "ApeSwap": [
        {
          "pair": "LINK/CRV",
          "direction": "LINK → CRV",
          "reason": "execution reverted"
        }
      ]
    }
  }
}
```

#### Method 2: Monitor Logs

When running with debug logging enabled, watch for "execution reverted" errors for specific pairs on specific DEXes.

## Maintenance Strategy

### Initial Setup

1. **Run a full scan** with all DEXes and all tokens
2. **Collect the unsupported pairs** from the `unsupportedPairs` response
3. **Add them to your config** for each DEX
4. **Restart the service** to apply the configuration

### Ongoing Maintenance

Update your unsupported pairs list when:
- You add new tokens to the registry
- DEXes add new liquidity pools
- You discover pairs that consistently fail

### Example Workflow

```bash
# 1. Run initial scan
curl -X POST http://localhost:30000/api/v1/swap/scan-arbitrage \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "SushiSwap", "ApeSwap"],
    "amountIn": "1"
  }' > scan_results.json

# 2. Extract unsupported pairs by DEX
cat scan_results.json | jq '.unsupportedPairs.byDex'

# 3. Add to config file
# Edit src/config/default.js manually

# 4. Restart service
npm start
```

## Benefits

### Performance Improvements

**Before Configuration:**
- 190 token pairs
- 3 DEXes
- 2 directions per pair
- **1,140 RPC calls** (many will fail)
- Scan time: ~60 seconds

**After Configuration:**
- 190 token pairs
- 45 unsupported combinations skipped
- **1,050 RPC calls** (only valid queries)
- Scan time: ~45 seconds
- **25% faster**, fewer errors

### Cleaner Reports

Unsupported pairs are clearly identified with reason "Pair not supported (skipped by configuration)" instead of blockchain errors like "execution reverted".

### Reduced RPC Load

Fewer failed calls mean:
- Less load on your RPC provider
- Lower costs if using paid RPC service
- Better rate limit compliance

## Verification

### Check if Configuration is Loaded

When you start the service, look for initialization logs:

```
[SwapExecutor] Initialized router: QuickSwap {
  address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
  unsupportedPairs: 3
}
```

### Test a Known Unsupported Pair

Try to get a quote for a pair you know is unsupported:

```bash
curl -X POST http://localhost:30000/api/v1/swap/quote \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "ApeSwap"],
    "tokenIn": "USDC",
    "tokenOut": "AAVE",
    "amountIn": "100"
  }'
```

Check if the response shows:

```json
{
  "failedQuotes": [
    {
      "dex": "ApeSwap",
      "error": "Pair not supported (skipped by configuration)",
      "skipped": true
    }
  ]
}
```

## Advanced Usage

### Per-DEX Blacklist

You can maintain different unsupported lists per DEX:

```javascript
{
  name: "QuickSwap",
  unsupportedPairs: ["LINK/CRV", "AAVE/UNI"]  // QuickSwap doesn't support these
},
{
  name: "SushiSwap",
  unsupportedPairs: ["GHST/SAND"]  // SushiSwap doesn't support this
}
```

### Empty Lists

If a DEX supports all pairs (or you want to query everything), use an empty array:

```javascript
{
  name: "QuickSwap",
  unsupportedPairs: []  // Query all pairs
}
```

### Dynamic Updates

You can update the configuration file and restart the service to apply new unsupported pairs without code changes.

## Troubleshooting

### Pair Still Being Queried

**Symptoms:** A pair marked as unsupported is still being queried

**Solutions:**
1. Check the pair format (must be "TOKEN1/TOKEN2")
2. Verify the token symbols match exactly
3. Restart the service after config changes
4. Check logs for "Pair X/Y is marked as unsupported on DEX" messages

### All Pairs Skipped

**Symptoms:** All queries return "All DEXes have this pair marked as unsupported"

**Solutions:**
1. Review your `unsupportedPairs` arrays - they might be too broad
2. Ensure you haven't accidentally marked common pairs as unsupported
3. Try with `unsupportedPairs: []` temporarily to verify

### Logs Not Showing Skip Messages

**Symptoms:** You don't see debug logs about skipped pairs

**Solutions:**
1. Enable debug logging: `LOG_LEVEL=debug npm start`
2. Check that the configuration is loaded (look for "unsupportedPairs: N" in init logs)

## Best Practices

1. **Start Conservative**: Only add pairs you're certain are unsupported
2. **Test Periodically**: DEXes add liquidity - retest unsupported pairs quarterly
3. **Document Why**: Add comments explaining why certain pairs are unsupported
4. **Use Version Control**: Track changes to unsupported pairs configuration
5. **Monitor Performance**: Track scan times before/after configuration changes

## Example Production Configuration

```javascript
dexRouters: [
  {
    name: "QuickSwap",
    address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    enabled: true,
    // Last updated: 2025-01-15
    // These pairs consistently fail due to no liquidity
    unsupportedPairs: [
      "LINK/CRV",    // No direct pair
      "AAVE/UNI",    // Insufficient liquidity
      "GHST/SAND",   // Gaming tokens not paired
      "MANA/SUSHI"   // Cross-category pair
    ]
  },
  {
    name: "SushiSwap",
    address: "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
    enabled: true,
    // Last updated: 2025-01-15
    unsupportedPairs: [
      "USDC/AAVE",   // Better liquidity on QuickSwap
      "DAI/LINK"     // No direct pool
    ]
  },
  {
    name: "ApeSwap",
    address: "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607",
    enabled: true,
    // Last updated: 2025-01-15
    // ApeSwap has limited token support
    unsupportedPairs: [
      "WETH/LINK",
      "USDC/AAVE",
      "DAI/GHST",
      "WBTC/CRV",
      "USDT/UNI"
    ]
  }
]
```

## Summary

The unsupported pairs feature helps you:
- ⚡ **Speed up** arbitrage scanning by 20-30%
- 💰 **Reduce** RPC costs and usage
- 🎯 **Focus** on pairs that actually have liquidity
- 📊 **Improve** reporting clarity

By maintaining an accurate list of unsupported pairs, you create a more efficient and cost-effective arbitrage scanning system.
