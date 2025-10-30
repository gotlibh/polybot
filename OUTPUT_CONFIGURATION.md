# Output Configuration Guide

This guide explains how to configure what transaction details are displayed by PolyBot.

## Quick Start

Edit [src/config/default.js](src/config/default.js) or create [src/config/custom.js](src/config/custom.js) to customize output:

```javascript
export default {
  output: {
    style: 'detailed',  // 'detailed', 'compact', or 'json'

    fields: {
      basic: true,           // Show basic info
      gas: true,             // Show gas details
      block: true,           // Show block info
      data: true,            // Show transaction data
      network: true,         // Show network info
      tokenTransfers: true   // Show token transfers
    }
  }
}
```

## Output Styles

### Detailed (Default)
Shows comprehensive transaction information organized by category with headers:

```
================================================================================
TRANSACTION: CONFIRMED
================================================================================

📋 BASIC INFORMATION
--------------------------------------------------------------------------------
hash        : 0x1234...
status      : Success
from        : 0xabcd...
to          : 0xefgh...
value       : 1.5 ETH
...
```

### Compact
Single-line summary per transaction:
```
✅ 0x1234...5678 | 0xabcd...efgh → 0x1234...5678 | 1.5 ETH | [0xa9059cbb] | Block: 12345 | Fee: 0.002 ETH
```

### JSON
Full JSON output for programmatic processing:
```json
{
  "transaction": { ... },
  "details": { ... },
  "tokenTransfers": [ ... ]
}
```

## Field Categories

### Basic Information (`fields.basic`)
- **hash**: Transaction hash
- **status**: Pending / Success / Failed
- **from**: Sender address
- **to**: Recipient address
- **value**: ETH value transferred
- **nonce**: Transaction nonce
- **type**: Transaction type (Legacy, EIP-1559, etc.)

**Configure specific fields:**
```javascript
basicFields: ['hash', 'status', 'from', 'to', 'value']
```

### Gas Information (`fields.gas`)
- **limit**: Gas limit
- **used**: Actual gas used (confirmed tx only)
- **efficiency**: Gas used / gas limit percentage
- **gasPrice**: Gas price (Legacy transactions)
- **maxFeePerGas**: Max fee per gas (EIP-1559)
- **maxPriorityFeePerGas**: Priority fee (EIP-1559)
- **effectiveGasPrice**: Actual gas price paid
- **transactionFee**: Total fee in ETH
- **feeSavings**: Fee savings from EIP-1559 (if applicable)

**Configure specific fields:**
```javascript
gasFields: ['used', 'transactionFee', 'effectiveGasPrice', 'feeSavings']
```

### Block Information (`fields.block`)
- **number**: Block number
- **hash**: Block hash
- **timestamp**: Block timestamp (ISO format)
- **transactionIndex**: Transaction index in block
- **confirmations**: Number of confirmations

**Configure specific fields:**
```javascript
blockFields: ['number', 'timestamp', 'confirmations']
```

### Data Information (`fields.data`)
- **size**: Transaction data size in bytes
- **methodSignature**: Function selector (first 4 bytes)
- **hasData**: Whether transaction contains data
- **isContractCreation**: Whether this creates a contract
- **contractAddress**: Address of created contract (if applicable)

**Configure specific fields:**
```javascript
dataFields: ['size', 'methodSignature', 'contractAddress']
```

### Network Information (`fields.network`)
- **chainId**: Network chain ID
- **logsCount**: Number of logs emitted

**Configure specific fields:**
```javascript
networkFields: ['chainId', 'logsCount']
```

### Token Transfers (`fields.tokenTransfers`)
Automatically detects and displays:
- **ERC20 transfers**: Token transfers
- **ERC721 transfers**: NFT transfers
- **ERC1155 transfers**: Multi-token transfers

Shows contract address, from, to, and value for each transfer.

## Configuration Examples

### Minimal Output (Only Essentials)
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
}
```

### Gas-Focused (For MEV/Arbitrage)
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
  dataFields: ['methodSignature'],
  showEmptyFields: false
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
  dataFields: ['methodSignature']
}
```

### Debug Mode (Everything)
```javascript
output: {
  style: 'detailed',
  fields: {
    basic: true,
    gas: true,
    block: true,
    data: true,
    network: true,
    tokenTransfers: true
  },
  showEmptyFields: true  // Show N/A fields
}
```

### JSON Export for Analysis
```javascript
output: {
  style: 'json',
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

## Formatting Options

### Address/Hash Display
Control how addresses and hashes are displayed:

```javascript
output: {
  maxHashLength: 20,      // Shorten: 0x1234...5678
  maxAddressLength: 10    // Shorten: 0x12...5678
}
```

Full display (default):
```javascript
output: {
  maxHashLength: 66,      // Full hash
  maxAddressLength: 42    // Full address
}
```

### Empty Fields
Choose whether to show fields with no data:

```javascript
output: {
  showEmptyFields: false  // Hide N/A fields (default)
}
```

## Transaction Enrichment

Control whether to fetch detailed receipt data (requires additional RPC calls):

```javascript
monitor: {
  enrichTransactions: true  // Fetch receipts (default: true)
}
```

**When disabled:**
- No gas used / transaction fee (only estimates)
- No transaction status (success/failed)
- No logs or token transfers
- Faster processing, fewer RPC calls

**When enabled:**
- Full gas and fee details
- Transaction success/failure status
- Token transfer detection
- Contract creation address
- Complete transaction logs

## Performance Considerations

### High Transaction Volume
```javascript
output: {
  style: 'compact',  // Minimal output
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

### Detailed Analysis
```javascript
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
},
monitor: {
  enrichTransactions: true  // Full details
}
```

## Runtime Configuration

You can also change output formatting at runtime by modifying the formatter:

```javascript
// In your code (e.g., in index.js)
bot.formatter.updateConfig({
  style: 'compact',
  fields: { gas: false }
});
```

## Method Signatures Reference

Common method signatures you might see:

- `0xa9059cbb` - ERC20 `transfer(address,uint256)`
- `0x23b872dd` - ERC20 `transferFrom(address,address,uint256)`
- `0x095ea7b3` - ERC20 `approve(address,uint256)`
- `0x` (empty) - Simple ETH transfer
- Others - Contract interactions

You can use these in your arbitrage logic to identify specific transaction types.
