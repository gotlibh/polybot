import { AbiCoder, Interface } from 'ethers';
import Logger from './logger.js';

/**
 * Decodes transaction data including method signatures and parameters
 * Includes common DeFi/DEX function signatures
 */
class DataDecoder {
  constructor() {
    this.logger = new Logger('DataDecoder');
    this.abiCoder = AbiCoder.defaultAbiCoder();

    // Common method signatures database
    // Format: { 'signature': { name, params } }
    this.knownSignatures = this._buildSignatureDatabase();
  }

  /**
   * Build database of common method signatures
   */
  _buildSignatureDatabase() {
    return {
      // ERC20 Standard
      '0xa9059cbb': {
        name: 'transfer',
        params: ['address to', 'uint256 amount'],
        contract: 'ERC20'
      },
      '0x23b872dd': {
        name: 'transferFrom',
        params: ['address from', 'address to', 'uint256 amount'],
        contract: 'ERC20'
      },
      '0x095ea7b3': {
        name: 'approve',
        params: ['address spender', 'uint256 amount'],
        contract: 'ERC20'
      },

      // Uniswap V2 Router
      '0x38ed1739': {
        name: 'swapExactTokensForTokens',
        params: ['uint256 amountIn', 'uint256 amountOutMin', 'address[] path', 'address to', 'uint256 deadline'],
        contract: 'Uniswap V2'
      },
      '0x8803dbee': {
        name: 'swapTokensForExactTokens',
        params: ['uint256 amountOut', 'uint256 amountInMax', 'address[] path', 'address to', 'uint256 deadline'],
        contract: 'Uniswap V2'
      },
      '0x7ff36ab5': {
        name: 'swapExactETHForTokens',
        params: ['uint256 amountOutMin', 'address[] path', 'address to', 'uint256 deadline'],
        contract: 'Uniswap V2'
      },
      '0x18cbafe5': {
        name: 'swapExactTokensForETH',
        params: ['uint256 amountIn', 'uint256 amountOutMin', 'address[] path', 'address to', 'uint256 deadline'],
        contract: 'Uniswap V2'
      },
      '0xfb3bdb41': {
        name: 'swapETHForExactTokens',
        params: ['uint256 amountOut', 'address[] path', 'address to', 'uint256 deadline'],
        contract: 'Uniswap V2'
      },
      '0x4a25d94a': {
        name: 'swapTokensForExactETH',
        params: ['uint256 amountOut', 'uint256 amountInMax', 'address[] path', 'address to', 'uint256 deadline'],
        contract: 'Uniswap V2'
      },

      // Uniswap V3 Router
      '0x414bf389': {
        name: 'exactInputSingle',
        params: ['tuple params'], // (address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)
        contract: 'Uniswap V3'
      },
      '0xc04b8d59': {
        name: 'exactInput',
        params: ['tuple params'], // (bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)
        contract: 'Uniswap V3'
      },

      // Uniswap V2 Pair
      '0x022c0d9f': {
        name: 'swap',
        params: ['uint256 amount0Out', 'uint256 amount1Out', 'address to', 'bytes data'],
        contract: 'Uniswap V2 Pair'
      },

      // WETH
      '0xd0e30db0': {
        name: 'deposit',
        params: [],
        contract: 'WETH'
      },
      '0x2e1a7d4d': {
        name: 'withdraw',
        params: ['uint256 amount'],
        contract: 'WETH'
      },

      // ERC721
      '0x42842e0e': {
        name: 'safeTransferFrom',
        params: ['address from', 'address to', 'uint256 tokenId'],
        contract: 'ERC721'
      },
      '0xb88d4fde': {
        name: 'safeTransferFrom',
        params: ['address from', 'address to', 'uint256 tokenId', 'bytes data'],
        contract: 'ERC721'
      },

      // Common DeFi
      '0xe8e33700': {
        name: 'addLiquidity',
        params: ['address tokenA', 'address tokenB', 'uint256 amountADesired', 'uint256 amountBDesired', 'uint256 amountAMin', 'uint256 amountBMin', 'address to', 'uint256 deadline'],
        contract: 'Uniswap V2'
      },
      '0xf305d719': {
        name: 'addLiquidityETH',
        params: ['address token', 'uint256 amountTokenDesired', 'uint256 amountTokenMin', 'uint256 amountETHMin', 'address to', 'uint256 deadline'],
        contract: 'Uniswap V2'
      },
      '0xbaa2abde': {
        name: 'removeLiquidity',
        params: ['address tokenA', 'address tokenB', 'uint256 liquidity', 'uint256 amountAMin', 'uint256 amountBMin', 'address to', 'uint256 deadline'],
        contract: 'Uniswap V2'
      },

      // Multicall
      '0xac9650d8': {
        name: 'multicall',
        params: ['bytes[] data'],
        contract: 'Multicall'
      },

      // OpenSea Seaport
      '0xfb0f3ee1': {
        name: 'fulfillBasicOrder',
        params: ['tuple parameters'],
        contract: 'Seaport'
      }
    };
  }

