import { formatEther, formatUnits, toUtf8String } from 'ethers';
import Logger from '../utils/logger.js';
import DataDecoder from '../utils/DataDecoder.js';

/**
 * Parses and formats transaction data with comprehensive details
 * Supports enriched transaction data from TransactionEnricher
 * Includes function signature and parameter decoding
 */
class TransactionParser {
  constructor() {
    this.logger = new Logger('TransactionParser');
    this.dataDecoder = new DataDecoder();
  }

  /**
   * Parse raw transaction into structured format with all available details
   * @param {Object} rawTx - Raw transaction from provider (may include receipt)
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

        // Gas information (estimates for pending, actual for confirmed)
        gasLimit: rawTx.gasLimit?.toString(),
        gasPrice: rawTx.gasPrice?.toString() || null,
        maxFeePerGas: rawTx.maxFeePerGas?.toString() || null,
        maxPriorityFeePerGas: rawTx.maxPriorityFeePerGas?.toString() || null,

        // Block information
        blockNumber: rawTx.blockNumber || null,
        blockHash: rawTx.blockHash || null,
        blockTimestamp: rawTx.blockTimestamp || null,
        blockDate: rawTx.blockDate || null,

        // Transaction details
        nonce: rawTx.nonce,
        data: rawTx.data || '0x',
        dataSize: this._calculateDataSize(rawTx.data),
        methodSignature: this.extractMethodSignature(rawTx.data),
        chainId: rawTx.chainId?.toString(),
        type: this._getTransactionType(rawTx.type),
        typeNumber: rawTx.type,

        // Decoded data (function calls and parameters)
        decodedData: null, // Will be populated below

        // Signature
        signature: {
          r: rawTx.r,
          s: rawTx.s,
          v: rawTx.v
        },

        // Status (for confirmed transactions)
        // Note: confirmations is a function in ethers.js, not a value
        // We don't include it in parsed data to avoid printing function code
        confirmations: 'N/A',

        // Metadata
        isPending: !rawTx.blockNumber,
        isContractCreation: !rawTx.to,
        hasData: rawTx.data && rawTx.data !== '0x',

        // Receipt data (if available)
        receipt: rawTx.receipt || null
      };

      // Decode transaction data (function calls and parameters)
      if (parsed.hasData) {
        parsed.decodedData = this.dataDecoder.decode(rawTx.data);
      }

      // Add receipt-specific parsed data
      if (parsed.receipt) {
        parsed.success = parsed.receipt.status === 1;
        parsed.failed = parsed.receipt.status === 0;
        parsed.gasUsed = parsed.receipt.gasUsed;
        parsed.gasUsedEth = formatEther(BigInt(parsed.receipt.gasUsed || 0) * BigInt(parsed.receipt.effectiveGasPrice || 0));
        parsed.effectiveGasPrice = parsed.receipt.effectiveGasPrice;
        parsed.transactionFee = parsed.receipt.transactionFee;
        parsed.transactionFeeEth = formatEther(parsed.receipt.transactionFee || 0);
        parsed.logsCount = parsed.receipt.logsCount;
        parsed.contractAddress = parsed.receipt.contractAddress;
        parsed.transactionIndex = parsed.receipt.transactionIndex;

        // Calculate gas efficiency
        if (parsed.gasLimit && parsed.gasUsed) {
          const efficiency = (BigInt(parsed.gasUsed) * BigInt(100)) / BigInt(parsed.gasLimit);
          parsed.gasEfficiency = `${efficiency.toString()}%`;
        }

        // Calculate fee savings for EIP-1559 transactions
        if (parsed.maxFeePerGas && parsed.effectiveGasPrice) {
          const maxFee = BigInt(parsed.maxFeePerGas);
          const effectiveFee = BigInt(parsed.effectiveGasPrice);
          if (maxFee > effectiveFee) {
            const savings = maxFee - effectiveFee;
            const savingsPercent = (savings * BigInt(100)) / maxFee;
            parsed.feeSavings = {
              wei: savings.toString(),
              eth: formatEther(savings * BigInt(parsed.gasUsed)),
              percent: `${savingsPercent.toString()}%`
            };
          }
        }
      }

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
   * Calculate data size in bytes
   */
  _calculateDataSize(data) {
    if (!data || data === '0x') return 0;
    // Remove '0x' and divide by 2 (2 hex chars = 1 byte)
    return (data.length - 2) / 2;
  }

