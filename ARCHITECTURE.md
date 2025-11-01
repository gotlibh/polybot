# PolyBot Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PolyBot Application                              │
│                          (src/index.js)                                  │
└──────────────────────────┬──────────────────────────────────────────────┘
                           │
           ┌───────────────┴───────────────────────┐
           │                                       │
           ▼                                       ▼
  ┌────────────────┐                    ┌──────────────────┐
  │  RpcProvider   │                    │  AddressMapper   │
  │  (WebSocket)   │                    │ (Name Resolution)│
  └────────┬───────┘                    └──────────────────┘
           │
           ├──────────────┬──────────────────┐
           │              │                  │
           ▼              ▼                  ▼
  ┌──────────────┐ ┌─────────────┐  ┌──────────────┐
  │Transaction   │ │DexPrice     │  │Output        │
  │Monitor       │ │Monitor      │  │Formatters    │
  │              │ │             │  │              │
  └──────┬───────┘ └──────┬──────┘  └──────────────┘
         │                │
         │                └──> Periodic Price Queries
         │
    ┌────┴──────┐
    │           │
    ▼           ▼
Mempool     Confirmed
(Pending)   (Blocks)
    │           │
    │           ▼
    │    ┌──────────────┐
    │    │Transaction   │
    │    │Enricher      │
    │    │(Receipts)    │
    │    └──────┬───────┘
    │           │
    └─────┬─────┘
          │
          ▼
    ┌─────────────┐
    │Transaction  │
    │Parser       │
    │+ Address    │
    │  Mapping    │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │Transaction  │
    │Filter       │
    │(2-Stage)    │
    └──────┬──────┘
           │
           ▼
    ┌─────────────┐
    │Output       │
    │Formatter    │
    └──────┬──────┘
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
- **Early filtering optimization** - filter before enrichment
- Orchestrate enrichment and parsing
- Event handling and callbacks

**Key Methods**:
- `start()` - Begin monitoring
- `stop()` - Stop monitoring
- `updateFilter(config)` - Update filters dynamically
- `getStats()` - Get monitoring statistics

**Performance Features**:
- Two-stage filtering (early + post-parse)
- Skips expensive receipt fetching for filtered transactions
- Can reduce RPC calls by 95%+ when using address filters

#### DexPriceMonitor (`src/services/DexPriceMonitor.js`)
**Purpose**: Monitor DEX prices across multiple exchanges
- Periodic price queries from DEX routers
- Supports Uniswap V2 compatible DEXes (QuickSwap, SushiSwap, etc.)
- Get reserves, prices, and trading amounts
- Arbitrage opportunity detection
- Graceful handling of low-liquidity pairs

**Key Methods**:
- `start()` - Begin price monitoring
- `stop()` - Stop price monitoring
- `queryPrices()` - Query all configured pairs
- `queryPairPrice(dexName, pair)` - Query specific pair
- `getCachedPrice()` - Get last cached price
- `getStats()` - Get monitoring statistics

**Key Features**:
- `getAmountsOut()` - Calculate output amount for input
- `getAmountsIn()` - Calculate input amount for output
- `getReserves()` - Get liquidity pool reserves
- `getPair()` - Get pair contract address
- Automatic token info fetching (symbols, decimals)
- Dynamic amount adjustment for low liquidity
- Fallback to reserve-based pricing on errors
- Price caching for performance

**Error Handling**:
- Handles "ds-math-sub-underflow" errors gracefully
- Adjusts trade amounts to 1% of reserves for low liquidity
- Falls back to reserve-based price calculation
- Skips pairs with zero liquidity

### Parsers Layer

#### TransactionParser (`src/parsers/TransactionParser.js`)
**Purpose**: Parse and analyze transaction data with address mapping
- Parse raw transaction into structured format
- **Map addresses to human-readable names**
- Calculate gas metrics and efficiency
- Compute fee savings (EIP-1559)
- Extract method signatures
- Create human-readable summaries

**Key Methods**:
- `parse(rawTx)` - Parse transaction (includes address name resolution)
- `getDetailedInfo(parsedTx)` - Get organized details with formatted addresses
- `createSummary(parsedTx)` - Create summary
- `extractMethodSignature(data)` - Get function selector

**Address Mapping**:
- Adds `fromName` and `toName` fields to parsed transactions
- Displays addresses as "Name (0x1234...5678)"
- Supports custom address groups and tags

### Filters Layer

#### TransactionFilter (`src/filters/TransactionFilter.js`)
**Purpose**: Filter transactions based on criteria with two-stage optimization
- Filter by addresses (from/to)
- Filter by value range
- **Performance-optimized with two-stage filtering**
- Statistics tracking

**Key Methods**:
- `shouldFetch(rawTx)` - **Early filter** check before enrichment (optimized)
- `shouldProcess(tx)` - **Full filter** check on parsed transaction
- `updateConfig(config)` - Update filter configuration
- `getStats()` - Get filter statistics

**Two-Stage Filtering**:
1. **Early Stage** (`shouldFetch`): Filters before enrichment using basic tx data
   - Checks addresses and value ranges
   - No RPC calls required
   - Prevents expensive receipt fetching
