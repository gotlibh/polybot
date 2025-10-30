import Logger from './logger.js';

/**
 * Formats transaction output based on configuration
 * Allows flexible control over what information to display
 */
class OutputFormatter {
  constructor(config = {}) {
    this.config = {
      // Field visibility configuration
      fields: {
        basic: config.fields?.basic ?? true,
        gas: config.fields?.gas ?? true,
        block: config.fields?.block ?? true,
        data: config.fields?.data ?? true,
        decodedData: config.fields?.decodedData ?? true,  // NEW: Decoded function data
        network: config.fields?.network ?? true,
        receipt: config.fields?.receipt ?? true,
        tokenTransfers: config.fields?.tokenTransfers ?? true
      },

      // Detailed field configuration
      basicFields: config.basicFields ?? ['hash', 'status', 'from', 'to', 'value', 'nonce', 'type'],
      gasFields: config.gasFields ?? ['limit', 'used', 'efficiency', 'transactionFee', 'effectiveGasPrice', 'feeSavings'],
      blockFields: config.blockFields ?? ['number', 'timestamp', 'transactionIndex', 'confirmations'],
      dataFields: config.dataFields ?? ['size', 'methodSignature', 'contractAddress'],
      decodedDataFields: config.decodedDataFields ?? ['methodName', 'contractType', 'description', 'parameters'], // NEW
      networkFields: config.networkFields ?? ['chainId', 'logsCount'],

      // Output style
      style: config.style || 'detailed', // 'detailed', 'compact', 'json'
      colors: config.colors ?? false, // Future: terminal colors
      maxHashLength: config.maxHashLength || 66, // Full hash by default
      maxAddressLength: config.maxAddressLength || 42, // Full address by default

      // Formatting options
      showEmptyFields: config.showEmptyFields ?? false,
      groupByCategory: config.groupByCategory ?? true
    };

    this.logger = new Logger('OutputFormatter');
  }

  /**
   * Format transaction for display
   */
  format(parsedTx, detailedInfo, tokenTransfers = []) {
    switch (this.config.style) {
      case 'json':
        return this._formatJSON(parsedTx, detailedInfo, tokenTransfers);
      case 'compact':
        return this._formatCompact(parsedTx, detailedInfo);
      case 'detailed':
      default:
        return this._formatDetailed(parsedTx, detailedInfo, tokenTransfers);
    }
  }

