import { formatEther } from 'ethers';
import Logger from '../utils/logger.js';

/**
 * Parses and formats transaction data
 * Optimized for performance with minimal overhead
 */
class TransactionParser {
  constructor() {
    this.logger = new Logger('TransactionParser');
  }

  /**
   * Parse raw transaction into structured format
   * @param {Object} rawTx - Raw transaction from provider
   * @returns {Object} Parsed transaction data
   */
  parse(rawTx) {
    try {
      const parsed = {
        // Basic transaction info
        hash: rawTx.hash,
        from: rawTx.from,
        to: rawTx.to || null,
        value: rawTx.value?.toString() || '0',
        valueEth: this._formatValue(rawTx.value),

        // Gas information
        gasLimit: rawTx.gasLimit?.toString(),
        gasPrice: rawTx.gasPrice?.toString() || null,
        maxFeePerGas: rawTx.maxFeePerGas?.toString() || null,
        maxPriorityFeePerGas: rawTx.maxPriorityFeePerGas?.toString() || null,

        // Block information
        blockNumber: rawTx.blockNumber || null,
        blockHash: rawTx.blockHash || null,
        timestamp: rawTx.timestamp || Date.now(),

        // Transaction details
        nonce: rawTx.nonce,
        data: rawTx.data || '0x',
        chainId: rawTx.chainId?.toString(),
        type: rawTx.type,

        // Status (for confirmed transactions)
        confirmations: rawTx.confirmations || 0,

        // Metadata
        isPending: !rawTx.blockNumber,
        isContractCreation: !rawTx.to,
        hasData: rawTx.data && rawTx.data !== '0x'
      };

      return parsed;
    } catch (error) {
      this.logger.error('Failed to parse transaction', error);
      return null;
    }
  }

  /**
   * Format value to ETH with proper decimals
   */
  _formatValue(value) {
    try {
      if (!value) return '0';
      return formatEther(value);
    } catch (error) {
      return '0';
    }
  }

  /**
   * Create a human-readable summary of the transaction
   */
  createSummary(parsedTx) {
    const type = parsedTx.isContractCreation ? 'Contract Creation' :
                 parsedTx.hasData ? 'Contract Interaction' : 'Transfer';

    return {
      type,
      hash: parsedTx.hash,
      from: parsedTx.from,
      to: parsedTx.to || 'Contract Creation',
      value: `${parsedTx.valueEth} ETH`,
      status: parsedTx.isPending ? 'Pending' : 'Confirmed',
      block: parsedTx.blockNumber || 'Pending',
      timestamp: new Date(parsedTx.timestamp).toISOString()
    };
  }

  /**
   * Parse batch of transactions efficiently
   */
  parseBatch(transactions) {
    return transactions
      .map(tx => this.parse(tx))
      .filter(tx => tx !== null);
  }

  /**
   * Extract method signature from transaction data
   * Useful for identifying function calls
   */
  extractMethodSignature(data) {
    if (!data || data === '0x' || data.length < 10) {
      return null;
    }
    return data.slice(0, 10); // First 4 bytes (8 hex chars + 0x)
  }

  /**
   * Calculate estimated transaction cost
   */
  calculateEstimatedCost(parsedTx) {
    try {
      let gasPrice = BigInt(0);

      if (parsedTx.maxFeePerGas) {
        gasPrice = BigInt(parsedTx.maxFeePerGas);
      } else if (parsedTx.gasPrice) {
        gasPrice = BigInt(parsedTx.gasPrice);
      }

      const gasLimit = BigInt(parsedTx.gasLimit || 0);
      const costWei = gasPrice * gasLimit;

      return {
        wei: costWei.toString(),
        eth: formatEther(costWei)
      };
    } catch (error) {
      return { wei: '0', eth: '0' };
    }
  }
}

export default TransactionParser;
