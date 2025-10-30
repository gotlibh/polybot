# Enhanced Transaction Details - Summary

## What's New

Your PolyBot now includes **comprehensive transaction analysis** with **fully configurable output**. You can extract and display all available blockchain transaction data, and control exactly what information appears.

## New Components

### 1. TransactionEnricher ([src/core/TransactionEnricher.js](src/core/TransactionEnricher.js))
- Fetches transaction receipts from confirmed transactions
- Extracts token transfers (ERC20, ERC721, ERC1155)
- Adds block timestamp and detailed receipt data
- Includes caching to optimize performance

### 2. Enhanced TransactionParser ([src/parsers/TransactionParser.js](src/parsers/TransactionParser.js))
Now parses and calculates:
- **All gas metrics**: gas used, efficiency, effective gas price, actual fees
- **EIP-1559 fee savings**: How much you saved vs max fee
- **Transaction type**: Legacy, EIP-2930, EIP-1559
- **Data analysis**: Size, method signature
- **Receipt status**: Success/Failed
- **Block timestamps**: Human-readable dates
- **Gas efficiency**: Percentage of gas limit used

### 3. OutputFormatter ([src/utils/OutputFormatter.js](src/utils/OutputFormatter.js))
Flexible output formatting with three styles:
- **Detailed**: Organized by category with headers (default)
- **Compact**: Single-line summaries
- **JSON**: Machine-readable format

Configurable display of:
- Which categories to show (basic, gas, block, data, network, token transfers)
- Which specific fields within each category
- Address/hash formatting (full or shortened)
- Empty field handling

### 4. Enhanced Configuration ([src/config/default.js](src/config/default.js))
New `output` section with complete control over:
- Output style
- Field visibility
- Specific fields per category
- Display formatting options

## All Available Transaction Details

### Basic Information
```
hash, status, from, to, value (ETH), nonce, transaction type
```

### Gas & Fees
```
Gas Limit, Gas Used, Gas Efficiency (%)
Gas Price, Max Fee Per Gas, Priority Fee
Effective Gas Price (actual), Transaction Fee (ETH)
Fee Savings (EIP-1559 savings in ETH and %)
```

### Block Information
```
Block Number, Block Hash, Block Timestamp (ISO)
Transaction Index, Confirmations
```

### Transaction Data
```
Data Size (bytes), Method Signature (function selector)
Has Data, Is Contract Creation, Contract Address (if created)
```

### Network
```
Chain ID, Logs Count
```

### Token Transfers
Automatically detected:
```
ERC20 Transfers (token transfers)
ERC721 Transfers (NFT transfers)
ERC1155 Transfers (multi-token)

For each: Contract, From, To, Value/TokenID
```

## Configuration Examples

### Show Everything (Default)
```javascript
// src/config/default.js
output: {
  style: 'detailed',
  fields: {
    basic: true,
    gas: true,
    block: true,
    data: true,
    network: true,
    tokenTransfers: true
  }
}
```

### Minimal (Fast Performance)
```javascript
output: {
  style: 'compact',
  fields: {
    basic: true,
    gas: false,
    block: false,
    data: false,
    network: false,
    tokenTransfers: false
  }
},
monitor: {
  enrichTransactions: false  // Skip receipts for speed
}
```

### Focus on Gas/Fees (MEV/Arbitrage)
```javascript
output: {
  style: 'detailed',
  fields: {
    basic: true,
    gas: true,
    block: true,
    data: true,
    network: false,
    tokenTransfers: true
  },
  gasFields: ['used', 'efficiency', 'effectiveGasPrice', 'transactionFee', 'feeSavings'],
  dataFields: ['methodSignature']
}
```

### Token Transfer Monitoring
```javascript
output: {
  style: 'detailed',
  fields: {
    basic: true,
    gas: false,
    block: true,
    data: true,
    network: false,
    tokenTransfers: true
  },
  basicFields: ['hash', 'from', 'to', 'status'],
  dataFields: ['methodSignature', 'contractAddress']
}
```

### JSON for External Processing
```javascript
output: {
  style: 'json',
  fields: { /* all true */ }
}
```

## How to Customize

