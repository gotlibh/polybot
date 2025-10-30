# Transaction Data Decoding

## Overview

PolyBot now **automatically decodes transaction data** including:
- ✅ **Function signatures** - Which function is being called
- ✅ **Method names** - Human-readable function names
- ✅ **Parameters** - Decoded input parameters with types and values
- ✅ **Contract types** - Identifies Uniswap, ERC20, WETH, etc.
- ✅ **Transaction types** - Flags for swaps, transfers, liquidity operations

## What's Decoded

### Supported Contracts & Methods

#### ERC20 Token Standard
- `transfer(address to, uint256 amount)` - Transfer tokens
- `transferFrom(address from, address to, uint256 amount)` - Transfer tokens from approved address
- `approve(address spender, uint256 amount)` - Approve token spending

#### Uniswap V2 Router
- `swapExactTokensForTokens` - Swap exact input tokens for output tokens
- `swapTokensForExactTokens` - Swap input tokens for exact output tokens
- `swapExactETHForTokens` - Swap exact ETH for tokens
- `swapExactTokensForETH` - Swap exact tokens for ETH
- `swapETHForExactTokens` - Swap ETH for exact tokens
- `swapTokensForExactETH` - Swap tokens for exact ETH
- `addLiquidity` - Add liquidity to pool
- `addLiquidityETH` - Add ETH liquidity
- `removeLiquidity` - Remove liquidity from pool

#### Uniswap V3 Router
- `exactInputSingle` - Single-hop exact input swap
- `exactInput` - Multi-hop exact input swap

#### Uniswap V2 Pair
- `swap(uint256 amount0Out, uint256 amount1Out, address to, bytes data)` - Direct pair swap

#### WETH (Wrapped ETH)
- `deposit()` - Wrap ETH to WETH
- `withdraw(uint256 amount)` - Unwrap WETH to ETH

#### ERC721 (NFTs)
- `safeTransferFrom` - Safe NFT transfer

#### Other DeFi
- `multicall` - Batch multiple calls
- Seaport `fulfillBasicOrder` - NFT marketplace orders

## Example Output

### ERC20 Transfer
```
🔍 DECODED FUNCTION CALL
--------------------------------------------------------------------------------
Method         : ERC20.transfer
Contract Type  : ERC20
Description    : Transfer tokens to another address
Type Flags     : Token Transfer

Parameters:
  [1] to (address): 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  [2] amount (uint256): 1000000000000000000
```

### Uniswap Swap
```
🔍 DECODED FUNCTION CALL
--------------------------------------------------------------------------------
Method         : Uniswap V2.swapExactTokensForTokens
Contract Type  : Uniswap V2
Description    : Swap exact input tokens for output tokens
Type Flags     : DEX Swap

Parameters:
  [1] amountIn (uint256): 1000000000000000000
  [2] amountOutMin (uint256): 990000000000000000
  [3] path (address[]): [0xA0b86991..., 0x6B175474...]
  [4] to (address): 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
  [5] deadline (uint256): 1705334400
```

### Unknown Function
```
🔍 DECODED FUNCTION CALL
--------------------------------------------------------------------------------
Method         : Unknown (0x12345678)
Contract Type  : N/A
Description    : Unknown contract interaction
```

## Configuration

### Enable/Disable Decoding

Edit [src/config/default.js](src/config/default.js:51):

```javascript
output: {
  fields: {
    decodedData: true  // Show decoded function calls (default: true)
  }
}
```

### Customize Display Fields

```javascript
output: {
  decodedDataFields: ['methodName', 'contractType', 'description', 'parameters']
}
```

Available fields:
- `methodName` - Full method name (e.g., "ERC20.transfer")
- `contractType` - Contract type (e.g., "Uniswap V2")
- `description` - Human-readable description
- `parameters` - Decoded parameters array

## Using Decoded Data in Your Code

### Access Decoded Data

In [src/index.js](src/index.js:91-102), you can access decoded data:

```javascript
_handleTransaction(parsedTx, tokenTransfers) {
  // Check if this is a specific function call
  if (parsedTx.decodedData?.isKnown) {
    console.log('Function:', parsedTx.decodedData.methodName);
    console.log('Contract:', parsedTx.decodedData.contractType);

    // Access parameters
    if (parsedTx.decodedData.decodedParams) {
      parsedTx.decodedData.decodedParams.forEach(param => {
        console.log(`${param.name}: ${param.value}`);
      });
    }
  }
}
```

### Filter by Function Type

```javascript
_handleTransaction(parsedTx, tokenTransfers) {
  // Detect DEX swaps
  if (parsedTx.decodedData?.isSwap) {
    console.log('🔄 DEX Swap detected!');
    // Your arbitrage logic here
  }

  // Detect token transfers
  if (parsedTx.decodedData?.isTokenTransfer) {
    console.log('💸 Token Transfer detected!');
  }

  // Detect liquidity operations
  if (parsedTx.decodedData?.isLiquidityOp) {
    console.log('💧 Liquidity operation detected!');
  }
}
```

### Check Specific Methods

