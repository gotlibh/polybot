# Pair Discovery Guide

This guide explains how to automatically discover which token pairs are supported by each DEX and generate configuration automatically.

## Overview

The pair discovery feature tests all token pairs against all specified DEXes to determine which pairs have liquidity pools. It then generates ready-to-use configuration for both `supportedPairs` (whitelist) and `unsupportedPairs` (blacklist).

## Methods

There are two ways to discover pairs:

1. **CLI Script** - Standalone script for one-time discovery
2. **API Endpoint** - REST API for programmatic discovery

---

## Method 1: CLI Script

### Basic Usage

```bash
node scripts/discover-pairs.js
```

This will test all enabled DEXes with all token pairs.

### Options

**Filter by DEX:**
```bash
# Test only QuickSwap
node scripts/discover-pairs.js --dex=QuickSwap

# Test multiple DEXes
node scripts/discover-pairs.js --dex=QuickSwap,SushiSwap,ApeSwap
```

**Output Mode:**
```bash
# Generate only supportedPairs (whitelist)
node scripts/discover-pairs.js --output=supported

# Generate only unsupportedPairs (blacklist)
node scripts/discover-pairs.js --output=unsupported

# Generate both (default)
node scripts/discover-pairs.js --output=both
```

**Test Amount:**
```bash
# Use 10 tokens for testing (default is 1)
node scripts/discover-pairs.js --test-amount=10
```

### Example Output

```
╔════════════════════════════════════════════════════════════╗
║         DEX Pair Discovery Script                         ║
╚════════════════════════════════════════════════════════════╝

Network: Polygon
RPC URL: https://polygon-rpc.com...
Test Amount: 1 tokens
Output Mode: both
DEXes to test: QuickSwap, SushiSwap
Total token pairs: 45
Total tests: 90

Starting discovery... This may take several minutes.

📊 Testing QuickSwap...
   Address: 0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff
   Progress: 100% (38 supported, 7 unsupported)

📊 Testing SushiSwap...
   Address: 0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506
   Progress: 100% (35 supported, 10 unsupported)

╔════════════════════════════════════════════════════════════╗
║                    Discovery Results                       ║
╚════════════════════════════════════════════════════════════╝

QuickSwap:
  Supported: 38 pairs
  Unsupported: 7 pairs
  Success Rate: 84%

SushiSwap:
  Supported: 35 pairs
  Unsupported: 10 pairs
  Success Rate: 78%

╔════════════════════════════════════════════════════════════╗
║                Generated Configuration                     ║
╚════════════════════════════════════════════════════════════╝

Copy and paste this into your src/config/default.js:

dexRouters: [
  {
    name: "QuickSwap",
    address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    enabled: true,

    // Supported pairs (whitelist)
    supportedPairs: [
      "USDC/WPOL",
      "WETH/USDC",
      "DAI/USDC",
      // ... 35 more pairs
    ],

    // Unsupported pairs (blacklist)
    unsupportedPairs: [
      "LINK/CRV",
      "AAVE/UNI",
      // ... 5 more pairs
    ]
  },
  // ... more DEXes
]

╔════════════════════════════════════════════════════════════╗
║                    Recommendations                         ║
╚════════════════════════════════════════════════════════════╝

✅ QuickSwap: Use unsupportedPairs (blacklist) - high success rate (84%)
✅ SushiSwap: Use unsupportedPairs (blacklist) - high success rate (78%)
```

---

## Method 2: API Endpoint

### Endpoint

**POST** `/api/v1/swap/discover-pairs`

### Request

```bash
curl -X POST http://localhost:30000/api/v1/swap/discover-pairs \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "SushiSwap"],
    "testAmount": "1",
    "outputMode": "both"
  }'
```

### Request Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `dexName` | array | Yes | - | Array of DEX names to test |
| `testAmount` | string | No | "1" | Amount of tokens to use for testing |
| `outputMode` | string | No | "both" | Output mode: "supported", "unsupported", or "both" |

### Response