### Option 1: Edit Default Config
Edit [src/config/default.js](src/config/default.js#L40-68) directly.

### Option 2: Create Custom Config
```bash
cp src/config/default.js src/config/custom.js
# Edit src/config/custom.js
# This file is git-ignored and won't be committed
```

### Option 3: Use Environment Variables
Set `RPC_URL`, `LOG_LEVEL`, `DEBUG` via environment.

## Performance Impact

### Transaction Enrichment
When `monitor.enrichTransactions = true`:
- **Pros**: Full details, gas metrics, status, token transfers
- **Cons**: Additional RPC call per transaction (~50-100ms)

When `monitor.enrichTransactions = false`:
- **Pros**: Faster processing, no extra RPC calls
- **Cons**: Missing receipt data (gas used, status, token transfers)

### Output Style
- **detailed**: Most readable, larger output
- **compact**: Fast, minimal output, good for high volume
- **json**: Best for piping to other tools or logging systems

## Example Output

### Detailed Style
```
================================================================================
TRANSACTION: CONFIRMED
================================================================================

📋 BASIC INFORMATION
--------------------------------------------------------------------------------
hash        : 0x1234567890abcdef...
status      : Success
from        : 0xabcdef123456...
to          : 0x987654fedcba...
value       : 1.5 ETH
nonce       : 42
type        : EIP-1559 (Dynamic Fee)

⛽ GAS INFORMATION
--------------------------------------------------------------------------------
limit       : 21000
used        : 21000
efficiency  : 100%
transactionFee: 0.00084 ETH
effectiveGasPrice: 40 Gwei
feeSavings  : { eth: '0.00021 ETH', percent: '20%' }

🔗 BLOCK INFORMATION
--------------------------------------------------------------------------------
number      : 12345678
timestamp   : 2024-01-15T10:30:45.000Z
transactionIndex: 5
confirmations: 3

📊 DATA INFORMATION
--------------------------------------------------------------------------------
size        : 0 bytes
methodSignature: N/A

🌐 NETWORK INFORMATION
--------------------------------------------------------------------------------
chainId     : 137
logsCount   : 0

================================================================================
```

### Compact Style
```
✅ 0x1234...5678 | 0xabcd...efgh → 0x9876...dcba | 1.5 ETH | Block: 12345678 | Fee: 0.00084 ETH
```

### JSON Style
```json
{
  "transaction": {
    "hash": "0x1234567890abcdef...",
    "from": "0xabcdef123456...",
    "success": true,
    "transactionFeeEth": "0.00084",
    ...
  },
  "details": { ... },
  "tokenTransfers": []
}
```

## Use Cases for Arbitrage

### Detect High-Value Transfers
```javascript
if (parsedTx.valueEth > 100) {
  // Large ETH transfer
}
```

### Monitor Specific DEX Methods
```javascript
if (parsedTx.methodSignature === '0x38ed1739') {
  // Uniswap V2 swapExactTokensForTokens
}
```

### Track Gas Prices for Timing
```javascript
if (parsedTx.effectiveGasPrice < threshold) {
  // Low gas period, good for submitting transactions
}
```

### Detect Token Transfers
```javascript
if (tokenTransfers.length > 0) {
  // Process token transfers
  tokenTransfers.forEach(t => {
    if (t.type === 'ERC20/ERC721') {
      // Handle token transfer
    }
  });
}
```

### Monitor Mempool for Frontrunning
```javascript
_handlePending(parsedTx) {
  if (parsedTx.methodSignature === '0xa9059cbb') { // ERC20 transfer
    // Check if this is a profitable opportunity
    if (parsedTx.maxFeePerGas > threshold) {
      // They're paying high gas, might be time-sensitive
    }
  }
}
```

## Documentation

- [OUTPUT_CONFIGURATION.md](OUTPUT_CONFIGURATION.md) - Detailed configuration guide
- [USAGE.md](USAGE.md) - General usage guide
- [README.md](README.md) - Project overview

## Architecture

The system now follows a clean pipeline:

```
Transaction → Enricher → Parser → Formatter → Display
              (receipts)  (analyze) (configure)  (output)
```

Each component is independent and can be customized or replaced.
