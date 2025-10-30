import Logger from '../utils/logger.js';

/**
 * Filters transactions based on various criteria
 * Performance-optimized with early returns
 */
class TransactionFilter {
  constructor(config = {}) {
    this.config = {
      addresses: config.addresses || [], // Array of addresses to filter (from or to)
      fromAddresses: config.fromAddresses || [],
      toAddresses: config.toAddresses || [],
      minValue: config.minValue || null, // Minimum value in wei
      maxValue: config.maxValue || null,
      ...config
    };

    // Convert addresses to lowercase for case-insensitive comparison
    this.normalizedAddresses = this.config.addresses.map(addr => addr.toLowerCase());
    this.normalizedFromAddresses = this.config.fromAddresses.map(addr => addr.toLowerCase());
    this.normalizedToAddresses = this.config.toAddresses.map(addr => addr.toLowerCase());

    this.logger = new Logger('TransactionFilter');
    this.stats = {
      total: 0,
      passed: 0,
      filtered: 0
    };
  }

  /**
   * Check if transaction passes all filter criteria
   * @param {Object} tx - Parsed transaction object
   * @returns {boolean}
   */
  shouldProcess(tx) {
    this.stats.total++;

    // If no filters configured, process all transactions
    if (!this._hasFilters()) {
      this.stats.passed++;
      return true;
    }

    // Check address filters (from OR to)
    if (this.normalizedAddresses.length > 0) {
      const fromMatch = this.normalizedAddresses.includes(tx.from?.toLowerCase());
      const toMatch = tx.to && this.normalizedAddresses.includes(tx.to.toLowerCase());

      if (!fromMatch && !toMatch) {
        this.stats.filtered++;
        return false;
      }
    }

    // Check specific from address filter
    if (this.normalizedFromAddresses.length > 0) {
      if (!this.normalizedFromAddresses.includes(tx.from?.toLowerCase())) {
        this.stats.filtered++;
        return false;
      }
    }

    // Check specific to address filter
    if (this.normalizedToAddresses.length > 0) {
      if (!tx.to || !this.normalizedToAddresses.includes(tx.to.toLowerCase())) {
        this.stats.filtered++;
        return false;
      }
    }

    // Check value range
    if (this.config.minValue !== null || this.config.maxValue !== null) {
      const value = BigInt(tx.value || 0);

      if (this.config.minValue !== null && value < BigInt(this.config.minValue)) {
        this.stats.filtered++;
        return false;
      }

      if (this.config.maxValue !== null && value > BigInt(this.config.maxValue)) {
        this.stats.filtered++;
        return false;
      }
    }

    this.stats.passed++;
    return true;
  }

  /**
   * Check if any filters are configured
   */
  _hasFilters() {
    return (
      this.normalizedAddresses.length > 0 ||
      this.normalizedFromAddresses.length > 0 ||
      this.normalizedToAddresses.length > 0 ||
      this.config.minValue !== null ||
      this.config.maxValue !== null
    );
  }

  /**
   * Update filter configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.normalizedAddresses = (this.config.addresses || []).map(addr => addr.toLowerCase());
    this.normalizedFromAddresses = (this.config.fromAddresses || []).map(addr => addr.toLowerCase());
    this.normalizedToAddresses = (this.config.toAddresses || []).map(addr => addr.toLowerCase());
    this.logger.info('Filter configuration updated', this.config);
  }

  /**
   * Get filter statistics
   */
  getStats() {
    return {
      ...this.stats,
      filterRate: this.stats.total > 0
        ? ((this.stats.filtered / this.stats.total) * 100).toFixed(2) + '%'
        : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      total: 0,
      passed: 0,
      filtered: 0
    };
  }
}

export default TransactionFilter;
