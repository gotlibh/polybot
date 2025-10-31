import Logger from "../utils/logger.js";

/**
 * Enriches transaction data with receipts and additional details
 * Fetches comprehensive transaction information from the blockchain
 */
class TransactionEnricher {
  constructor(provider) {
    this.provider = provider;
    this.logger = new Logger("TransactionEnricher");
    this.cache = new Map(); // Simple cache for receipts
  }

  /**
   * Enrich transaction with receipt data (for confirmed transactions)
   * @param {Object} tx - Transaction object
   * @returns {Object} Enriched transaction with receipt data
   */
  async enrichTransaction(tx) {
    try {
      const enriched = { ...tx };

      // If transaction is confirmed, fetch receipt
      if (tx.blockNumber) {
        const receipt = await this.getReceipt(tx.hash);

        if (receipt) {
          enriched.receipt = {
            status: receipt.status, // 1 = success, 0 = failed
            gasUsed: receipt.gasUsed?.toString(),
            effectiveGasPrice: receipt.effectiveGasPrice?.toString(),
            cumulativeGasUsed: receipt.cumulativeGasUsed?.toString(),
            logsCount: receipt.logs?.length || 0,
            logs: receipt.logs || [],
            contractAddress: receipt.contractAddress || null,
            transactionIndex: receipt.index,
            blockHash: receipt.blockHash,
            blockNumber: receipt.blockNumber,
          };

          // Calculate actual transaction fee
          if (receipt.gasUsed && receipt.effectiveGasPrice) {
            enriched.receipt.transactionFee = (
              BigInt(receipt.gasUsed) * BigInt(receipt.effectiveGasPrice)
            ).toString();
          }
        }

        // Fetch block details for timestamp
        const block = await this.getBlock(tx.blockNumber);
        if (block) {
          enriched.blockTimestamp = block.timestamp;
          enriched.blockDate = new Date(block.timestamp * 1000);
        }
      }

      return enriched;
    } catch (error) {
      this.logger.error("Failed to enrich transaction", error);
      return tx; // Return original if enrichment fails
    }
  }

  /**
   * Get transaction receipt with caching
   */
  async getReceipt(txHash) {
    try {
      // Check cache first
      if (this.cache.has(txHash)) {
        return this.cache.get(txHash);
      }

      const receipt = await this.provider.getTransactionReceipt(txHash);

      if (receipt) {
        // Cache the receipt
        this.cache.set(txHash, receipt);

        // Cleanup cache if too large (keep last 1000)
        if (this.cache.size > 1000) {
          const firstKey = this.cache.keys().next().value;
          this.cache.delete(firstKey);
        }
      }

      return receipt;
    } catch (error) {
      this.logger.error(`Failed to get receipt for ${txHash}`, error);
      return null;
    }
  }

  /**
   * Get block details
   */
  async getBlock(blockNumber) {
    try {
      return await this.provider.getBlock(blockNumber);
    } catch (error) {
      this.logger.error(`Failed to get block ${blockNumber}`, error);
      return null;
    }
  }

  /**
   * Analyze transaction logs for token transfers
   * ERC20 Transfer: 0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef
   * ERC721 Transfer: Same as ERC20
   * ERC1155 TransferSingle: 0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62
   */
  extractTokenTransfers(logs) {
    const ERC20_TRANSFER_TOPIC =
      "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const ERC1155_TRANSFER_SINGLE =
      "0xc3d58168c5ae7397731d063d5bbf3d657854427343f4c083240f7aacaa2d0f62";
    const ERC1155_TRANSFER_BATCH =
      "0x4a39dc06d4c0dbc64b70af90fd698a233a518aa5d07e595d983b8c0526c8f7fb";

    const transfers = [];

    for (const log of logs) {
      if (!log.topics || log.topics.length === 0) continue;

      const topic0 = log.topics[0];

      if (topic0 === ERC20_TRANSFER_TOPIC && log.topics.length === 3) {
        // ERC20/ERC721 Transfer(address,address,uint256)
        transfers.push({
          type: "ERC20/ERC721",
          contract: log.address,
          from: "0x" + log.topics[1].slice(26), // Remove padding
          to: "0x" + log.topics[2].slice(26),
          value: log.data, // Can be amount (ERC20) or tokenId (ERC721)
          logIndex: log.index,
        });
      } else if (topic0 === ERC1155_TRANSFER_SINGLE) {
        // ERC1155 TransferSingle
        transfers.push({
          type: "ERC1155",
          contract: log.address,
          operator: "0x" + log.topics[1].slice(26),
          from: "0x" + log.topics[2].slice(26),
          to: "0x" + log.topics[3].slice(26),
          logIndex: log.index,
        });
      } else if (topic0 === ERC1155_TRANSFER_BATCH) {
        // ERC1155 TransferBatch
        transfers.push({
          type: "ERC1155_BATCH",
          contract: log.address,
          operator: "0x" + log.topics[1].slice(26),
          from: "0x" + log.topics[2].slice(26),
          to: "0x" + log.topics[3].slice(26),
          logIndex: log.index,
        });
      }
    }

    return transfers;
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }
}

export default TransactionEnricher;