  /**
   * Decode transaction data
   * @param {string} data - Transaction data (0x...)
   * @returns {Object} Decoded information
   */
  decode(data) {
    if (!data || data === '0x' || data.length < 10) {
      return {
        methodSignature: null,
        methodName: null,
        decodedMethod: null,
        params: null,
        rawParams: null,
        isKnown: false
      };
    }

    const methodSignature = data.slice(0, 10);
    const paramsData = data.slice(10);

    const knownMethod = this.knownSignatures[methodSignature];

    if (!knownMethod) {
      return {
        methodSignature,
        methodName: 'Unknown',
        decodedMethod: `Unknown (${methodSignature})`,
        params: null,
        rawParams: paramsData,
        isKnown: false
      };
    }

    // Try to decode parameters
    let decodedParams = null;
    try {
      decodedParams = this._decodeParams(paramsData, knownMethod.params);
    } catch (error) {
      this.logger.debug(`Failed to decode params for ${methodSignature}`, error);
    }

    return {
      methodSignature,
      methodName: knownMethod.name,
      contractType: knownMethod.contract,
      decodedMethod: `${knownMethod.contract}.${knownMethod.name}`,
      params: knownMethod.params,
      decodedParams,
      rawParams: paramsData,
      isKnown: true
    };
  }

  /**
   * Decode parameters based on types
   */
  _decodeParams(paramsData, paramTypes) {
    if (!paramsData || paramsData === '0x' || paramTypes.length === 0) {
      return [];
    }

    try {
      // Extract just the types for ABI decoding
      const types = paramTypes.map(p => {
        // Handle "address to" -> "address"
        const type = p.split(' ')[0];
        return type;
      });

      // Decode using ethers ABI coder
      const decoded = this.abiCoder.decode(types, '0x' + paramsData);

      // Format decoded values with names
      return paramTypes.map((param, index) => {
        const [type, name] = param.split(' ');
        let value = decoded[index];

        // Format based on type
        if (type === 'address') {
          value = value.toString();
        } else if (type.startsWith('uint') || type.startsWith('int')) {
          value = value.toString();
        } else if (type === 'bytes' || type === 'bytes[]') {
          value = value.toString();
        } else if (type === 'address[]') {
          value = value.map(addr => addr.toString());
        } else if (type === 'tuple') {
          value = '[Complex Struct]'; // Tuples need specific handling
        }

        return {
          name: name || `param${index}`,
          type,
          value
        };
      });
    } catch (error) {
      this.logger.debug('Failed to decode params', error);
      return null;
    }
  }

  /**
   * Get human-readable summary of decoded data
   */
  createSummary(decodedData) {
    if (!decodedData.isKnown) {
      return {
        method: 'Unknown Function',
        signature: decodedData.methodSignature,
        description: 'Unknown contract interaction'
      };
    }

    const summary = {
      method: decodedData.decodedMethod,
      signature: decodedData.methodSignature,
      contract: decodedData.contractType,
      description: this._getMethodDescription(decodedData)
    };

    if (decodedData.decodedParams) {
      summary.parameters = decodedData.decodedParams;
    }

    return summary;
  }

  /**
   * Get human-readable description of method
   */
  _getMethodDescription(decodedData) {
    const { methodName, contractType, decodedParams } = decodedData;

    // Generate description based on method
    switch (methodName) {
      case 'transfer':
        return 'Transfer tokens to another address';
      case 'approve':
        return 'Approve token spending';
      case 'swapExactTokensForTokens':
        return 'Swap exact input tokens for output tokens';
      case 'swapTokensForExactTokens':
        return 'Swap input tokens for exact output tokens';
      case 'swapExactETHForTokens':
        return 'Swap exact ETH for tokens';
      case 'swapExactTokensForETH':
        return 'Swap exact tokens for ETH';
      case 'addLiquidity':
        return 'Add liquidity to pool';
      case 'removeLiquidity':
        return 'Remove liquidity from pool';
      case 'deposit':
        return 'Deposit ETH to WETH';
      case 'withdraw':
        return 'Withdraw WETH to ETH';
      case 'multicall':
        return 'Execute multiple calls in one transaction';
      default:
        return `${contractType} interaction`;
    }
  }

  /**
   * Check if this is a DEX swap
   */
  isSwap(decodedData) {
    return decodedData.methodName && decodedData.methodName.toLowerCase().includes('swap');
  }

  /**
   * Check if this is a token transfer
   */
  isTokenTransfer(decodedData) {
    return decodedData.methodName === 'transfer' || decodedData.methodName === 'transferFrom';
  }

  /**
   * Check if this is liquidity operation
   */
  isLiquidityOperation(decodedData) {
    const method = decodedData.methodName?.toLowerCase() || '';
    return method.includes('liquidity');
  }

  /**
   * Add custom method signature
   */
  addSignature(signature, methodInfo) {
    this.knownSignatures[signature] = methodInfo;
    this.logger.info(`Added custom signature: ${signature} -> ${methodInfo.name}`);
  }

  /**
   * Get all known signatures
   */
  getKnownSignatures() {
    return { ...this.knownSignatures };
  }
}

export default DataDecoder;
