import Logger from './logger.js';

/**
 * PriceFormatter - Formats DEX price data for display
 */
class PriceFormatter {
  constructor(config = {}) {
    this.config = {
      style: config.style || 'table', // 'table' or 'detailed'
      showReserves: config.showReserves !== false,
      showAmounts: config.showAmounts || false,
      ...config
    };

    this.logger = new Logger('PriceFormatter');
  }

  /**
   * Format price data for display
   * @param {Array} priceData - Array of price information objects
   * @returns {string} - Formatted output
   */
  format(priceData) {
    if (!priceData || priceData.length === 0) {
      return 'No price data available';
    }

    if (this.config.style === 'table') {
      return this._formatTable(priceData);
    } else {
      return this._formatDetailed(priceData);
    }
  }

  /**
   * Format as table
   */
  _formatTable(priceData) {
    const lines = [];
    const separator = '='.repeat(100);

    lines.push('\n' + separator);
    lines.push('💰 DEX PRICE INFORMATION');
    lines.push(separator);

    // Group by pair
    const pairGroups = new Map();
    for (const data of priceData) {
      const key = data.pairName;
      if (!pairGroups.has(key)) {
        pairGroups.set(key, []);
      }
      pairGroups.get(key).push(data);
    }

    // Display each pair group
    for (const [pairName, prices] of pairGroups) {
      lines.push(`\n📊 ${pairName}`);
      lines.push('-'.repeat(100));

      // Header
      const headers = ['DEX', 'Price', 'Inverse Price'];
      if (this.config.showReserves) {
        headers.push('Reserves');
      }

      // Format rows
      for (const price of prices) {
        const row = [
          this._padRight(price.dex, 15),
          this._padRight(this._formatPrice(price.price.rate, price.tokenOut.symbol), 25),
          this._padRight(this._formatPrice(price.price.inverseRate, price.tokenIn.symbol), 25)
        ];

        if (this.config.showReserves) {
          row.push(this._formatReserves(price));
        }

        lines.push('  ' + row.join(' | '));
      }

      // Show price differences if multiple DEXes
      if (prices.length > 1) {
        const minPrice = Math.min(...prices.map(p => p.price.rate));
        const maxPrice = Math.max(...prices.map(p => p.price.rate));
        const priceDiff = maxPrice - minPrice;
        const priceDiffPercent = ((priceDiff / minPrice) * 100).toFixed(2);

        lines.push(`  💡 Price spread: ${priceDiff.toFixed(6)} (${priceDiffPercent}%)`);

        // Find arbitrage opportunity
        const minDex = prices.find(p => p.price.rate === minPrice).dex;
        const maxDex = prices.find(p => p.price.rate === maxPrice).dex;
        lines.push(`  🔄 Arbitrage: Buy on ${minDex}, Sell on ${maxDex}`);
      }
    }

    lines.push(separator);
    lines.push(`Updated: ${new Date().toLocaleString()}`);
    lines.push(separator);

    return lines.join('\n');
  }

  /**
   * Format as detailed view
   */
  _formatDetailed(priceData) {
    const lines = [];
    const separator = '='.repeat(80);
    const subseparator = '-'.repeat(80);

    lines.push('\n' + separator);
    lines.push('💰 DEX PRICE INFORMATION');
    lines.push(separator);

    for (const data of priceData) {
      lines.push(`\n🔹 ${data.dex} - ${data.pairName}`);
      lines.push(subseparator);

      // Price information
      lines.push('📈 Price Information:');
      lines.push(`  ${data.price.display}`);
      lines.push(`  ${data.price.inverseDisplay}`);

      // Reserves
      if (this.config.showReserves) {
        lines.push('\n💧 Liquidity Reserves:');
        lines.push(`  ${data.tokenIn.symbol}: ${this._formatNumber(data.reserves.reserveInFormatted)}`);
        lines.push(`  ${data.tokenOut.symbol}: ${this._formatNumber(data.reserves.reserveOutFormatted)}`);
      }

      // Amounts
      if (this.config.showAmounts) {
        lines.push('\n💱 Trade Amounts (for 1 token):');
        lines.push(`  Input:  ${data.amounts.amountInFormatted} ${data.tokenIn.symbol}`);
        lines.push(`  Output: ${data.amounts.amountOutFormatted} ${data.tokenOut.symbol}`);
      }

      // Addresses
      lines.push('\n📍 Addresses:');
      lines.push(`  Pair:     ${data.pairAddress}`);
      lines.push(`  Token In:  ${data.tokenIn.address}`);
      lines.push(`  Token Out: ${data.tokenOut.address}`);
    }

    lines.push('\n' + separator);
    lines.push(`Updated: ${new Date().toLocaleString()}`);
    lines.push(separator);

    return lines.join('\n');
  }

  /**
   * Format price with symbol
   */
  _formatPrice(price, symbol) {
    if (price < 0.000001) {
      return `${price.toExponential(4)} ${symbol}`;
    } else if (price < 0.01) {
      return `${price.toFixed(8)} ${symbol}`;
    } else if (price < 1) {
      return `${price.toFixed(6)} ${symbol}`;
    } else if (price < 1000) {
      return `${price.toFixed(4)} ${symbol}`;
    } else {
      return `${this._formatNumber(price.toFixed(2))} ${symbol}`;
    }
  }

  /**
   * Format reserves
   */
  _formatReserves(price) {
    const reserve0 = this._formatNumber(parseFloat(price.reserves.reserveInFormatted).toFixed(2));
    const reserve1 = this._formatNumber(parseFloat(price.reserves.reserveOutFormatted).toFixed(2));
    return `${reserve0} ${price.tokenIn.symbol} / ${reserve1} ${price.tokenOut.symbol}`;
  }

  /**
   * Format number with commas
   */
  _formatNumber(num) {
    const numStr = typeof num === 'number' ? num.toString() : num;
    const parts = numStr.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
  }

  /**
   * Pad string to the right
   */
  _padRight(str, length) {
    return str.toString().padEnd(length, ' ');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    this.logger.info('Price formatter configuration updated', this.config);
  }
}

export default PriceFormatter;
