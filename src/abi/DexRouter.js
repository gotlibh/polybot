/**
 * ABI definitions for DEX routers (Uniswap V2 compatible)
 * Used for querying prices and reserves from DEXes
 */

// Uniswap V2 Router interface (compatible with QuickSwap, SushiSwap, etc.)
export const UNISWAP_V2_ROUTER_ABI = [
  // Get output amount for a given input
  'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',

  // Get input amount for a desired output
  'function getAmountsIn(uint amountOut, address[] memory path) public view returns (uint[] memory amounts)',

  // Get factory address
  'function factory() external pure returns (address)',

  // Get WETH address
  'function WETH() external pure returns (address)',

  // Quote function - calculate optimal output given reserves
  'function quote(uint amountA, uint reserveA, uint reserveB) public pure returns (uint amountB)',

  // Get amount out with fee
  'function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) public pure returns (uint amountOut)',

  // Get amount in with fee
  'function getAmountIn(uint amountOut, uint reserveIn, uint reserveOut) public pure returns (uint amountIn)',

  // Swap functions
  'function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapTokensForExactTokens(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
  'function swapTokensForExactETH(uint amountOut, uint amountInMax, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapExactTokensForETH(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
  'function swapETHForExactTokens(uint amountOut, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)'
];

// Uniswap V2 Factory interface
export const UNISWAP_V2_FACTORY_ABI = [
  // Get pair address
  'function getPair(address tokenA, address tokenB) external view returns (address pair)',

  // Get all pairs length
  'function allPairsLength() external view returns (uint)',

  // Get pair at index
  'function allPairs(uint) external view returns (address pair)'
];

// Uniswap V2 Pair interface
export const UNISWAP_V2_PAIR_ABI = [
  // Get reserves
  'function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)',

  // Get token0
  'function token0() external view returns (address)',

  // Get token1
  'function token1() external view returns (address)',

  // Get price cumulative
  'function price0CumulativeLast() external view returns (uint)',
  'function price1CumulativeLast() external view returns (uint)',

  // Get pair name/symbol
  'function name() external view returns (string memory)',
  'function symbol() external view returns (string memory)',

  // Total supply
  'function totalSupply() external view returns (uint)'
];

// ERC20 interface for token info and operations
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'event Approval(address indexed owner, address indexed spender, uint256 value)',
  'event Transfer(address indexed from, address indexed to, uint256 value)'
];

export default {
  UNISWAP_V2_ROUTER_ABI,
  UNISWAP_V2_FACTORY_ABI,
  UNISWAP_V2_PAIR_ABI,
  ERC20_ABI
};
