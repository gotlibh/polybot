import Logger from '../utils/logger.js';
import TransactionParser from '../parsers/TransactionParser.js';
import TransactionFilter from '../filters/TransactionFilter.js';
import TransactionEnricher from '../core/TransactionEnricher.js';

/**
 * Monitors blockchain for transactions and mempool activity
 * Handles subscriptions and event processing with full transaction enrichment
 */
class TransactionMonitor {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.options = {
      monitorPending: options.monitorPending !== false, // Default true
      monitorConfirmed: options.monitorConfirmed !== false, // Default true
      enrichTransactions: options.enrichTransactions !== false, // Default true - fetch receipts
      batchSize: options.batchSize || 1, // Process transactions individually by default
      ...options
    };

    this.parser = new TransactionParser();
    this.filter = new TransactionFilter(options.filterConfig || {});
    this.enricher = new TransactionEnricher(provider);
    this.logger = new Logger('TransactionMonitor');

    // Event handlers
    this.handlers = {
      onTransaction: options.onTransaction || this._defaultTransactionHandler.bind(this),
      onPending: options.onPending || this._defaultPendingHandler.bind(this),
      onError: options.onError || this._defaultErrorHandler.bind(this)
    };

    // Monitoring state
    this.isMonitoring = false;
    this.stats = {
      pendingCount: 0,
      confirmedCount: 0,
      errorCount: 0,
      startTime: null
    };
  }

  /**
   * Start monitoring transactions
   */
  async start() {
    if (this.isMonitoring) {
      this.logger.warn('Monitor is already running');
      return;
    }

    try {
      this.logger.info('Starting transaction monitor', {
        monitorPending: this.options.monitorPending,
        monitorConfirmed: this.options.monitorConfirmed
      });

      this.isMonitoring = true;
      this.stats.startTime = Date.now();

      // Subscribe to pending transactions (mempool)
      if (this.options.monitorPending) {
        await this._subscribeToPending();
      }

      // Subscribe to confirmed blocks/transactions
      if (this.options.monitorConfirmed) {
        await this._subscribeToBlocks();
      }

      this.logger.info('Transaction monitor started successfully');
    } catch (error) {
      this.logger.error('Failed to start transaction monitor', error);
      this.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Subscribe to pending transactions (mempool)
   */
  async _subscribeToPending() {
    this.logger.info('Subscribing to pending transactions (mempool)');

    this.provider.on('pending', async (txHash) => {
      try {
        // Fetch full transaction details
        const tx = await this.provider.getTransaction(txHash);

        if (!tx) {
          return; // Transaction might have been mined or dropped
        }

        const parsedTx = this.parser.parse(tx);

        if (!parsedTx) {
          return;
        }

        // Apply filters
        if (!this.filter.shouldProcess(parsedTx)) {
          return;
        }

        this.stats.pendingCount++;

        // Call handler
        await this.handlers.onPending(parsedTx);
      } catch (error) {
        this.stats.errorCount++;
        this.handlers.onError(error, { txHash, type: 'pending' });
      }
    });
  }

  /**
   * Subscribe to new blocks and their transactions
   */
  async _subscribeToBlocks() {
    this.logger.info('Subscribing to new blocks');

    this.provider.on('block', async (blockNumber) => {
      try {
        // Fetch block with transactions
        const block = await this.provider.getBlock(blockNumber, true);

        if (!block || !block.transactions) {
          return;
        }

        this.logger.debug(`Processing block ${blockNumber} with ${block.transactions.length} transactions`);

        // Process each transaction in the block
        for (const tx of block.transactions) {
          try {
            // Enrich transaction with receipt if enabled
            let enrichedTx = tx;
            if (this.options.enrichTransactions) {
              enrichedTx = await this.enricher.enrichTransaction(tx);
            }

            const parsedTx = this.parser.parse(enrichedTx);

            if (!parsedTx) {
              continue;
            }

            // Apply filters
            if (!this.filter.shouldProcess(parsedTx)) {
              continue;
            }

            this.stats.confirmedCount++;

            // Extract token transfers if receipt available
            let tokenTransfers = [];
            if (enrichedTx.receipt?.logs) {
              tokenTransfers = this.enricher.extractTokenTransfers(enrichedTx.receipt.logs);
            }

            // Call handler with token transfers
            await this.handlers.onTransaction(parsedTx, tokenTransfers);
          } catch (error) {
            this.stats.errorCount++;
            this.handlers.onError(error, { blockNumber, txHash: tx.hash, type: 'confirmed' });
          }
        }
      } catch (error) {
        this.stats.errorCount++;
        this.handlers.onError(error, { blockNumber, type: 'block' });
      }
    });
  }

  /**
   * Stop monitoring
   */
  async stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.logger.info('Stopping transaction monitor');

    // Remove all listeners
    this.provider.removeAllListeners('pending');
    this.provider.removeAllListeners('block');

    this.isMonitoring = false;

    const runtime = Date.now() - this.stats.startTime;
    this.logger.info('Transaction monitor stopped', {
      runtime: `${(runtime / 1000).toFixed(2)}s`,
      ...this.stats
    });
  }

  /**
   * Update filter configuration
   */
  updateFilter(filterConfig) {
    this.filter.updateConfig(filterConfig);
    this.logger.info('Filter configuration updated');
  }

  /**
   * Default transaction handler (confirmed transactions)
   */
  _defaultTransactionHandler(parsedTx) {
    const summary = this.parser.createSummary(parsedTx);
    console.log('\n--- Confirmed Transaction ---');
    console.log(JSON.stringify(summary, null, 2));
  }

  /**
   * Default pending transaction handler (mempool)
   */
  _defaultPendingHandler(parsedTx) {
    const summary = this.parser.createSummary(parsedTx);
    console.log('\n--- Pending Transaction (Mempool) ---');
    console.log(JSON.stringify(summary, null, 2));
  }

  /**
   * Default error handler
   */
  _defaultErrorHandler(error, context) {
    this.logger.error('Transaction processing error', { error: error.message, context });
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    const runtime = this.isMonitoring ? Date.now() - this.stats.startTime : 0;

    return {
      ...this.stats,
      filterStats: this.filter.getStats(),
      isMonitoring: this.isMonitoring,
      runtime: runtime > 0 ? `${(runtime / 1000).toFixed(2)}s` : '0s'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      pendingCount: 0,
      confirmedCount: 0,
      errorCount: 0,
      startTime: this.isMonitoring ? Date.now() : null
    };
    this.filter.resetStats();
  }
}

export default TransactionMonitor;