```javascript
_handleTransaction(parsedTx, tokenTransfers) {
  const method = parsedTx.decodedData?.methodName;

  switch(method) {
    case 'swapExactTokensForTokens':
      // Handle Uniswap V2 swap
      const amountIn = parsedTx.decodedData.decodedParams[0].value;
      const path = parsedTx.decodedData.decodedParams[2].value;
      console.log(`Swapping ${amountIn} tokens through path:`, path);
      break;

    case 'transfer':
      // Handle ERC20 transfer
      const to = parsedTx.decodedData.decodedParams[0].value;
      const amount = parsedTx.decodedData.decodedParams[1].value;
      console.log(`Transfer ${amount} to ${to}`);
      break;
  }
}
```

### Mempool Analysis (Pending Transactions)

```javascript
_handlePending(parsedTx) {
  // Analyze mempool transactions for frontrunning opportunities
  if (parsedTx.decodedData?.isSwap) {
    const method = parsedTx.decodedData.methodName;

    // Check if they're paying high gas
    if (parsedTx.maxFeePerGas > threshold) {
      console.log('🎯 High-gas swap in mempool!');
      console.log('Method:', method);

      // Extract swap details
      if (parsedTx.decodedData.decodedParams) {
        const params = parsedTx.decodedData.decodedParams;
        // Analyze for arbitrage opportunity
      }
    }
  }
}
```

## Advanced: Adding Custom Signatures

You can add your own function signatures:

```javascript
// In src/index.js or create a custom decoder

import DataDecoder from './utils/DataDecoder.js';

const decoder = new DataDecoder();

// Add custom signature
decoder.addSignature('0xabcdef12', {
  name: 'customFunction',
  params: ['address user', 'uint256 value'],
  contract: 'MyContract'
});

// Use in TransactionParser
this.parser.dataDecoder.addSignature(...);
```

## Method Signature Reference

Common signatures you'll see:

```
0xa9059cbb - ERC20.transfer(address,uint256)
0x23b872dd - ERC20.transferFrom(address,address,uint256)
0x095ea7b3 - ERC20.approve(address,uint256)

0x38ed1739 - Uniswap V2.swapExactTokensForTokens(...)
0x7ff36ab5 - Uniswap V2.swapExactETHForTokens(...)
0x18cbafe5 - Uniswap V2.swapExactTokensForETH(...)

0x022c0d9f - Uniswap V2 Pair.swap(...)

0xd0e30db0 - WETH.deposit()
0x2e1a7d4d - WETH.withdraw(uint256)

0xe8e33700 - Uniswap V2.addLiquidity(...)
0xbaa2abde - Uniswap V2.removeLiquidity(...)
```

You can look up unknown signatures at:
- https://www.4byte.directory/
- https://openchain.xyz/signatures

## Arbitrage Use Cases

### 1. Detect Large Swaps
```javascript
if (parsedTx.decodedData?.isSwap) {
  const amountIn = parsedTx.decodedData.decodedParams[0].value;
  if (BigInt(amountIn) > BigInt('1000000000000000000000')) { // > 1000 tokens
    console.log('🐋 Large swap detected! Potential arbitrage opportunity');
  }
}
```

### 2. Track Swap Paths
```javascript
if (parsedTx.decodedData?.methodName === 'swapExactTokensForTokens') {
  const path = parsedTx.decodedData.decodedParams[2].value; // address[]
  console.log('Swap path:', path);
  // Check if you can arbitrage this route on another DEX
}
```

### 3. Monitor Liquidity Changes
```javascript
if (parsedTx.decodedData?.isLiquidityOp) {
  console.log('Liquidity event:', parsedTx.decodedData.methodName);
  // Recalculate pool prices
}
```

### 4. Frontrun Detection
```javascript
_handlePending(parsedTx) {
  if (parsedTx.decodedData?.isSwap &&
      parsedTx.maxFeePerGas > highGasThreshold) {
    console.log('🎯 Potential frontrunning target');
    // Calculate if frontrunning is profitable
  }
}
```

### 5. Token Approval Monitoring
```javascript
if (parsedTx.decodedData?.methodName === 'approve') {
  const spender = parsedTx.decodedData.decodedParams[0].value;
  const amount = parsedTx.decodedData.decodedParams[1].value;
  console.log(`User approved ${amount} to ${spender}`);
  // User is about to interact with this contract
}
```

## Performance Notes

- **Decoding is fast**: Signature lookup is O(1), parameter decoding is optimized
- **No external calls**: All decoding happens locally, no API calls
- **Works in mempool**: Decode pending transactions before they're confirmed
- **Extensible**: Easy to add new signatures

## Limitations

- **Unknown functions**: Only known signatures in the database are decoded
- **Complex types**: Tuples and structs show as "[Complex Struct]"
- **No ABI required**: Works without contract ABIs (but less detailed)

To get more detailed decoding, you would need to:
1. Fetch contract ABI from Etherscan
2. Use ethers.js `Interface` class with full ABI
3. Decode with complete type information

## Future Enhancements

Possible additions:
- ABI fetching from Etherscan
- Value decoding (token amounts with decimals)
- Token symbol resolution
- USD value conversion
- More DEX protocols (SushiSwap, PancakeSwap, Curve, etc.)
- NFT marketplace protocols (OpenSea, Blur, LooksRare, etc.)