  /**
   * Get human-readable transaction type
   */
  _getTransactionType(type) {
    const types = {
      0: 'Legacy',
      1: 'EIP-2930 (Access List)',
      2: 'EIP-1559 (Dynamic Fee)'
    };
    return types[type] || `Type ${type}`;
  }

  /**
   * Calculate estimated transaction cost (for pending transactions)
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

  /**
   * Get comprehensive transaction details
   * Returns all available information organized by category
   */
  getDetailedInfo(parsedTx) {
    return {
      basic: {
        hash: parsedTx.hash,
        status: parsedTx.isPending ? 'Pending' : (parsedTx.success ? 'Success' : (parsedTx.failed ? 'Failed' : 'Confirmed')),
        from: parsedTx.from,
        to: parsedTx.to || (parsedTx.isContractCreation ? 'Contract Creation' : null),
        value: parsedTx.valueEth + ' ETH',
        nonce: parsedTx.nonce,
        type: parsedTx.type
      },
      gas: {
        limit: parsedTx.gasLimit,
        used: parsedTx.gasUsed || 'N/A',
        efficiency: parsedTx.gasEfficiency || 'N/A',
        gasPrice: parsedTx.gasPrice ? formatEther(BigInt(parsedTx.gasPrice) * BigInt(1e9)) + ' Gwei' : 'N/A',
        maxFeePerGas: parsedTx.maxFeePerGas ? formatEther(BigInt(parsedTx.maxFeePerGas) * BigInt(1e9)) + ' Gwei' : 'N/A',
        maxPriorityFeePerGas: parsedTx.maxPriorityFeePerGas ? formatEther(BigInt(parsedTx.maxPriorityFeePerGas) * BigInt(1e9)) + ' Gwei' : 'N/A',
        effectiveGasPrice: parsedTx.effectiveGasPrice ? formatEther(BigInt(parsedTx.effectiveGasPrice) * BigInt(1e9)) + ' Gwei' : 'N/A',
        transactionFee: parsedTx.transactionFeeEth ? parsedTx.transactionFeeEth + ' ETH' : 'N/A',
        feeSavings: parsedTx.feeSavings || 'N/A'
      },
      block: {
        number: parsedTx.blockNumber || 'Pending',
        hash: parsedTx.blockHash || 'Pending',
        timestamp: parsedTx.blockDate ? parsedTx.blockDate.toISOString() : 'N/A',
        transactionIndex: parsedTx.transactionIndex ?? 'N/A',
        // confirmations field omitted - it's async in ethers.js
      },
      data: {
        size: parsedTx.dataSize + ' bytes',
        methodSignature: parsedTx.methodSignature || 'N/A',
        hasData: parsedTx.hasData,
        isContractCreation: parsedTx.isContractCreation,
        contractAddress: parsedTx.contractAddress || 'N/A'
      },
      decodedData: parsedTx.decodedData ? {
        methodName: parsedTx.decodedData.decodedMethod || parsedTx.decodedData.methodName || 'Unknown',
        contractType: parsedTx.decodedData.contractType || 'N/A',
        description: parsedTx.decodedData.isKnown ?
          this.dataDecoder.createSummary(parsedTx.decodedData).description : 'Unknown function call',
        parameters: parsedTx.decodedData.decodedParams || 'N/A',
        isKnown: parsedTx.decodedData.isKnown,
        isSwap: this.dataDecoder.isSwap(parsedTx.decodedData),
        isTokenTransfer: this.dataDecoder.isTokenTransfer(parsedTx.decodedData),
        isLiquidityOp: this.dataDecoder.isLiquidityOperation(parsedTx.decodedData)
      } : null,
      network: {
        chainId: parsedTx.chainId,
        logsCount: parsedTx.logsCount ?? 'N/A'
      }
    };
  }
}

export default TransactionParser;
