import { Contract, parseUnits, formatUnits, Wallet, MaxUint256 } from 'ethers';
import Logger from '../utils/logger.js';
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
      ...options
    };

    this.logger = new Logger('SwapExecutor');
    this.routers = new Map();

    this.stats = {
      totalSwaps: 0,
      successfulSwaps: 0,
      failedSwaps: 0,
      totalVolumeUSD: 0
    };
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
