import { Contract, parseUnits, formatUnits, Wallet, MaxUint256 } from 'ethers';
import Logger from '../utils/logger.js';
import TokenResolver from '../utils/TokenResolver.js';
import { UNISWAP_V2_ROUTER_ABI, ERC20_ABI } from '../abi/DexRouter.js';

/**
 * SwapExecutor - Executes token swaps on DEXes
 * Handles transaction building, signing, and execution
 */
class SwapExecutor {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.options = {
      maxSlippage: options.maxSlippage || 0.5, // Default 0.5% slippage
      deadlineMinutes: options.deadlineMinutes || 20, // Default 20 minutes
      gasLimitBuffer: options.gasLimitBuffer || 1.2, // 20% buffer on gas estimates
      arbitrageCacheTTL: options.arbitrageCacheTTL || 300000, // 5 minutes default
      ...options
    };

    this.logger = new Logger('SwapExecutor');
    this.tokenResolver = new TokenResolver(provider);
    this.routers = new Map();

    // Cache for arbitrage opportunities
    this.arbitrageCache = new Map();

    this.stats = {
      totalSwaps: 0,
      successfulSwaps: 0,
      failedSwaps: 0,
      totalVolumeUSD: 0
    };
  }

  /**
   * Generate unique ID for arbitrage opportunity
   */
  _generateArbitrageId() {
    return `arb_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Store arbitrage opportunity in cache
   * @param {Object} opportunity - Arbitrage opportunity details
   * @returns {string} - Generated ID
   */
  _cacheArbitrageOpportunity(opportunity) {
    const id = this._generateArbitrageId();
    const expiresAt = Date.now() + this.options.arbitrageCacheTTL;

    this.arbitrageCache.set(id, {
      ...opportunity,
      id,
      cachedAt: Date.now(),
      expiresAt
    });

    this.logger.debug('Cached arbitrage opportunity', {
      id,
      pair: opportunity.pair,
      profitPercentage: opportunity.profitLossPercentage,
      expiresIn: `${this.options.arbitrageCacheTTL / 1000}s`
    });

    return id;
  }

  /**
   * Get arbitrage opportunity from cache
   * @param {string} id - Arbitrage opportunity ID
   * @returns {Object|null} - Cached opportunity or null if not found/expired
   */
  getArbitrageOpportunity(id) {
    const opportunity = this.arbitrageCache.get(id);

    if (!opportunity) {
      return null;
    }

    // Check if expired
    if (Date.now() > opportunity.expiresAt) {
      this.arbitrageCache.delete(id);
      this.logger.debug('Arbitrage opportunity expired', { id });
      return null;
    }

    return opportunity;
  }

  /**
   * Clean expired opportunities from cache
   */
  _cleanExpiredOpportunities() {
    const now = Date.now();
    let cleaned = 0;

    for (const [id, opp] of this.arbitrageCache.entries()) {
      if (now > opp.expiresAt) {
        this.arbitrageCache.delete(id);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      this.logger.debug(`Cleaned ${cleaned} expired arbitrage opportunities`);
    }
  }

  /**
   * Initialize router contracts
   */
  async initialize(dexRouters) {
    this.logger.info('Initializing DEX routers for swap execution', {
      routerCount: dexRouters.length
    });

    for (const dexConfig of dexRouters) {
      if (dexConfig.enabled === false) {
        continue;
      }

      try {
        const router = new Contract(
          dexConfig.address,
          UNISWAP_V2_ROUTER_ABI,
          this.provider
        );

        this.routers.set(dexConfig.name, {
          contract: router,
          address: dexConfig.address,
          config: dexConfig
        });

        this.logger.info(`Initialized router: ${dexConfig.name}`, {
          address: dexConfig.address
        });
      } catch (error) {
        this.logger.error(`Failed to initialize router ${dexConfig.name}`, error);
      }
    }
  }

  /**
   * Check and approve token allowance for router
   * @param {string} tokenAddress - Token contract address
   * @param {string} routerAddress - Router contract address
   * @param {string} amountNeeded - Amount needed in wei
   * @param {Wallet} wallet - Wallet instance
   * @returns {Promise<boolean>} - True if approval was needed and executed
   */
  async ensureTokenApproval(tokenAddress, routerAddress, amountNeeded, wallet) {
    try {
      const tokenContract = new Contract(tokenAddress, ERC20_ABI, wallet);

      // Check current allowance
      const currentAllowance = await tokenContract.allowance(wallet.address, routerAddress);

      this.logger.debug('Checking token allowance', {
        token: tokenAddress,
        router: routerAddress,
        current: currentAllowance.toString(),
        needed: amountNeeded.toString()
      });

      // If allowance is sufficient, no approval needed
      if (currentAllowance >= BigInt(amountNeeded)) {
        this.logger.info('Token allowance sufficient, no approval needed');
        return false;
      }

      // Need to approve
      this.logger.info('Approving token for router', {
        token: tokenAddress,
        router: routerAddress,
        amount: 'unlimited'
      });

      // Approve unlimited amount (common practice to avoid repeated approvals)
      const approveTx = await tokenContract.approve(routerAddress, MaxUint256);
      this.logger.info('Approval transaction sent', {
        hash: approveTx.hash
      });

      // Wait for approval confirmation
      const approveReceipt = await approveTx.wait();
      this.logger.info('Token approved successfully', {
        hash: approveReceipt.hash,
        blockNumber: approveReceipt.blockNumber
      });

      return true;
    } catch (error) {
      this.logger.error('Failed to approve token', error);
      throw new Error(`Token approval failed: ${error.message}`);
    }
  }

  /**
   * Execute a token swap
   * @param {Object} params - Swap parameters
   * @param {string} params.dexName - Name of the DEX to use
   * @param {string} params.tokenIn - Input token address
   * @param {string} params.tokenOut - Output token address
   * @param {string} params.amountIn - Amount to swap (in token units, e.g., "1.5")
   * @param {number} params.tokenInDecimals - Input token decimals
   * @param {number} params.tokenOutDecimals - Output token decimals
   * @param {string} params.privateKey - Private key for signing
   * @param {string} params.recipient - Recipient address (optional, defaults to sender)
   * @param {number} params.slippage - Slippage tolerance in % (optional)
   * @param {number} params.deadline - Deadline in minutes (optional)
   * @param {string} params.gasLimit - Gas limit (optional, auto-estimated if not provided)
   * @param {string} params.gasPrice - Gas price in gwei (optional)
   * @param {string} params.maxFeePerGas - Max fee per gas in gwei (optional, for EIP-1559)
   * @param {string} params.maxPriorityFeePerGas - Max priority fee per gas in gwei (optional, for EIP-1559)
   * @returns {Object} - Swap result with transaction details
   */
  async executeSwap(params) {
    this.stats.totalSwaps++;

    try {
      this.logger.info('Starting swap execution', {
        dex: params.dexName,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        amountIn: params.amountIn
      });

      // Get router
      const routerInfo = this.routers.get(params.dexName);
      if (!routerInfo) {
        throw new Error(`DEX router not found: ${params.dexName}`);
      }

      // Create wallet
      const wallet = new Wallet(params.privateKey, this.provider);
      const senderAddress = wallet.address;

      this.logger.info('Wallet connected', {
        address: senderAddress
      });

      // Connect router to wallet
      const router = routerInfo.contract.connect(wallet);

      // Parse amount
      const amountInWei = parseUnits(params.amountIn, params.tokenInDecimals);

      // Check token balance
      const tokenContract = new Contract(params.tokenIn, ERC20_ABI, wallet);
      const balance = await tokenContract.balanceOf(senderAddress);

      this.logger.info('Checking token balance', {
        token: params.tokenIn,
        balance: formatUnits(balance, params.tokenInDecimals),
        needed: params.amountIn
      });

      if (balance < amountInWei) {
        throw new Error(
          `Insufficient token balance. Have: ${formatUnits(balance, params.tokenInDecimals)}, Need: ${params.amountIn}`
        );
      }

      // Ensure token approval before swap
      await this.ensureTokenApproval(
        params.tokenIn,
        routerInfo.address,
        amountInWei.toString(),
        wallet
      );

      // Calculate minimum output with slippage
      const slippage = params.slippage || this.options.maxSlippage;
      const path = [params.tokenIn, params.tokenOut];

      this.logger.info('Getting amounts out', {
        amountIn: amountInWei.toString(),
        path
      });

      const amountsOut = await router.getAmountsOut(amountInWei, path);
      const expectedAmountOut = amountsOut[1];
      const minAmountOut = (expectedAmountOut * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;

      this.logger.info('Calculated output amounts', {
        expectedAmountOut: formatUnits(expectedAmountOut, params.tokenOutDecimals),
        minAmountOut: formatUnits(minAmountOut, params.tokenOutDecimals),
        slippage: `${slippage}%`
      });

      // Calculate deadline
      const deadlineMinutes = params.deadline || this.options.deadlineMinutes;
      const deadline = Math.floor(Date.now() / 1000) + (deadlineMinutes * 60);

      // Recipient address
      const recipient = params.recipient || senderAddress;

      // Build transaction
      const swapMethod = 'swapExactTokensForTokens';
      const swapArgs = [
        amountInWei,
        minAmountOut,
        path,
        recipient,
        deadline
      ];

      this.logger.info('Building transaction', {
        method: swapMethod,
        recipient,
        deadline: new Date(deadline * 1000).toISOString()
      });

      // Estimate gas
      let gasLimit;
      try {
        // Use the correct method to estimate gas
        const estimatedGas = await router.swapExactTokensForTokens.estimateGas(
          amountInWei,
          minAmountOut,
          path,
          recipient,
          deadline
        );
        gasLimit = (estimatedGas * BigInt(Math.floor(this.options.gasLimitBuffer * 100))) / 100n;
        this.logger.info('Gas estimated', {
          estimated: estimatedGas.toString(),
          withBuffer: gasLimit.toString()
        });
      } catch (error) {
        this.logger.warn('Gas estimation failed, using provided or default gas limit', {
          error: error.message,
          reason: error.reason || 'Unknown'
        });
        gasLimit = params.gasLimit ? BigInt(params.gasLimit) : 300000n;
      }

      // Build transaction options
      const txOptions = {
        gasLimit: gasLimit.toString()
      };

      // Add gas pricing (EIP-1559 or legacy)
      if (params.maxFeePerGas && params.maxPriorityFeePerGas) {
        // EIP-1559
        txOptions.maxFeePerGas = parseUnits(params.maxFeePerGas, 'gwei');
        txOptions.maxPriorityFeePerGas = parseUnits(params.maxPriorityFeePerGas, 'gwei');
        this.logger.info('Using EIP-1559 gas pricing', {
          maxFeePerGas: params.maxFeePerGas,
          maxPriorityFeePerGas: params.maxPriorityFeePerGas
        });
      } else if (params.gasPrice) {
        // Legacy
        txOptions.gasPrice = parseUnits(params.gasPrice, 'gwei');
        this.logger.info('Using legacy gas pricing', {
          gasPrice: params.gasPrice
        });
      } else {
        // Auto fetch gas price
        const feeData = await this.provider.getFeeData();
        if (feeData.maxFeePerGas && feeData.maxPriorityFeePerGas) {
          txOptions.maxFeePerGas = feeData.maxFeePerGas;
          txOptions.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;
          this.logger.info('Auto-detected EIP-1559 gas pricing', {
            maxFeePerGas: formatUnits(feeData.maxFeePerGas, 'gwei'),
            maxPriorityFeePerGas: formatUnits(feeData.maxPriorityFeePerGas, 'gwei')
          });
        } else if (feeData.gasPrice) {
          txOptions.gasPrice = feeData.gasPrice;
          this.logger.info('Auto-detected legacy gas pricing', {
            gasPrice: formatUnits(feeData.gasPrice, 'gwei')
          });
        }
      }

      this.logger.info('Executing swap transaction...');

      // Execute swap
      const tx = await router[swapMethod](...swapArgs, txOptions);

      this.logger.info('Transaction sent', {
        hash: tx.hash,
        from: senderAddress,
        to: routerInfo.address
      });

      // Wait for confirmation
      this.logger.info('Waiting for transaction confirmation...');
      const receipt = await tx.wait();

      this.logger.info('Transaction confirmed', {
        hash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        status: receipt.status === 1 ? 'success' : 'failed'
      });

      if (receipt.status !== 1) {
        throw new Error('Transaction failed on-chain');
      }

      this.stats.successfulSwaps++;

      // Parse logs to get actual amounts
      let actualAmountOut = null;
      try {
        // Look for Swap event in logs
        const swapTopic = router.interface.getEvent('Swap')?.topicHash;
        const swapLog = receipt.logs.find(log => log.topics[0] === swapTopic);
        if (swapLog) {
          const parsed = router.interface.parseLog(swapLog);
          actualAmountOut = parsed.args.amount1Out || parsed.args.amount0Out;
        }
      } catch (error) {
        this.logger.debug('Could not parse swap event from logs', {
          error: error.message
        });
      }

      return {
        success: true,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        effectiveGasPrice: receipt.gasPrice?.toString() || receipt.effectiveGasPrice?.toString(),
        from: senderAddress,
        to: routerInfo.address,
        swap: {
          dex: params.dexName,
          tokenIn: params.tokenIn,
          tokenOut: params.tokenOut,
          amountIn: params.amountIn,
          amountInWei: amountInWei.toString(),
          expectedAmountOut: formatUnits(expectedAmountOut, params.tokenOutDecimals),
          minAmountOut: formatUnits(minAmountOut, params.tokenOutDecimals),
          actualAmountOut: actualAmountOut ? formatUnits(actualAmountOut, params.tokenOutDecimals) : null,
          slippage: `${slippage}%`,
          deadline: new Date(deadline * 1000).toISOString()
        },
        timestamp: Date.now()
      };
    } catch (error) {
      this.stats.failedSwaps++;
      this.logger.error('Swap execution failed', error);

      return {
        success: false,
        error: error.message,
        code: error.code,
        details: error.reason || error.shortMessage,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get quote for a swap without executing
   */
  async getSwapQuote(params) {
    try {
      const routerInfo = this.routers.get(params.dexName);
      if (!routerInfo) {
        throw new Error(`DEX router not found: ${params.dexName}`);
      }

      const router = routerInfo.contract;
      const amountInWei = parseUnits(params.amountIn, params.tokenInDecimals);
      const path = [params.tokenIn, params.tokenOut];

      const amountsOut = await router.getAmountsOut(amountInWei, path);
      const expectedAmountOut = amountsOut[1];

      const slippage = params.slippage || this.options.maxSlippage;
      const minAmountOut = (expectedAmountOut * BigInt(Math.floor((100 - slippage) * 100))) / 10000n;

      // Get pair reserves
      let reserves = null;
      try {
        const { UNISWAP_V2_FACTORY_ABI, UNISWAP_V2_PAIR_ABI } = await import('../abi/DexRouter.js');

        // Get factory address
        const factoryAddress = await router.factory();
        const factory = new Contract(factoryAddress, UNISWAP_V2_FACTORY_ABI, this.provider);

        // Get pair address
        const pairAddress = await factory.getPair(params.tokenIn, params.tokenOut);

        if (pairAddress && pairAddress !== '0x0000000000000000000000000000000000000000') {
          const pair = new Contract(pairAddress, UNISWAP_V2_PAIR_ABI, this.provider);

          // Get reserves and token order
          const [reserve0, reserve1] = await pair.getReserves();
          const token0 = await pair.token0();

          // Determine which reserve is which token
          const isToken0 = token0.toLowerCase() === params.tokenIn.toLowerCase();
          const reserveIn = isToken0 ? reserve0 : reserve1;
          const reserveOut = isToken0 ? reserve1 : reserve0;

          reserves = {
            reserveIn: formatUnits(reserveIn, params.tokenInDecimals),
            reserveOut: formatUnits(reserveOut, params.tokenOutDecimals),
            pairAddress
          };
        }
      } catch (error) {
        this.logger.debug('Failed to fetch reserves', {
          error: error.message
        });
      }

      // Estimate gas
      let estimatedGas = null;
      try {
        const deadline = Math.floor(Date.now() / 1000) + (this.options.deadlineMinutes * 60);
        const tempWallet = Wallet.createRandom().connect(this.provider);
        const routerWithSigner = router.connect(tempWallet);

        estimatedGas = await routerWithSigner.swapExactTokensForTokens.estimateGas(
          amountInWei,
          minAmountOut,
          path,
          tempWallet.address,
          deadline
        );
      } catch (error) {
        this.logger.debug('Gas estimation failed for quote', {
          error: error.message
        });
      }

      // Calculate exchange rate
      const expectedOut = formatUnits(expectedAmountOut, params.tokenOutDecimals);
      const amountInNum = parseFloat(params.amountIn);
      const expectedOutNum = parseFloat(expectedOut);
      const exchangeRate = amountInNum > 0 ? (expectedOutNum / amountInNum).toFixed(6) : '0';

      // Calculate real price impact if reserves are available
      let priceImpact = 'N/A';
      if (reserves) {
        const reserveInNum = parseFloat(reserves.reserveIn);
        const reserveOutNum = parseFloat(reserves.reserveOut);

        if (reserveInNum > 0 && reserveOutNum > 0) {
          // Spot price before trade
          const spotPrice = reserveOutNum / reserveInNum;
          // Execution price
          const executionPrice = expectedOutNum / amountInNum;
          // Price impact
          const impact = ((executionPrice - spotPrice) / spotPrice) * 100;
          priceImpact = `${Math.abs(impact).toFixed(4)}%`;
        }
      }

      return {
        success: true,
        dex: params.dexName,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        tokenInSymbol: params.tokenInSymbol || 'TOKEN',
        tokenOutSymbol: params.tokenOutSymbol || 'TOKEN',
        amountIn: params.amountIn,
        expectedAmountOut: expectedOut,
        minAmountOut: formatUnits(minAmountOut, params.tokenOutDecimals),
        exchangeRate: `1 ${params.tokenInSymbol || 'TOKEN'} = ${exchangeRate} ${params.tokenOutSymbol || 'TOKEN'}`,
        reserves: reserves ? {
          [params.tokenInSymbol || 'tokenIn']: reserves.reserveIn,
          [params.tokenOutSymbol || 'tokenOut']: reserves.reserveOut,
          pairAddress: reserves.pairAddress
        } : null,
        slippage: `${slippage}%`,
        priceImpact,
        estimatedGas: estimatedGas ? estimatedGas.toString() : null,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get swap quote', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get quotes from multiple DEXes
   * @param {Object} params - Quote parameters with dexName as array
   * @returns {Promise<Object>} - Aggregated quotes with comparison data
   */
  async getMultiDexQuote(params) {
    try {
      // Ensure dexName is an array
      const dexNames = Array.isArray(params.dexName) ? params.dexName : [params.dexName];

      this.logger.info('Getting multi-DEX quotes', {
        dexes: dexNames,
        tokenIn: params.tokenInSymbol || params.tokenIn,
        tokenOut: params.tokenOutSymbol || params.tokenOut,
        amountIn: params.amountIn
      });

      // Query all DEXes in parallel
      const quotePromises = dexNames.map(dexName =>
        this.getSwapQuote({ ...params, dexName })
          .catch(error => ({
            success: false,
            dex: dexName,
            error: error.message,
            timestamp: Date.now()
          }))
      );

      const quotes = await Promise.all(quotePromises);

      // Filter successful quotes
      const validQuotes = quotes.filter(q => q.success);
      const failedQuotes = quotes.filter(q => !q.success);

      if (validQuotes.length === 0) {
        return {
          success: false,
          error: 'All DEX quotes failed',
          failedQuotes,
          timestamp: Date.now()
        };
      }

      // Parse amounts for comparison
      const quotesWithParsedAmounts = validQuotes.map(q => ({
        ...q,
        expectedAmountOutNum: parseFloat(q.expectedAmountOut)
      }));

      // Sort by expected output (descending)
      quotesWithParsedAmounts.sort((a, b) => b.expectedAmountOutNum - a.expectedAmountOutNum);

      // Get best and worst
      const bestQuote = quotesWithParsedAmounts[0];
      const worstQuote = quotesWithParsedAmounts[quotesWithParsedAmounts.length - 1];

      // Calculate price spread
      const bestPrice = bestQuote.expectedAmountOutNum;
      const worstPrice = worstQuote.expectedAmountOutNum;
      const spread = worstPrice > 0 ? ((bestPrice - worstPrice) / worstPrice * 100).toFixed(4) : '0';

      // Calculate average price
      const avgPrice = (
        quotesWithParsedAmounts.reduce((sum, q) => sum + q.expectedAmountOutNum, 0) / validQuotes.length
      ).toFixed(6);

      // Build comparison data
      const comparison = {
        bestDex: bestQuote.dex,
        bestPrice: bestQuote.expectedAmountOut,
        bestExchangeRate: bestQuote.exchangeRate,
        worstDex: worstQuote.dex,
        worstPrice: worstQuote.expectedAmountOut,
        worstExchangeRate: worstQuote.exchangeRate,
        averagePrice: avgPrice,
        priceSpread: `${spread}%`,
        totalDexesQueried: dexNames.length,
        successfulQuotes: validQuotes.length,
        failedQuotes: failedQuotes.length
      };

      // Add arbitrage opportunity flag
      const arbThreshold = 0.5; // 0.5% difference considered arbitrage opportunity
      const hasArbOpportunity = parseFloat(spread) > arbThreshold;

      return {
        success: true,
        tokenIn: params.tokenIn,
        tokenOut: params.tokenOut,
        tokenInSymbol: params.tokenInSymbol || 'TOKEN',
        tokenOutSymbol: params.tokenOutSymbol || 'TOKEN',
        amountIn: params.amountIn,
        quotes: quotesWithParsedAmounts.map(q => {
          // Remove the parsed amount from response
          const { expectedAmountOutNum, ...rest } = q;
          return rest;
        }),
        comparison,
        arbitrageOpportunity: hasArbOpportunity,
        failedQuotes: failedQuotes.length > 0 ? failedQuotes : undefined,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to get multi-DEX quotes', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Get arbitrage analysis for token pair across multiple DEXes
   * Queries both directions and finds best round-trip opportunities
   * @param {Object} params - Parameters with token pair
   * @returns {Promise<Object>} - Arbitrage analysis with best opportunities
   */
  async getArbitrageAnalysis(params) {
    try {
      const { token1, token2, dexName: dexNames, amountIn, slippage } = params;

      this.logger.info('Analyzing arbitrage opportunities', {
        pair: `${token1}/${token2}`,
        dexes: dexNames,
        amountIn
      });

      // Resolve both tokens
      const [token1Info, token2Info] = await Promise.all([
        this.tokenResolver.resolve(token1),
        this.tokenResolver.resolve(token2)
      ]);

      // Get quotes for both directions across all DEXes
      // Direction A: token1 -> token2
      const quotesA = await this.getMultiDexQuote({
        dexName: dexNames,
        tokenIn: token1Info.address,
        tokenOut: token2Info.address,
        tokenInDecimals: token1Info.decimals,
        tokenOutDecimals: token2Info.decimals,
        tokenInSymbol: token1Info.symbol,
        tokenOutSymbol: token2Info.symbol,
        amountIn,
        slippage
      });

      if (!quotesA.success) {
        return {
          success: false,
          error: 'Failed to get quotes for direction A',
          details: quotesA.error
        };
      }

      // Now for each quote in direction A, get quotes for direction B using the output amount
      const arbitrageOpportunities = [];

      for (const quoteA of quotesA.quotes) {
        if (!quoteA.success) continue;

        const dexA = quoteA.dex;
        const amountOut = quoteA.expectedAmountOut;

        // Direction B: token2 -> token1 (using output from A as input)
        const quotesB = await this.getMultiDexQuote({
          dexName: dexNames,
          tokenIn: token2Info.address,
          tokenOut: token1Info.address,
          tokenInDecimals: token2Info.decimals,
          tokenOutDecimals: token1Info.decimals,
          tokenInSymbol: token2Info.symbol,
          tokenOutSymbol: token1Info.symbol,
          amountIn: amountOut,
          slippage
        });

        if (!quotesB.success) continue;

        // Analyze each round-trip combination
        for (const quoteB of quotesB.quotes) {
          if (!quoteB.success) continue;

          const dexB = quoteB.dex;
          const finalAmount = parseFloat(quoteB.expectedAmountOut);
          const initialAmount = parseFloat(amountIn);

          // Calculate profit/loss
          const profitLoss = finalAmount - initialAmount;
          const profitLossPercentage = ((profitLoss / initialAmount) * 100).toFixed(4);
          const isProfit = profitLoss > 0;

          arbitrageOpportunities.push({
            path: `${dexA} → ${dexB}`,
            dexA,
            dexB,
            route: `${token1Info.symbol} → ${token2Info.symbol} → ${token1Info.symbol}`,
            description: `BUY ${quoteA.expectedAmountOut} ${token2Info.symbol} from ${dexA} with ${amountIn} ${token1Info.symbol}, then SELL ${quoteA.expectedAmountOut} ${token2Info.symbol} on ${dexB} for ${finalAmount.toFixed(token1Info.decimals)} ${token1Info.symbol}`,
            initialAmount: amountIn,
            intermediateAmount: amountOut,
            finalAmount: finalAmount.toFixed(token1Info.decimals),
            profitLoss: profitLoss.toFixed(token1Info.decimals),
            profitLossPercentage: `${profitLossPercentage}%`,
            profitLossToken: token1Info.symbol,
            isProfit,
            swapADetails: {
              dex: dexA,
              from: token1Info.symbol,
              to: token2Info.symbol,
              amountIn: quoteA.amountIn,
              amountOut: quoteA.expectedAmountOut,
              priceImpact: quoteA.priceImpact,
              reserves: quoteA.reserves
            },
            swapBDetails: {
              dex: dexB,
              from: token2Info.symbol,
              to: token1Info.symbol,
              amountIn: quoteB.amountIn,
              amountOut: quoteB.expectedAmountOut,
              priceImpact: quoteB.priceImpact,
              reserves: quoteB.reserves
            }
          });
        }
      }

      // Sort by profit/loss (descending)
      arbitrageOpportunities.sort((a, b) => {
        const profitA = parseFloat(a.profitLoss);
        const profitB = parseFloat(b.profitLoss);
        return profitB - profitA;
      });

      // Find best profitable opportunity
      const bestProfitable = arbitrageOpportunities.find(opp => opp.isProfit);
      const bestOverall = arbitrageOpportunities[0];

      // Calculate statistics
      const profitableCount = arbitrageOpportunities.filter(opp => opp.isProfit).length;
      const totalOpportunities = arbitrageOpportunities.length;

      return {
        success: true,
        pair: `${token1Info.symbol}/${token2Info.symbol}`,
        token1: {
          symbol: token1Info.symbol,
          address: token1Info.address,
          decimals: token1Info.decimals
        },
        token2: {
          symbol: token2Info.symbol,
          address: token2Info.address,
          decimals: token2Info.decimals
        },
        initialAmount: amountIn,
        dexesAnalyzed: dexNames,
        summary: {
          totalOpportunities,
          profitableOpportunities: profitableCount,
          hasArbitrage: profitableCount > 0,
          bestProfit: bestProfitable ? bestProfitable.profitLoss : null,
          bestProfitPercentage: bestProfitable ? bestProfitable.profitLossPercentage : null,
          bestProfitPath: bestProfitable ? bestProfitable.path : null
        },
        bestProfitableOpportunity: bestProfitable || null,
        bestOverallOpportunity: bestOverall,
        allOpportunities: arbitrageOpportunities,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to analyze arbitrage', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Scan all token pairs for arbitrage opportunities
   * @param {Object} params - Scan parameters
   * @returns {Promise<Object>} - Arbitrage scan results
   */
  async scanAllPairsForArbitrage(params) {
    try {
      const { dexName: dexNames, amountIn, slippage, minProfitPercentage = 0.1 } = params;

      this.logger.info('Starting arbitrage scan across all token pairs', {
        dexes: dexNames,
        amountIn,
        minProfitPercentage: `${minProfitPercentage}%`
      });

      // Get all tokens from registry
      const allTokens = this.tokenResolver.getAllTokens();

      if (allTokens.length < 2) {
        return {
          success: false,
          error: 'Not enough tokens in registry for pair scanning',
          timestamp: Date.now()
        };
      }

      // Generate all unique pairs
      const tokenPairs = [];
      for (let i = 0; i < allTokens.length; i++) {
        for (let j = i + 1; j < allTokens.length; j++) {
          tokenPairs.push({
            token1: allTokens[i],
            token2: allTokens[j]
          });
        }
      }

      this.logger.info(`Scanning ${tokenPairs.length} token pairs`, {
        totalTokens: allTokens.length,
        totalPairs: tokenPairs.length
      });

      const scanResults = [];
      const profitableOpportunities = [];
      let scannedCount = 0;
      let errorCount = 0;

      // Scan each pair (with rate limiting to avoid overwhelming the system)
      for (const pair of tokenPairs) {
        try {
          scannedCount++;

          this.logger.debug(`Scanning pair ${scannedCount}/${tokenPairs.length}`, {
            pair: `${pair.token1.symbol}/${pair.token2.symbol}`
          });

          const analysis = await this.getArbitrageAnalysis({
            token1: pair.token1.symbol,
            token2: pair.token2.symbol,
            dexName: dexNames,
            amountIn,
            slippage
          });

          if (analysis.success) {
            const result = {
              pair: analysis.pair,
              token1: analysis.token1,
              token2: analysis.token2,
              hasArbitrage: analysis.summary.hasArbitrage,
              bestProfit: analysis.summary.bestProfit,
              bestProfitPercentage: analysis.summary.bestProfitPercentage,
              bestProfitPath: analysis.summary.bestProfitPath,
              totalOpportunities: analysis.summary.totalOpportunities,
              opportunity: analysis.bestProfitableOpportunity
            };

            scanResults.push(result);

            // Check if profitable and meets minimum threshold
            if (analysis.summary.hasArbitrage && analysis.bestProfitableOpportunity) {
              const profitPercent = parseFloat(analysis.bestProfitableOpportunity.profitLossPercentage);
              if (profitPercent >= minProfitPercentage) {
                profitableOpportunities.push({
                  ...result,
                  opportunity: analysis.bestProfitableOpportunity
                });
              }
            }
          } else {
            errorCount++;
            this.logger.debug('Failed to analyze pair', {
              pair: `${pair.token1.symbol}/${pair.token2.symbol}`,
              error: analysis.error
            });
          }

          // Small delay to avoid overwhelming the RPC
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          errorCount++;
          this.logger.error('Error scanning pair', {
            pair: `${pair.token1.symbol}/${pair.token2.symbol}`,
            error: error.message
          });
        }
      }

      // Sort profitable opportunities by profit percentage
      profitableOpportunities.sort((a, b) => {
        const profitA = parseFloat(a.bestProfitPercentage || '0');
        const profitB = parseFloat(b.bestProfitPercentage || '0');
        return profitB - profitA;
      });

      // Clean expired opportunities before adding new ones
      this._cleanExpiredOpportunities();

      // Add unique IDs to all results with arbitrage and cache them
      const allResultsWithIds = scanResults.filter(r => r.hasArbitrage).map(result => {
        const id = this._cacheArbitrageOpportunity({
          ...result,
          scanParams: { dexNames, amountIn, slippage, minProfitPercentage }
        });
        return { ...result, id };
      });

      // Add IDs to profitable opportunities as well
      const profitableWithIds = profitableOpportunities.slice(0, 20).map(result => {
        // Check if already cached (should be)
        const cached = Array.from(this.arbitrageCache.values()).find(
          c => c.pair === result.pair && c.bestProfitPath === result.bestProfitPath
        );
        return { ...result, id: cached?.id || this._cacheArbitrageOpportunity(result) };
      });

      this.logger.info('Arbitrage scan completed', {
        totalPairs: tokenPairs.length,
        scanned: scannedCount,
        errors: errorCount,
        profitableFound: profitableOpportunities.length,
        cached: this.arbitrageCache.size
      });

      return {
        success: true,
        scan: {
          totalPairs: tokenPairs.length,
          scannedPairs: scannedCount,
          errorCount,
          profitableOpportunities: profitableOpportunities.length,
          minProfitThreshold: `${minProfitPercentage}%`,
          cachedOpportunities: this.arbitrageCache.size
        },
        dexesAnalyzed: dexNames,
        initialAmount: amountIn,
        profitableOpportunities: profitableWithIds,
        allResults: allResultsWithIds,
        timestamp: Date.now()
      };
    } catch (error) {
      this.logger.error('Failed to scan for arbitrage', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Execute arbitrage opportunity by ID
   * @param {Object} params - Execution parameters
   * @param {string} params.arbitrageId - Arbitrage opportunity ID
   * @param {string} params.privateKey - Private key for signing transactions
   * @param {string} [params.amountIn] - Optional: Override amount (uses cached amount if not provided)
   * @param {number} [params.slippage] - Optional: Override slippage
   * @returns {Promise<Object>} - Execution result with both swap transactions
   */
  async executeArbitrageById(params) {
    try {
      const { arbitrageId, privateKey, amountIn: overrideAmount, slippage: overrideSlippage } = params;

      // Get cached opportunity
      const opportunity = this.getArbitrageOpportunity(arbitrageId);

      if (!opportunity) {
        return {
          success: false,
          error: 'Arbitrage opportunity not found or expired',
          message: 'The arbitrage ID is invalid or the opportunity has expired (TTL: 5 minutes)',
          arbitrageId
        };
      }

      this.logger.info('Executing arbitrage by ID', {
        id: arbitrageId,
        pair: opportunity.pair,
        path: opportunity.bestProfitPath,
        expectedProfit: opportunity.bestProfit
      });

      // Extract swap details from opportunity
      const { token1, token2, opportunity: arbDetails } = opportunity;

      if (!arbDetails) {
        return {
          success: false,
          error: 'Invalid opportunity structure',
          message: 'Arbitrage opportunity is missing execution details'
        };
      }

      const { swapADetails, swapBDetails } = arbDetails;
      const amountIn = overrideAmount || opportunity.scanParams?.amountIn || swapADetails.amountIn;
      const slippage = overrideSlippage || opportunity.scanParams?.slippage;

      // Execute first swap (A)
      this.logger.info('Executing swap A', {
        dex: swapADetails.dex,
        from: swapADetails.from,
        to: swapADetails.to,
        amount: amountIn
      });

      const swapAResult = await this.executeSwap({
        dexName: swapADetails.dex,
        tokenIn: token1.address,
        tokenOut: token2.address,
        amountIn: amountIn,
        tokenInDecimals: token1.decimals,
        tokenOutDecimals: token2.decimals,
        tokenInSymbol: token1.symbol,
        tokenOutSymbol: token2.symbol,
        privateKey,
        slippage
      });

      if (!swapAResult.success) {
        return {
          success: false,
          error: 'First swap failed',
          swapA: swapAResult,
          arbitrageId
        };
      }

      // Use actual output from swap A for swap B
      const actualAmountOut = swapAResult.amountOut || swapBDetails.amountIn;

      this.logger.info('Executing swap B', {
        dex: swapBDetails.dex,
        from: swapBDetails.from,
        to: swapBDetails.to,
        amount: actualAmountOut
      });

      // Execute second swap (B)
      const swapBResult = await this.executeSwap({
        dexName: swapBDetails.dex,
        tokenIn: token2.address,
        tokenOut: token1.address,
        amountIn: actualAmountOut,
        tokenInDecimals: token2.decimals,
        tokenOutDecimals: token1.decimals,
        tokenInSymbol: token2.symbol,
        tokenOutSymbol: token1.symbol,
        privateKey,
        slippage
      });

      if (!swapBResult.success) {
        return {
          success: false,
          error: 'Second swap failed (first swap succeeded)',
          swapA: swapAResult,
          swapB: swapBResult,
          warning: 'You may have partial position. Check your wallet.',
          arbitrageId
        };
      }

      // Calculate actual profit/loss
      const finalAmount = parseFloat(swapBResult.amountOut);
      const initialAmount = parseFloat(amountIn);
      const actualProfit = finalAmount - initialAmount;
      const actualProfitPercentage = ((actualProfit / initialAmount) * 100).toFixed(4);

      // Remove from cache after successful execution
      this.arbitrageCache.delete(arbitrageId);

      this.logger.info('Arbitrage executed successfully', {
        id: arbitrageId,
        pair: opportunity.pair,
        initialAmount: amountIn,
        finalAmount: finalAmount.toFixed(token1.decimals),
        actualProfit: actualProfit.toFixed(token1.decimals),
        actualProfitPercentage: `${actualProfitPercentage}%`,
        expectedProfit: opportunity.bestProfit,
        expectedProfitPercentage: opportunity.bestProfitPercentage
      });

      return {
        success: true,
        arbitrageId,
        pair: opportunity.pair,
        path: opportunity.bestProfitPath,
        swapA: swapAResult,
        swapB: swapBResult,
        profitAnalysis: {
          initialAmount: amountIn,
          finalAmount: finalAmount.toFixed(token1.decimals),
          actualProfit: actualProfit.toFixed(token1.decimals),
          actualProfitPercentage: `${actualProfitPercentage}%`,
          expectedProfit: opportunity.bestProfit,
          expectedProfitPercentage: opportunity.bestProfitPercentage,
          profitToken: token1.symbol,
          slippage: actualProfit < parseFloat(opportunity.bestProfit) ?
            `Slippage: ${((parseFloat(opportunity.bestProfit) - actualProfit) / parseFloat(opportunity.bestProfit) * 100).toFixed(2)}%` :
            'Better than expected'
        },
        timestamp: Date.now()
      };

    } catch (error) {
      this.logger.error('Failed to execute arbitrage by ID', error);
      return {
        success: false,
        error: error.message,
        timestamp: Date.now()
      };
    }
  }

  /**
   * Calculate price impact (simplified)
   */
  _calculatePriceImpact(amountIn, amountOut, params) {
    try {
      // This is a simplified calculation
      // Real price impact would require reserve data
      return 'N/A';
    } catch (error) {
      return 'N/A';
    }
  }

  /**
   * Get available routers
   */
  getAvailableRouters() {
    return Array.from(this.routers.keys());
  }

  /**
   * Get executor statistics
   */
  getStats() {
    const successRate = this.stats.totalSwaps > 0
      ? ((this.stats.successfulSwaps / this.stats.totalSwaps) * 100).toFixed(2)
      : '0';

    return {
      ...this.stats,
      successRate: `${successRate}%`,
      availableRouters: this.routers.size
    };
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.stats = {
      totalSwaps: 0,
      successfulSwaps: 0,
      failedSwaps: 0,
      totalVolumeUSD: 0
    };
  }
}

export default SwapExecutor;