2. **Full Stage** (`shouldProcess`): Validates parsed transaction
   - Double-checks after parsing
   - Defense in depth approach
   - Tracks statistics

### Utils Layer

#### AddressMapper (`src/utils/AddressMapper.js`)
**Purpose**: Map blockchain addresses to human-readable names
- Load address configurations from files
- Resolve address groups (e.g., '@myAddresses', '@allDexes')
- Format addresses with names for display
- Support for tags and descriptions

**Key Methods**:
- `getName(address)` - Get name for address
- `getInfo(address)` - Get full info (name, tags, description)
- `format(address, options)` - Format address with name
- `resolveAddresses(list)` - Resolve groups to addresses (e.g., '@allDexes' → addresses)
- `findByTag(tag)` - Find addresses by tag
- `getGroup(groupName)` - Get all addresses in a group

**Configuration**:
- `src/config/addresses.js` - Default address mappings
- `src/config/addresses.custom.js` - Optional custom mappings

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
- Address/hash formatting with names

**Key Methods**:
- `format(parsedTx, detailedInfo, tokenTransfers)` - Format output
- `updateConfig(config)` - Update formatting configuration

#### PriceFormatter (`src/utils/PriceFormatter.js`)
**Purpose**: Format DEX price data for display
- Table view: Compact comparison across DEXes
- Detailed view: Full information with reserves
- Arbitrage opportunity highlighting
- Price spread calculation

**Key Methods**:
- `format(priceData)` - Format price data array
- `updateConfig(config)` - Update formatting configuration

### ABI Layer

#### DexRouter ABIs (`src/abi/DexRouter.js`)
**Purpose**: Contract ABI definitions for DEX interactions
- Uniswap V2 Router ABI (getAmountsOut, getAmountsIn, etc.)
- Uniswap V2 Factory ABI (getPair)
- Uniswap V2 Pair ABI (getReserves, token0, token1)
- ERC20 ABI (symbol, decimals, balanceOf)

## Data Flow

### Confirmed Transaction Flow

```
1. New Block Event
   ↓
2. Fetch Block with Transactions
   ↓
3. For Each Transaction:
   ↓
4. Early Filter (Check addresses/value - fast, no RPC calls)
   ↓ (Only matching transactions proceed)
5. Enrich (Fetch Receipt + Block Data - only for matching txs)
   ↓
6. Parse (Extract all details + resolve address names)
   ↓
7. Full Filter (Check parsed data - validation)
   ↓
8. Format (Apply output configuration with address names)
   ↓
9. Display (Console output)
```

**Performance Optimization**: The early filter (step 4) checks address and value filters using basic transaction data before the expensive receipt fetch (step 5). This can save hundreds of RPC calls per block when address filters are configured, potentially reducing RPC calls by 95%+.

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

### DEX Price Monitoring Flow

```
1. Timer Event (every X seconds)
   ↓
2. For Each DEX Router:
   ↓
3. For Each Trading Pair:
   ↓
4. Get Factory Address from Router
   ↓
5. Query getPair(tokenIn, tokenOut)
   ↓
6. Check if Pair Exists
   ↓
7. Get Reserves from Pair Contract
   ↓
8. Calculate Safe Base Amount (1% of reserves)
   ↓
9. Try getAmountsOut(baseAmount, [tokenIn, tokenOut])
   ↓
10a. Success: Calculate price from amounts
10b. Failure: Calculate price from reserves directly
   ↓
11. Try getAmountsIn(baseAmount, [tokenIn, tokenOut])
   ↓
12. Fetch Token Info (symbols, decimals)
   ↓
13. Cache Price Data
   ↓
14. Format Prices (with arbitrage detection)
   ↓
15. Display (Console output)
```

**Error Handling**:
- Handles "ds-math-sub-underflow" by reducing trade amounts
- Falls back to reserve-based pricing
- Skips pairs with zero liquidity
- Continues to next pair on errors

## Configuration Flow

