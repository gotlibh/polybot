# PolyBot Usage Guide

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure your RPC endpoint**

   Edit [src/config/default.js](src/config/default.js) or create a custom config:

   ```bash
   cp src/config/default.js src/config/custom.js
   # Edit src/config/custom.js with your settings
   ```

3. **Run the bot**
   ```bash
   npm start
   ```

## Configuration

### RPC Provider

Configure your WebSocket RPC connection in [src/config/default.js](src/config/default.js):

```javascript
rpc: {
  url: 'ws://192.168.1.10:8546',  // Your RPC WebSocket URL
  reconnect: true,
  reconnectDelay: 5000,
  maxReconnectAttempts: 10
}
```

### Transaction Monitoring

Control what transactions to monitor:

```javascript
monitor: {
  monitorPending: true,      // Monitor mempool transactions
  monitorConfirmed: true,    // Monitor confirmed transactions
}
```

### Transaction Filtering

Filter transactions by address or value:

```javascript
filter: {
  // Monitor transactions from/to specific addresses
  addresses: ['0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb'],

  // Or filter by direction
  fromAddresses: ['0x...'],  // Only FROM these addresses
  toAddresses: ['0x...'],    // Only TO these addresses

  // Filter by value (in wei)
  minValue: '1000000000000000000',  // 1 ETH minimum
  maxValue: null
}
```

## Architecture

The project follows a clean, modular architecture:

```
polybot/
├── src/
│   ├── core/              # Core components
│   │   └── RpcProvider.js # WebSocket RPC connection management
│   ├── services/          # Business logic
│   │   └── TransactionMonitor.js # Transaction monitoring service
│   ├── filters/           # Transaction filters
│   │   └── TransactionFilter.js
│   ├── parsers/           # Data parsers
│   │   └── TransactionParser.js
│   ├── utils/             # Utilities
│   │   └── logger.js      # Logging utility
│   ├── config/            # Configuration
│   │   ├── default.js     # Default configuration
│   │   └── custom.js      # Custom config (git-ignored)
│   └── index.js           # Application entry point
├── package.json
└── README.md
```

## Key Classes

### RpcProvider ([src/core/RpcProvider.js](src/core/RpcProvider.js))
- Manages WebSocket connection to blockchain RPC
- Handles automatic reconnection
- Connection state management

### TransactionMonitor ([src/services/TransactionMonitor.js](src/services/TransactionMonitor.js))
- Subscribes to pending transactions (mempool)
- Subscribes to confirmed blocks and transactions
- Orchestrates filtering and parsing
- Provides statistics and monitoring

### TransactionFilter ([src/filters/TransactionFilter.js](src/filters/TransactionFilter.js))
- High-performance transaction filtering
- Filter by addresses (from/to)
- Filter by value range
- Statistics tracking

### TransactionParser ([src/parsers/TransactionParser.js](src/parsers/TransactionParser.js))
- Parses raw transaction data
- Formats values and gas information
- Creates human-readable summaries
- Method signature extraction

## Custom Transaction Handlers

You can customize how transactions are processed by modifying the handlers in [src/index.js](src/index.js):

```javascript
// Handle confirmed transactions
_handleTransaction(parsedTx) {
  // Your custom logic here
  // Example: Check for arbitrage opportunities
}

// Handle mempool transactions
_handlePending(parsedTx) {
  // Your custom logic here
  // Example: Frontrunning detection
}
```

## Performance Considerations

The bot is designed for high performance:

- **Efficient filtering**: Early returns prevent unnecessary processing
- **Minimal parsing overhead**: Only parse what's needed
- **Connection resilience**: Automatic reconnection with exponential backoff
- **Error isolation**: Errors in one transaction don't affect others
- **Statistics tracking**: Monitor performance in real-time

## Monitoring Statistics

The bot logs statistics every minute:

```
Monitor Statistics {
  pendingCount: 1523,
  confirmedCount: 245,
  errorCount: 2,
  filterStats: {
    total: 1768,
    passed: 127,
    filtered: 1641,
    filterRate: '92.82%'
  },
  runtime: '180.45s'
}
```

## Next Steps

This foundation is ready for:
- Arbitrage detection algorithms
- MEV (Maximal Extractable Value) monitoring
- Flash loan opportunity detection
- Price oracle tracking
- Custom transaction strategies
- Database integration for historical analysis
- Alert systems (email, Telegram, etc.)
- Performance optimization with caching
- Multi-chain support

## Questions or Issues?

Feel free to ask for help or report issues!
