import { Contract, isAddress } from 'ethers';
import { ERC20_ABI } from '../abi/DexRouter.js';
import Logger from './logger.js';
import tokenRegistry from '../config/tokens.js';

/**
 * TokenResolver - Resolves token symbols to addresses and fetches metadata
 */
class TokenResolver {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.logger = new Logger('TokenResolver');
    this.cache = new Map(); // Cache for on-chain fetched data
    this.options = {
      cacheTimeout: options.cacheTimeout || 3600000, // 1 hour default
      ...options
    };
  }

  /**
   * Resolve token identifier (symbol or address) to full token info
   * @param {string} tokenIdentifier - Token symbol (e.g., "USDC") or address
   * @returns {Promise<Object>} - Token info { address, symbol, decimals, name }
   */
  async resolve(tokenIdentifier) {
    if (!tokenIdentifier) {
      throw new Error('Token identifier is required');
    }

    // Normalize identifier
    const identifier = tokenIdentifier.trim();

    // Check if it's an address
    if (isAddress(identifier)) {
      return await this.resolveByAddress(identifier);
    }

    // Otherwise, treat as symbol
    return await this.resolveBySymbol(identifier);
  }

  /**
   * Resolve by symbol using registry or on-chain lookup
   * @param {string} symbol - Token symbol (case-insensitive)
   * @returns {Promise<Object>} - Token info
   */
  async resolveBySymbol(symbol) {
    const upperSymbol = symbol.toUpperCase();

    // Check registry first
    const registryToken = tokenRegistry[upperSymbol];
    if (registryToken) {
      this.logger.debug(`Resolved ${symbol} from registry`, {
        address: registryToken.address,
        decimals: registryToken.decimals
      });

      return {
        address: registryToken.address,
        symbol: registryToken.symbol,
        name: registryToken.name,
        decimals: registryToken.decimals,
        type: registryToken.type,
        source: 'registry'
      };
    }

    // Symbol not found in registry
    throw new Error(
      `Token symbol "${symbol}" not found in registry. Please use token address or add to registry.`
    );
  }

  /**
   * Resolve by address - fetch metadata from blockchain
   * @param {string} address - Token contract address
   * @returns {Promise<Object>} - Token info
   */
  async resolveByAddress(address) {
    // Check cache first
    const cached = this.cache.get(address.toLowerCase());
    if (cached && Date.now() - cached.timestamp < this.options.cacheTimeout) {
      this.logger.debug(`Using cached data for ${address}`);
      return cached.data;
    }

    try {
      this.logger.debug(`Fetching on-chain data for ${address}`);

      const tokenContract = new Contract(address, ERC20_ABI, this.provider);

      // Fetch token metadata from blockchain
      const [symbol, decimals, name] = await Promise.all([
        tokenContract.symbol().catch(() => 'UNKNOWN'),
        tokenContract.decimals().catch(() => 18),
        tokenContract.name().catch(() => 'Unknown Token')
      ]);

      const tokenInfo = {
        address,
        symbol,
        name,
        decimals: Number(decimals),
        source: 'blockchain'
      };

      // Cache the result
      this.cache.set(address.toLowerCase(), {
        data: tokenInfo,
        timestamp: Date.now()
      });

      this.logger.debug(`Resolved token from blockchain`, tokenInfo);

      return tokenInfo;
    } catch (error) {
      this.logger.error(`Failed to resolve token at ${address}`, error);
      throw new Error(`Failed to fetch token data for address ${address}: ${error.message}`);
    }
  }

  /**
   * Resolve multiple tokens at once
   * @param {Array<string>} identifiers - Array of token symbols or addresses
   * @returns {Promise<Array<Object>>} - Array of token info
   */
  async resolveMany(identifiers) {
    return Promise.all(identifiers.map(id => this.resolve(id)));
  }

  /**
   * Get token decimals only (optimized for swap operations)
   * @param {string} identifier - Token symbol or address
   * @returns {Promise<number>} - Token decimals
   */
  async getDecimals(identifier) {
    const tokenInfo = await this.resolve(identifier);
    return tokenInfo.decimals;
  }

  /**
   * Validate and normalize swap parameters
   * Converts symbols to addresses and fetches decimals
   * @param {Object} params - Swap parameters with symbols
   * @returns {Promise<Object>} - Normalized parameters with addresses and decimals
   */
  async normalizeSwapParams(params) {
    const { tokenIn, tokenOut, tokenInDecimals, tokenOutDecimals, ...rest } = params;

    // Resolve tokens
    const [tokenInInfo, tokenOutInfo] = await Promise.all([
      this.resolve(tokenIn),
      this.resolve(tokenOut)
    ]);

    // Use provided decimals if available, otherwise use resolved
    const normalized = {
      ...rest,
      tokenIn: tokenInInfo.address,
      tokenOut: tokenOutInfo.address,
      tokenInDecimals: tokenInDecimals !== undefined ? tokenInDecimals : tokenInInfo.decimals,
      tokenOutDecimals: tokenOutDecimals !== undefined ? tokenOutDecimals : tokenOutInfo.decimals,
      tokenInSymbol: tokenInInfo.symbol,
      tokenOutSymbol: tokenOutInfo.symbol,
      tokenInName: tokenInInfo.name,
      tokenOutName: tokenOutInfo.name
    };

    this.logger.debug('Normalized swap params', {
      original: { tokenIn, tokenOut },
      normalized: {
        tokenIn: normalized.tokenIn,
        tokenOut: normalized.tokenOut,
        tokenInDecimals: normalized.tokenInDecimals,
        tokenOutDecimals: normalized.tokenOutDecimals
      }
    });

    return normalized;
  }

  /**
   * Get all tokens from registry
   * @returns {Array<Object>} - Array of all registered tokens
   */
  getAllTokens() {
    return Object.entries(tokenRegistry).map(([key, token]) => ({
      symbol: key,
      ...token
    }));
  }

  /**
   * Search tokens by symbol, name, or address
   * @param {string} query - Search query
   * @returns {Array<Object>} - Matching tokens
   */
  searchTokens(query) {
    const lowerQuery = query.toLowerCase();

    return Object.entries(tokenRegistry)
      .filter(([symbol, token]) => {
        return (
          symbol.toLowerCase().includes(lowerQuery) ||
          token.symbol.toLowerCase().includes(lowerQuery) ||
          token.name.toLowerCase().includes(lowerQuery) ||
          token.address.toLowerCase().includes(lowerQuery)
        );
      })
      .map(([key, token]) => ({
        symbol: key,
        ...token
      }));
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
    this.logger.info('Token cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

export default TokenResolver;