  /**
   * Format as detailed human-readable output
   */
  _formatDetailed(parsedTx, detailedInfo, tokenTransfers) {
    const lines = [];
    const separator = '='.repeat(80);
    const subseparator = '-'.repeat(80);

    // Header
    lines.push('');
    lines.push(separator);
    lines.push(`TRANSACTION: ${parsedTx.isPending ? 'MEMPOOL (PENDING)' : 'CONFIRMED'}`);
    lines.push(separator);

    // Basic Information
    if (this.config.fields.basic && detailedInfo.basic) {
      lines.push('\n📋 BASIC INFORMATION');
      lines.push(subseparator);
      this._addFields(lines, detailedInfo.basic, this.config.basicFields);
    }

    // Gas Information
    if (this.config.fields.gas && detailedInfo.gas) {
      lines.push('\n⛽ GAS INFORMATION');
      lines.push(subseparator);
      this._addFields(lines, detailedInfo.gas, this.config.gasFields);
    }

    // Block Information
    if (this.config.fields.block && detailedInfo.block && !parsedTx.isPending) {
      lines.push('\n🔗 BLOCK INFORMATION');
      lines.push(subseparator);
      this._addFields(lines, detailedInfo.block, this.config.blockFields);
    }

    // Data Information
    if (this.config.fields.data && detailedInfo.data) {
      lines.push('\n📊 DATA INFORMATION');
      lines.push(subseparator);
      this._addFields(lines, detailedInfo.data, this.config.dataFields);
    }

    // Decoded Data (Function Calls & Parameters)
    if (this.config.fields.decodedData && detailedInfo.decodedData) {
      lines.push('\n🔍 DECODED FUNCTION CALL');
      lines.push(subseparator);

      // Method info
      lines.push(`  Method         : ${detailedInfo.decodedData.methodName}`);
      lines.push(`  Contract Type  : ${detailedInfo.decodedData.contractType}`);
      lines.push(`  Description    : ${detailedInfo.decodedData.description}`);

      // Flags
      const flags = [];
      if (detailedInfo.decodedData.isSwap) flags.push('DEX Swap');
      if (detailedInfo.decodedData.isTokenTransfer) flags.push('Token Transfer');
      if (detailedInfo.decodedData.isLiquidityOp) flags.push('Liquidity Operation');
      if (flags.length > 0) {
        lines.push(`  Type Flags     : ${flags.join(', ')}`);
      }

      // Parameters
      if (detailedInfo.decodedData.parameters && Array.isArray(detailedInfo.decodedData.parameters)) {
        lines.push(`\n  Parameters:`);
        detailedInfo.decodedData.parameters.forEach((param, idx) => {
          const value = typeof param.value === 'object' && Array.isArray(param.value)
            ? `[${param.value.join(', ')}]`
            : param.value;
          lines.push(`    [${idx + 1}] ${param.name} (${param.type}): ${value}`);
        });
      }
    }

    // Network Information
    if (this.config.fields.network && detailedInfo.network) {
      lines.push('\n🌐 NETWORK INFORMATION');
      lines.push(subseparator);
      this._addFields(lines, detailedInfo.network, this.config.networkFields);
    }

    // Token Transfers
    if (this.config.fields.tokenTransfers && tokenTransfers && tokenTransfers.length > 0) {
      lines.push('\n💰 TOKEN TRANSFERS');
      lines.push(subseparator);
      tokenTransfers.forEach((transfer, idx) => {
        lines.push(`  [${idx + 1}] Type: ${transfer.type}`);
        lines.push(`      Contract: ${transfer.contract}`);
        lines.push(`      From: ${transfer.from}`);
        lines.push(`      To: ${transfer.to}`);
        if (transfer.value) {
          lines.push(`      Value: ${transfer.value}`);
        }
        if (idx < tokenTransfers.length - 1) {
          lines.push('');
        }
      });
    }

    lines.push(separator);
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Format as compact single-line output
   */
  _formatCompact(parsedTx, detailedInfo) {
    const parts = [];

    // Status indicator
    const status = parsedTx.isPending ? '⏳' : (parsedTx.success ? '✅' : '❌');
    parts.push(status);

    // Hash (shortened)
    parts.push(this._shortenHash(parsedTx.hash));

    // From -> To
    parts.push(`${this._shortenAddress(parsedTx.from)} → ${this._shortenAddress(parsedTx.to || 'CREATE')}`);

    // Value
    parts.push(`${parsedTx.valueEth} ETH`);

    // Method
    if (parsedTx.methodSignature) {
      parts.push(`[${parsedTx.methodSignature}]`);
    }

    // Block
    if (!parsedTx.isPending) {
      parts.push(`Block: ${parsedTx.blockNumber}`);
    }

    // Gas
    if (parsedTx.transactionFeeEth) {
      parts.push(`Fee: ${parsedTx.transactionFeeEth} ETH`);
    }

    return parts.join(' | ');
  }

  /**
   * Format as JSON
   */
  _formatJSON(parsedTx, detailedInfo, tokenTransfers) {
    return JSON.stringify({
      transaction: parsedTx,
      details: detailedInfo,
      tokenTransfers: tokenTransfers
    }, null, 2);
  }

  /**
   * Add fields to output lines
   */
  _addFields(lines, data, allowedFields) {
    const maxKeyLength = Math.max(...Object.keys(data).map(k => k.length));

    for (const [key, value] of Object.entries(data)) {
      // Skip if not in allowed fields
      if (!allowedFields.includes(key)) continue;

      // Skip empty fields if configured
      if (!this.config.showEmptyFields && (value === 'N/A' || value === null || value === undefined)) {
        continue;
      }

      // Format key with padding
      const paddedKey = key.padEnd(maxKeyLength + 2);

      // Format value
      let formattedValue = value;
      if (typeof value === 'object' && value !== null) {
        formattedValue = JSON.stringify(value);
      }

      lines.push(`  ${paddedKey}: ${formattedValue}`);
    }
  }

  /**
   * Shorten hash for display
   */
  _shortenHash(hash) {
    if (!hash || hash.length <= this.config.maxHashLength) {
      return hash;
    }
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  }

  /**
   * Shorten address for display
   */
  _shortenAddress(address) {
    if (!address || address.length <= this.config.maxAddressLength) {
      return address;
    }
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = {
      ...this.config,
      ...newConfig,
      fields: { ...this.config.fields, ...newConfig.fields }
    };
    this.logger.info('Output formatter configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.config };
  }
}

export default OutputFormatter;
