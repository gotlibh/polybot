import { Contract, formatUnits } from 'ethers';
import Logger from '../utils/logger.js';
import { UNISWAP_V2_ROUTER_ABI, UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI, ERC20_ABI } from '../abi/DexRouter.js';

/**
 * DexPriceMonitor - Monitors DEX prices by querying routers periodically
 * Supports Uniswap V2 compatible DEXes (QuickSwap, SushiSwap, etc.)
 */
class DexPriceMonitor {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.options = {
      enabled: options.enabled !== false,
      interval: options.interval || 30000, // Default 30 seconds
      dexRouters: options.dexRouters || [],
      tradingPairs: options.tradingPairs || [],
      baseAmount: options.baseAmount || '1000000000000000000', // 1 token (18 decimals)
      ...options
    };

    this.logger = new Logger('DexPriceMonitor');
    this.isMonitoring = false;
    this.intervalId = null;
    this.priceCache = new Map();

    // Initialize router contracts
    this.routers = new Map();
    this.factories = new Map();

    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      startTime: null
    };
  }

  /**
   * Initialize DEX contracts
   */
  async initialize() {
    const enabledRouters = this.options.dexRouters.filter(r => r.enabled !== false);

    this.logger.info('Initializing DEX contracts', {
      totalRouters: this.options.dexRouters.length,
      enabledRouters: enabledRouters.length,
      disabledRouters: this.options.dexRouters.length - enabledRouters.length
    });

    for (const dexConfig of this.options.dexRouters) {
      // Skip disabled DEXes
      if (dexConfig.enabled === false) {
        this.logger.info(`Skipping disabled DEX: ${dexConfig.name}`);
        continue;
      }

      try {
        const router = new Contract(dexConfig.address, UNISWAP_V2_ROUTER_ABI, this.provider);
        this.routers.set(dexConfig.name, { contract: router, config: dexConfig });

        // Get factory address
        const factoryAddress = await router.factory();
        const factory = new Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, this.provider);
        this.factories.set(dexConfig.name, factory);

        this.logger.info(`Initialized ${dexConfig.name}`, {
          router: dexConfig.address,
          factory: factoryAddress
        });
      } catch (error) {
        this.logger.error(`Failed to initialize ${dexConfig.name}`, error);
      }
    }
  }

  /**
   * Start monitoring prices
   */
  async start() {
    if (this.isMonitoring) {
      this.logger.warn('Price monitor is already running');
      return;
    }

    if (!this.options.enabled) {
      this.logger.info('Price monitoring is disabled');
      return;
    }

    if (this.options.dexRouters.length === 0) {
      this.logger.warn('No DEX routers configured');
      return;
    }

    if (this.options.tradingPairs.length === 0) {
      this.logger.warn('No trading pairs configured');
      return;
    }

    try {
      await this.initialize();

      const enabledPairs = this.options.tradingPairs.filter(p => p.enabled !== false);
      const disabledPairs = this.options.tradingPairs.filter(p => p.enabled === false);

      this.logger.info('Starting DEX price monitoring', {
        interval: `${this.options.interval}ms`,
        totalPairs: this.options.tradingPairs.length,
        enabledPairs: enabledPairs.length,
        disabledPairs: disabledPairs.length
      });

      if (disabledPairs.length > 0) {
        this.logger.info('Disabled trading pairs:', {
          pairs: disabledPairs.map(p => p.name).join(', ')
        });
      }

      this.isMonitoring = true;
      this.stats.startTime = Date.now();

      // Initial query
      await this.queryPrices();

      // Set up periodic queries
      this.intervalId = setInterval(() => {
        this.queryPrices().catch(error => {
          this.logger.error('Error in periodic price query', error);
        });
      }, this.options.interval);

      this.logger.info('DEX price monitoring started');
    } catch (error) {
      this.logger.error('Failed to start price monitoring', error);
      this.isMonitoring = false;
      throw error;
    }
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      return;
    }

    this.logger.info('Stopping DEX price monitoring');

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isMonitoring = false;

    const runtime = Date.now() - this.stats.startTime;
    this.logger.info('DEX price monitoring stopped', {
      runtime: `${(runtime / 1000).toFixed(2)}s`,
      ...this.stats
    });
  }

  /**
   * Query prices for all configured pairs
   */
  async queryPrices() {
    const results = [];

    for (const pair of this.options.tradingPairs) {
      // Skip disabled pairs
      if (pair.enabled === false) {
        continue;
      }

      for (const [dexName, routerInfo] of this.routers) {
        try {
          const priceInfo = await this.queryPairPrice(dexName, pair);
          if (priceInfo) {
            results.push(priceInfo);
            this.priceCache.set(`${dexName}:${pair.tokenIn}:${pair.tokenOut}`, priceInfo);
          }
        } catch (error) {
          this.stats.failedQueries++;
          this.logger.debug(`Failed to query ${dexName} for ${pair.name || 'pair'}`, {
            error: error.message
          });
        }
      }
    }

    // Call handler if configured
    if (this.options.onPriceUpdate && results.length > 0) {
      this.options.onPriceUpdate(results);
    }

    return results;
  }

  /**
   * Query price for a specific pair on a specific DEX
   */
  async queryPairPrice(dexName, pair) {
    this.stats.totalQueries++;

    const routerInfo = this.routers.get(dexName);
    if (!routerInfo) {
      throw new Error(`Router ${dexName} not found`);
    }

    const router = routerInfo.contract;
    const factory = this.factories.get(dexName);

    try {
      // Get pair address
      const pairAddress = await factory.getPair(pair.tokenIn, pair.tokenOut);
      if (pairAddress === '0x0000000000000000000000000000000000000000') {
        return null; // Pair doesn't exist
      }

      // Get reserves
      const pairContract = new Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);
      const reserves = await pairContract.getReserves();
      const token0 = await pairContract.token0();
      const token1 = await pairContract.token1();

      // Determine which reserve is which
      const isToken0 = token0.toLowerCase() === pair.tokenIn.toLowerCase();
      const reserveIn = isToken0 ? reserves.reserve0 : reserves.reserve1;
      const reserveOut = isToken0 ? reserves.reserve1 : reserves.reserve0;

      // Check if reserves are sufficient
      if (reserveIn === 0n || reserveOut === 0n) {
        this.logger.debug(`Insufficient liquidity in pair ${pairAddress} on ${dexName}`);
        return null;
      }

      // Get token info first (we need decimals for amount calculation)
      let tokenInSymbol = pair.tokenInSymbol || 'TOKEN';
      let tokenOutSymbol = pair.tokenOutSymbol || 'TOKEN';
      let tokenInDecimals = pair.tokenInDecimals || 18;
      let tokenOutDecimals = pair.tokenOutDecimals || 18;

      try {
        const tokenInContract = new Contract(pair.tokenIn, ERC20_ABI, this.provider);
        const tokenOutContract = new Contract(pair.tokenOut, ERC20_ABI, this.provider);

        tokenInSymbol = await tokenInContract.symbol();
        tokenOutSymbol = await tokenOutContract.symbol();
        tokenInDecimals = await tokenInContract.decimals();
        tokenOutDecimals = await tokenOutContract.decimals();
      } catch (error) {
        // Token info fetch failed, use defaults from config
        this.logger.debug(`Failed to fetch token info for pair ${pair.name}`, { error: error.message });
      }

      // Calculate a reasonable base amount (1% of reserve or configured amount, whichever is smaller)
      // This prevents underflow errors with low liquidity pairs
      const onePercentOfReserve = reserveIn / 100n;
      const configuredAmount = BigInt(this.options.baseAmount);
      const baseAmount = onePercentOfReserve < configuredAmount ? onePercentOfReserve : configuredAmount;

      // Ensure base amount is not zero
      if (baseAmount === 0n) {
        this.logger.debug(`Base amount too small for pair ${pairAddress} on ${dexName}`);
        return null;
      }

      // Get amounts out for base amount
      const path = [pair.tokenIn, pair.tokenOut];
      let amountsOut, amountOut;
      try {
        amountsOut = await router.getAmountsOut(baseAmount, path);
        amountOut = amountsOut[1];
      } catch (error) {
        // getAmountsOut failed, likely due to underflow
        this.logger.debug(`getAmountsOut failed for ${pair.name} on ${dexName}`, {
          error: error.message,
          baseAmount: baseAmount.toString()
        });

        // Try to calculate price from reserves directly
        // Price = reserveOut / reserveIn (with decimals adjustment)
        const priceFromReserves = (Number(reserveOut) * Math.pow(10, tokenInDecimals)) /
                                  (Number(reserveIn) * Math.pow(10, tokenOutDecimals));

        this.stats.successfulQueries++;

        return {
          dex: dexName,
          pairAddress,
          pairName: pair.name || `${tokenInSymbol}/${tokenOutSymbol}`,
          tokenIn: {
            address: pair.tokenIn,
            symbol: tokenInSymbol,
            decimals: tokenInDecimals
          },
          tokenOut: {
            address: pair.tokenOut,
            symbol: tokenOutSymbol,
            decimals: tokenOutDecimals
          },
          reserves: {
            reserveIn: reserveIn.toString(),
            reserveOut: reserveOut.toString(),
            reserveInFormatted: formatUnits(reserveIn, tokenInDecimals),
            reserveOutFormatted: formatUnits(reserveOut, tokenOutDecimals)
          },
          price: {
            rate: priceFromReserves,
            display: `1 ${tokenInSymbol} = ${priceFromReserves.toFixed(6)} ${tokenOutSymbol}`,
            inverseRate: 1 / priceFromReserves,
            inverseDisplay: `1 ${tokenOutSymbol} = ${(1 / priceFromReserves).toFixed(6)} ${tokenInSymbol}`
          },
          amounts: {
            amountIn: 'N/A',
            amountOut: 'N/A',
            amountInFormatted: 'N/A',
            amountOutFormatted: 'N/A'
          },
          timestamp: Date.now(),
          warning: 'Price calculated from reserves (low liquidity)'
        };
      }

      // Get amounts in for base amount
      let amountsIn, amountIn;
      try {
        amountsIn = await router.getAmountsIn(baseAmount, path);
        amountIn = amountsIn[0];
      } catch (error) {
        // getAmountsIn failed, set to N/A
        this.logger.debug(`getAmountsIn failed for ${pair.name} on ${dexName}`, { error: error.message });
        amountIn = baseAmount; // Use base amount as fallback
      }

      // Calculate price (how much tokenOut per 1 tokenIn)
      const price = parseFloat(formatUnits(amountOut, tokenOutDecimals));
      const inversePrice = parseFloat(formatUnits(baseAmount, tokenInDecimals)) / price;

      this.stats.successfulQueries++;

      return {
        dex: dexName,
        pairAddress,
        pairName: pair.name || `${tokenInSymbol}/${tokenOutSymbol}`,
        tokenIn: {
          address: pair.tokenIn,
          symbol: tokenInSymbol,
          decimals: tokenInDecimals
        },
        tokenOut: {
          address: pair.tokenOut,
          symbol: tokenOutSymbol,
          decimals: tokenOutDecimals
        },
        reserves: {
          reserveIn: reserveIn.toString(),
          reserveOut: reserveOut.toString(),
          reserveInFormatted: formatUnits(reserveIn, tokenInDecimals),
          reserveOutFormatted: formatUnits(reserveOut, tokenOutDecimals)
        },
        price: {
          // 1 tokenIn = X tokenOut
          rate: price,
          display: `1 ${tokenInSymbol} = ${price.toFixed(6)} ${tokenOutSymbol}`,

          // Inverse: 1 tokenOut = X tokenIn
          inverseRate: inversePrice,
          inverseDisplay: `1 ${tokenOutSymbol} = ${inversePrice.toFixed(6)} ${tokenInSymbol}`
        },
        amounts: {
          amountIn: amountIn.toString(),
          amountOut: amountOut.toString(),
          amountInFormatted: formatUnits(amountIn, tokenInDecimals),
          amountOutFormatted: formatUnits(amountOut, tokenOutDecimals)
        },
        timestamp: Date.now()
      };
    } catch (error) {
      this.stats.failedQueries++;
      throw error;
    }
  }

  /**
   * Get cached price for a specific pair
   */
  getCachedPrice(dexName, tokenIn, tokenOut) {
    return this.priceCache.get(`${dexName}:${tokenIn}:${tokenOut}`);
  }

  /**
   * Get all cached prices
   */
  getAllCachedPrices() {
    return Array.from(this.priceCache.values());
  }

  /**
   * Clear price cache
   */
  clearCache() {
    this.priceCache.clear();
    this.logger.info('Price cache cleared');
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    const runtime = this.isMonitoring ? Date.now() - this.stats.startTime : 0;
    const successRate = this.stats.totalQueries > 0
      ? ((this.stats.successfulQueries / this.stats.totalQueries) * 100).toFixed(2)
      : '0';

    return {
      ...this.stats,
      isMonitoring: this.isMonitoring,
      runtime: runtime > 0 ? `${(runtime / 1000).toFixed(2)}s` : '0s',
      successRate: `${successRate}%`,
      cachedPrices: this.priceCache.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalQueries: 0,
      successfulQueries: 0,
      failedQueries: 0,
      startTime: this.isMonitoring ? Date.now() : null
    };
  }
}

export default DexPriceMonitor;