```json
{
  "success": true,
  "discovery": {
    "dexes": ["QuickSwap", "SushiSwap"],
    "totalPairs": 45,
    "testAmount": "1",
    "durationSeconds": 12.34
  },
  "results": {
    "QuickSwap": {
      "address": "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
      "tested": 45,
      "errors": 0,
      "supportedCount": 38,
      "unsupportedCount": 7,
      "successRate": "84%",
      "supported": [
        "USDC/WPOL",
        "WETH/USDC",
        "DAI/USDC"
        // ... more pairs
      ],
      "unsupported": [
        "LINK/CRV",
        "AAVE/UNI"
        // ... more pairs
      ]
    },
    "SushiSwap": {
      // ... similar structure
    }
  },
  "configuration": {
    "QuickSwap": {
      "address": "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
      "supportedPairs": ["USDC/WPOL", "WETH/USDC", ...],
      "unsupportedPairs": ["LINK/CRV", "AAVE/UNI", ...],
      "recommendation": "Use unsupportedPairs (blacklist) - high success rate"
    },
    "SushiSwap": {
      // ... similar structure
    }
  },
  "timestamp": 1699000000000
}
```

---

## Workflow: Discovery to Configuration

### Step 1: Run Discovery

Choose your method:

**Option A: CLI Script**
```bash
node scripts/discover-pairs.js --output=unsupported > discovery-results.txt
```

**Option B: API**
```bash
curl -X POST http://localhost:30000/api/v1/swap/discover-pairs \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "SushiSwap", "ApeSwap"],
    "outputMode": "unsupported"
  }' | jq '.configuration' > discovery-config.json
```

### Step 2: Review Results

Check the success rates:
- **> 70%**: Use `unsupportedPairs` (blacklist) - most pairs work
- **30-70%**: Either approach works
- **< 30%**: Use `supportedPairs` (whitelist) - most pairs don't work

### Step 3: Update Configuration

**Manual Update:**

Edit `src/config/default.js` and copy the generated configuration:

```javascript
dexRouters: [
  {
    name: "QuickSwap",
    address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
    enabled: true,

    // Based on 84% success rate - use blacklist
    supportedPairs: [],
    unsupportedPairs: [
      "LINK/CRV",
      "AAVE/UNI",
      "GHST/SAND"
    ]
  },
  {
    name: "ApeSwap",
    address: "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607",
    enabled: true,

    // Based on 22% success rate - use whitelist
    supportedPairs: [
      "USDC/WPOL",
      "WETH/USDC",
      "BANANA/WPOL"
    ],
    unsupportedPairs: []
  }
]
```

### Step 4: Restart Service

```bash
npm start
```

### Step 5: Verify

Check initialization logs:

```
[SwapExecutor] Initialized router: QuickSwap {
  address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
  supportedPairs: 0,
  unsupportedPairs: 3
}
[SwapExecutor] Initialized router: ApeSwap {
  address: "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607",
  supportedPairs: 3,
  unsupportedPairs: 0
}
```

---

## Advanced Usage

### Partial Discovery

Test only specific DEXes when you add a new one:

```bash
# You already have QuickSwap and SushiSwap configured
# Now you're adding JetSwap - test only that one
node scripts/discover-pairs.js --dex=JetSwap --output=both
```

### Continuous Discovery

Run discovery weekly to catch new liquidity pools:

```bash
#!/bin/bash
# weekly-discovery.sh

DATE=$(date +%Y-%m-%d)
OUTPUT_FILE="discovery-$DATE.json"

curl -X POST http://localhost:30000/api/v1/swap/discover-pairs \
  -H "X-API-Key: $SWAP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "SushiSwap", "ApeSwap"],
    "outputMode": "both"
  }' > "$OUTPUT_FILE"

echo "Discovery complete: $OUTPUT_FILE"

# Compare with last week's results
# If significant changes, notify and update config
```

### Testing New Tokens

After adding tokens to `src/config/tokens.js`:

```bash
# Run discovery to see which DEXes support the new tokens
node scripts/discover-pairs.js --output=supported

# Update config with the supported pairs
```

