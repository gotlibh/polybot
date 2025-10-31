# PolyBot Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PolyBot Application                      │
│                          (src/index.js)                          │
└──────────────────────────┬──────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────┐
           │                               │
           ▼                               ▼
  ┌────────────────┐              ┌──────────────────┐
  │  RpcProvider   │              │ OutputFormatter  │
  │  (WebSocket)   │              │  (Configurable)  │
  └────────┬───────┘              └──────────────────┘
           │
           ▼
  ┌────────────────────┐
  │ TransactionMonitor │
  │   (Subscriptions)  │
  └─────────┬──────────┘
            │
    ┌───────┴────────┐
    │                │
    ▼                ▼
Mempool         Confirmed
(Pending)       (Blocks)
    │                │
    │                ▼
    │       ┌─────────────────┐
    │       │ TransactionEnricher│
    │       │  (Fetch Receipts)  │
    │       └────────┬───────────┘
    │                │
    └────────┬───────┘
             │
             ▼
    ┌────────────────────┐
    │ TransactionParser  │
    │  (Parse & Analyze) │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │ TransactionFilter  │
    │   (Apply Filters)  │
    └─────────┬──────────┘
              │
              ▼
    ┌────────────────────┐
    │  OutputFormatter   │
    │  (Format Display)  │
    └─────────┬──────────┘
              │
              ▼
         Console Output
```

## Component Details

### Core Layer

#### RpcProvider (`src/core/RpcProvider.js`)
**Purpose**: Manage WebSocket connection to blockchain RPC
- Establishes and maintains WebSocket connection
- Automatic reconnection with exponential backoff
- Connection state management
- Error handling

**Key Methods**:
- `connect()` - Initialize connection
- `getProvider()` - Get ethers.js provider instance
- `disconnect()` - Clean shutdown

#### TransactionEnricher (`src/core/TransactionEnricher.js`)
**Purpose**: Enrich transactions with additional blockchain data
- Fetch transaction receipts (for confirmed transactions)
- Extract token transfers from logs (ERC20/721/1155)
- Add block timestamps
- Cache receipts for performance

**Key Methods**:
- `enrichTransaction(tx)` - Add receipt and block data
- `extractTokenTransfers(logs)` - Parse token transfer events
- `getReceipt(txHash)` - Fetch receipt with caching

### Services Layer

#### TransactionMonitor (`src/services/TransactionMonitor.js`)
**Purpose**: Monitor blockchain for transactions
- Subscribe to pending transactions (mempool)
- Subscribe to confirmed blocks
- Orchestrate enrichment and parsing
- Event handling and callbacks

**Key Methods**:
- `start()` - Begin monitoring
- `stop()` - Stop monitoring
- `updateFilter(config)` - Update filters dynamically
- `getStats()` - Get monitoring statistics

### Parsers Layer

#### TransactionParser (`src/parsers/TransactionParser.js`)
**Purpose**: Parse and analyze transaction data
- Parse raw transaction into structured format
- Calculate gas metrics and efficiency
- Compute fee savings (EIP-1559)
- Extract method signatures
- Create human-readable summaries

**Key Methods**:
- `parse(rawTx)` - Parse transaction
- `getDetailedInfo(parsedTx)` - Get organized details
- `createSummary(parsedTx)` - Create summary
- `extractMethodSignature(data)` - Get function selector

### Filters Layer

#### TransactionFilter (`src/filters/TransactionFilter.js`)
**Purpose**: Filter transactions based on criteria
- Filter by addresses (from/to)
- Filter by value range
- Performance-optimized with two-stage filtering
- Statistics tracking

**Key Methods**:
- `shouldFetch(rawTx)` - Early filter check before enrichment (optimized)
- `shouldProcess(tx)` - Full filter check on parsed transaction
- `updateConfig(config)` - Update filter configuration
- `getStats()` - Get filter statistics

### Utils Layer

#### Logger (`src/utils/logger.js`)
**Purpose**: Logging utility
- Timestamped log messages
- Multiple log levels (info, warn, error, debug)
- Contextual logging

#### OutputFormatter (`src/utils/OutputFormatter.js`)
**Purpose**: Format transaction output
- Multiple output styles (detailed, compact, JSON)
- Configurable field visibility
- Category-based organization
- Address/hash formatting

**Key Methods**:
- `format(parsedTx, detailedInfo, tokenTransfers)` - Format output
- `updateConfig(config)` - Update formatting configuration

## Data Flow

### Confirmed Transaction Flow

```
1. New Block Event
   ↓
2. Fetch Block with Transactions
   ↓
3. For Each Transaction:
   ↓
4. Early Filter (Check addresses/value - fast)
   ↓
5. Enrich (Fetch Receipt + Block Data - only for matching txs)
   ↓
6. Parse (Extract all details)
   ↓
7. Full Filter (Check parsed data - validation)
   ↓
8. Format (Apply output configuration)
   ↓
9. Display (Console output)
```

**Performance Optimization**: The early filter (step 4) checks address and value filters using basic transaction data before the expensive receipt fetch (step 5). This can save hundreds of RPC calls per block when address filters are configured.

### Pending Transaction Flow

```
1. Pending Transaction Event
   ↓
2. Fetch Transaction Details
   ↓
3. Parse (Basic details only, no receipt)
   ↓
4. Filter (Check if should process)
   ↓
5. Format (Apply output configuration)
   ↓
6. Display (Console output)
```

## Configuration Flow

```
1. Load default.js
   ↓
2. Try to load custom.js (if exists)
   ↓
3. Merge configurations
   ↓
4. Initialize components with config
   ↓
5. Start monitoring
```

## Extension Points

### Add Custom Transaction Analysis
Edit `src/index.js`:
```javascript
_handleTransaction(parsedTx, tokenTransfers) {
  // Your custom logic here
  if (parsedTx.methodSignature === '0xa9059cbb') {
    // Handle ERC20 transfer
  }
}
```

### Add Custom Filters
Edit `src/config/default.js`:
```javascript
filter: {
  addresses: ['0x...'],
  minValue: '1000000000000000000'
}
```

### Add Custom Output Format
Extend `src/utils/OutputFormatter.js`:
```javascript
_formatCustom(parsedTx, detailedInfo) {
  // Your custom formatting
}
```

### Add New Data Sources
Create new enricher or extend `TransactionEnricher`:
```javascript
// Fetch price data, historical data, etc.
```

## Performance Considerations

### High Transaction Volume
- Use `compact` output style
- Disable `enrichTransactions` (skip receipts)
- Enable address filtering (leverages early filter optimization)
- Increase `maxReconnectAttempts`

### Detailed Analysis
- Use `detailed` output style
- Enable `enrichTransactions`
- Monitor specific addresses only
- Use token transfer detection

### Memory Management
- Receipt cache limited to 1000 entries
- Automatic cache cleanup
- No historical data stored (real-time only)

## Error Handling

Each layer handles errors independently:
- **RpcProvider**: Connection errors → reconnection logic
- **TransactionMonitor**: Processing errors → error handler callback
- **TransactionEnricher**: Receipt fetch errors → return original transaction
- **TransactionParser**: Parsing errors → return null, log error
- **TransactionFilter**: Always succeeds (safe defaults)

## Future Enhancements

Potential additions:
- Database integration for historical analysis
- Price feeds (USD values)
- Contract ABI decoding (method names, parameters)
- Alert system (email, Telegram, webhook)
- Multi-chain support
- Transaction simulation
- Gas price prediction
- MEV detection algorithms
- Flashbot integration