```
1. Load default.js
   ↓
2. Try to load custom.js (if exists)
   ↓
3. Load addresses.js
   ↓
4. Try to load addresses.custom.js (if exists)
   ↓
5. Merge all configurations
   ↓
6. Initialize AddressMapper with merged address config
   ↓
7. Resolve address groups in filter config (e.g., '@allDexes')
   ↓
8. Initialize components with resolved config
   ↓
9. Start monitoring (transactions + prices if enabled)
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

### Add Custom Address Mappings
Create `src/config/addresses.custom.js`:
```javascript
export default {
  addresses: {
    '0x123...': {
      name: 'My Contract',
      tags: ['personal', 'defi'],
      description: 'My custom DeFi contract'
    }
  },
  groups: {
    myContracts: ['0x123...', '0x456...']
  }
};
```

### Add Custom Filters with Address Groups
Edit `src/config/default.js`:
```javascript
filter: {
  addresses: ['@myAddresses', '@allDexes'],  // Use groups
  // or
  fromAddresses: ['@myAddresses'],
  toAddresses: ['@quickswap'],
  minValue: '1000000000000000000'
}
```

### Add Custom Trading Pairs for Price Monitoring
Edit `src/config/default.js`:
```javascript
dexPrices: {
  enabled: true,
  interval: 30000,
  tradingPairs: [
    {
      name: 'CUSTOM/USDC',
      tokenIn: '0x...',
      tokenOut: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      tokenInSymbol: 'CUSTOM',
      tokenOutSymbol: 'USDC',
      tokenInDecimals: 18,
      tokenOutDecimals: 6
    }
  ]
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
- **Enable address filtering** (leverages early filter optimization)
- Use address groups to monitor specific categories
- Increase `maxReconnectAttempts`
- Disable DEX price monitoring or increase interval

**Example Configuration**:
```javascript
monitor: {
  monitorPending: false,
  monitorConfirmed: true,
  enrichTransactions: false
},
filter: {
  addresses: ['@myAddresses']  // Only monitor your wallets
},
output: {
  style: 'compact'
}
```

### Detailed Analysis
- Use `detailed` output style
- Enable `enrichTransactions`
- Monitor specific addresses only
- Use token transfer detection
- Enable DEX price monitoring for market context

**Example Configuration**:
```javascript
monitor: {
  enrichTransactions: true
},
filter: {
  addresses: ['@myAddresses', '@quickswap']
},
output: {
  style: 'detailed',
  fields: {
    tokenTransfers: true,
    decodedData: true
  }
},
dexPrices: {
  enabled: true,
  interval: 60000
}
```

### DEX Price Monitoring Performance
- Reduce `tradingPairs` array to only needed pairs
- Increase `interval` for less frequent queries
- Use lower `baseAmount` for faster queries
- Monitor fewer DEX routers

**Optimization Tips**:
- Each pair query makes ~3-5 RPC calls
- With 3 pairs × 3 DEXes = 27-45 RPC calls per interval
- Interval of 30s = ~1,000 RPC calls per hour
- Consider API rate limits when configuring

### Memory Management
- Receipt cache limited to 1000 entries
- Price cache stores last result per pair/DEX
- Automatic cache cleanup
- No historical data stored (real-time only)
- Address mapper loaded once at startup

## Error Handling

Each layer handles errors independently:
- **RpcProvider**: Connection errors → reconnection logic
- **TransactionMonitor**: Processing errors → error handler callback
- **DexPriceMonitor**:
  - "ds-math-sub-underflow" → adjust amounts, fallback to reserves
  - Pair not found → skip pair
  - Token info fetch failed → use config defaults
  - Query failed → continue to next pair
- **TransactionEnricher**: Receipt fetch errors → return original transaction
- **TransactionParser**: Parsing errors → return null, log error
- **TransactionFilter**: Always succeeds (safe defaults)
- **AddressMapper**: Missing addresses → return raw address

## Key Features Summary

### ✅ Transaction Monitoring
- Real-time transaction monitoring (mempool + confirmed)
- Transaction enrichment with receipts
- Token transfer detection (ERC20/721/1155)
- Gas analysis and fee calculations
- Method signature extraction

### ✅ Performance Optimizations
- **Two-stage filtering** (95%+ RPC call reduction)
- Early filtering before enrichment
- Receipt caching
- Address group resolution at startup
- Price data caching

### ✅ Address Management
- Human-readable address names
- Address groups and tags
- Group references in filters (e.g., '@allDexes')
- Custom address mappings
- Name resolution in output

### ✅ DEX Price Monitoring
- Multi-DEX price comparison
- Reserves and liquidity tracking
- `getAmountsOut` / `getAmountsIn` / `getReserves` / `getPair`
- Arbitrage opportunity detection
- Graceful low-liquidity handling
- Automatic token info fetching
- Price caching and statistics

### ✅ Flexible Output
- Multiple output styles (detailed, compact, JSON)
- Configurable field visibility
- Address names in output
- Price comparison tables
- Token transfer formatting

## Configuration Files

### Main Configuration
- `src/config/default.js` - Default settings
- `src/config/custom.js` - Optional custom overrides

### Address Configuration
- `src/config/addresses.js` - Default address mappings
- `src/config/addresses.custom.js` - Optional custom mappings

### Configuration Sections
1. **RPC**: WebSocket connection settings
2. **Monitor**: Transaction monitoring options
3. **Filter**: Address and value filters (supports groups)
4. **Output**: Display formatting options
5. **DexPrices**: DEX price monitoring configuration
6. **Logging**: Log levels and debug settings

## Future Enhancements

Potential additions:
- ✅ ~~Price feeds (USD values)~~ → **Implemented via DEX prices**
- Database integration for historical analysis
- Contract ABI decoding (full method names, parameters)
- Alert system (email, Telegram, webhook)
- Multi-chain support
- Transaction simulation
- Gas price prediction
- MEV detection algorithms
- Flashbot integration
- GraphQL API for querying data
- Web dashboard for visualization
- Liquidity pool analytics
- Advanced arbitrage detection
- Historical price tracking
- Profit/loss calculations