---

## Performance Considerations

### Batch Size

The discovery process tests pairs in batches of 10 to avoid rate limits. Each batch has a 100ms delay.

**Estimated Time:**
- 45 pairs × 1 DEX = ~5 seconds
- 45 pairs × 3 DEXes = ~15 seconds
- 190 pairs × 7 DEXes = ~2 minutes

### RPC Rate Limits

If you hit rate limits:

1. **Reduce concurrent requests** - Test one DEX at a time
2. **Use paid RPC** - Services like Alchemy/Infura have higher limits
3. **Increase test amount** - Larger amounts might fail faster

### Cost Optimization

Discovery makes read-only RPC calls (no transactions):
- **Free tier**: Usually sufficient (100-1000 calls)
- **Paid tier**: Negligible cost (<$0.01 per full scan)

---

## Troubleshooting

### Error: "RPC URL not configured"

**Solution:** Set your RPC URL:

```bash
export WEB3_RPC_URL="https://polygon-rpc.com"
```

Or configure in `src/config/default.js`:

```javascript
web3: {
  rpcUrl: "https://polygon-rpc.com",
  network: "polygon"
}
```

### Error: "No DEXes to test"

**Causes:**
1. Invalid DEX names in `--dex` parameter
2. All DEXes are disabled in config

**Solution:** Check enabled DEXes:

```bash
# List available DEXes
curl -H "X-API-Key: your-key" http://localhost:30000/api/v1/routers
```

### Discovery Returns All Unsupported

**Possible causes:**
1. **Wrong network** - Using mainnet tokens on testnet
2. **RPC issues** - Node is down or rate limited
3. **DEX address wrong** - Incorrect router address

**Debug:**
```bash
# Test a known good pair manually
node scripts/discover-pairs.js --dex=QuickSwap --test-amount=1
```

### Some Pairs Intermittently Fail

**Cause:** RPC rate limits or temporary node issues

**Solution:** Run discovery again or increase delay between batches.

---

## Best Practices

1. **Initial Discovery**
   - Run with `--output=both` to see full picture
   - Review recommendations before choosing approach

2. **Regular Updates**
   - Run discovery monthly to catch new pools
   - Update config when success rates change significantly (±10%)

3. **Documentation**
   - Add comments to config explaining why pairs are filtered
   - Include discovery date: `// Last updated: 2025-01-15`

4. **Version Control**
   - Commit discovery results with config changes
   - Track success rate trends over time

5. **Testing**
   - After updating config, test with a small arbitrage scan
   - Verify skipped pairs match expectations

---

## Example: Complete Workflow

```bash
# 1. Run discovery for all DEXes
node scripts/discover-pairs.js --output=both > discovery-2025-01-15.txt

# 2. Review results
cat discovery-2025-01-15.txt

# 3. Extract configuration (from the script output)
# Copy the "Generated Configuration" section

# 4. Update src/config/default.js
# Paste configuration, add comments with date

# 5. Restart service
npm start

# 6. Verify with test scan
curl -X POST http://localhost:30000/api/v1/swap/scan-arbitrage \
  -H "X-API-Key: $SWAP_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "SushiSwap"],
    "amountIn": "100",
    "minProfitPercentage": 0.5
  }' | jq '.scan'

# 7. Check logs for skipped pairs
tail -f logs/polybot.log | grep "skipped by configuration"

# 8. Commit changes
git add src/config/default.js discovery-2025-01-15.txt
git commit -m "Update pair filters based on discovery - Jan 15, 2025"
```

---

## Summary

The pair discovery feature automates the tedious process of finding which pairs work on which DEXes:

✅ **Automated Testing** - Tests all pairs automatically
✅ **Smart Recommendations** - Suggests whitelist vs blacklist
✅ **Ready-to-Use Config** - Generates configuration you can copy/paste
✅ **API & CLI** - Use programmatically or manually
✅ **Performance Boost** - Can reduce scan time by 20-98%

Run discovery, update config, restart, and enjoy faster arbitrage scanning!
