import RpcProvider from "./core/RpcProvider.js";
import TransactionMonitor from "./services/TransactionMonitor.js";
import Logger from "./utils/logger.js";
import OutputFormatter from "./utils/OutputFormatter.js";
import config from "./config/default.js";

// Try to load custom config if it exists
let customConfig = {};
try {
  const customConfigModule = await import("./config/custom.js");
  customConfig = customConfigModule.default;
} catch (error) {
  // Custom config doesn't exist, use defaults
}

// Merge configurations
const finalConfig = {
  ...config,
  ...customConfig,
  rpc: { ...config.rpc, ...(customConfig.rpc || {}) },
  monitor: { ...config.monitor, ...(customConfig.monitor || {}) },
  filter: { ...config.filter, ...(customConfig.filter || {}) },
};

const logger = new Logger("Main");

/**
 * Main application class
 */
class PolyBot {
  constructor(config) {
    this.config = config;
    this.rpcProvider = null;
    this.monitor = null;
    this.formatter = new OutputFormatter(config.output || {});
    this.isRunning = false;
  }

  /**
   * Initialize and start the bot
   */
  async start() {
    try {
      logger.info("=== Starting PolyBot ===");
      logger.info("Configuration", {
        rpcUrl: this.config.rpc.url,
        monitorPending: this.config.monitor.monitorPending,
        monitorConfirmed: this.config.monitor.monitorConfirmed,
      });

      // Initialize RPC provider
      this.rpcProvider = new RpcProvider(this.config.rpc.url, this.config.rpc);
      await this.rpcProvider.connect();

      const provider = this.rpcProvider.getProvider();

      // Get network info
      const network = await provider.getNetwork();
      logger.info("Connected to network", {
        chainId: network.chainId.toString(),
        name: network.name,
      });

      // Initialize transaction monitor with custom handlers
      this.monitor = new TransactionMonitor(provider, {
        ...this.config.monitor,
        filterConfig: this.config.filter,
        onTransaction: this._handleTransaction.bind(this),
        onPending: this._handlePending.bind(this),
        onError: this._handleError.bind(this),
      });

      // Start monitoring
      await this.monitor.start();

      this.isRunning = true;

      // Log stats periodically
      this._startStatsReporting();

      logger.info("=== PolyBot started successfully ===");
    } catch (error) {
      logger.error("Failed to start PolyBot", error);
      await this.stop();
      process.exit(1);
    }
  }

  /**
   * Handle confirmed transactions
   */
  _handleTransaction(parsedTx, tokenTransfers = []) {
    // Get detailed transaction information
    const detailedInfo = this.monitor.parser.getDetailedInfo(parsedTx);

    // Format and display using configured formatter
    const output = this.formatter.format(parsedTx, detailedInfo, tokenTransfers);
    console.log(output);

    // Future: Add custom logic for arbitrage detection, etc.
    // You can access all the parsed data in parsedTx and detailedInfo
    // Example: if (parsedTx.methodSignature === '0xa9059cbb') { /* ERC20 transfer */ }
  }

  /**
   * Handle pending transactions (mempool)
   */
  _handlePending(parsedTx) {
    // Get detailed transaction information
    const detailedInfo = this.monitor.parser.getDetailedInfo(parsedTx);

    // Format and display using configured formatter
    const output = this.formatter.format(parsedTx, detailedInfo, []);
    console.log(output);

    // Future: Add mempool analysis for frontrunning/arbitrage opportunities
  }

  /**
   * Handle errors
   */
  _handleError(error, context) {
    logger.error("Transaction processing error", {
      message: error.message,
      context,
    });
  }

  /**
   * Start periodic stats reporting
   */
  _startStatsReporting() {
    const interval = 60000; // 1 minute

    this.statsInterval = setInterval(() => {
      const stats = this.monitor.getStats();
      logger.info("Monitor Statistics", stats);
    }, interval);
  }

  /**
   * Stop the bot and cleanup
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    logger.info("Stopping PolyBot...");

    // Clear stats interval
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }

    // Stop monitoring
    if (this.monitor) {
      await this.monitor.stop();
    }

    // Disconnect from RPC
    if (this.rpcProvider) {
      await this.rpcProvider.disconnect();
    }

    this.isRunning = false;
    logger.info("PolyBot stopped");
  }
}

// Create and start the bot
const bot = new PolyBot(finalConfig);

// Handle graceful shutdown
process.on("SIGINT", async () => {
  logger.info("Received SIGINT signal");
  await bot.stop();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  logger.info("Received SIGTERM signal");
  await bot.stop();
  process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", async (error) => {
  logger.error("Uncaught exception", error);
  await bot.stop();
  process.exit(1);
});

process.on("unhandledRejection", async (reason, promise) => {
  logger.error("Unhandled rejection", { reason, promise });
  await bot.stop();
  process.exit(1);
});

// Start the bot
bot.start();
