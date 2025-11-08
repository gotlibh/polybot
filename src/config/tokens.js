/**
 * Token Registry for Polygon Network
 * Maps token symbols to addresses and metadata
 */

export default {
  // Stablecoins
  USDC: {
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    symbol: "USDC",
    name: "USD Coin (PoS)",
    decimals: 6,
    type: "stablecoin",
  },
  USDT: {
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    symbol: "USDT",
    name: "Tether USD (PoS)",
    decimals: 6,
    type: "stablecoin",
  },
  DAI: {
    address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    symbol: "DAI",
    name: "Dai Stablecoin (PoS)",
    decimals: 18,
    type: "stablecoin",
  },
  WPOL: {
    address: "0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270",
    symbol: "WPOL",
    name: "Wrapped POL",
    decimals: 18,
    type: "wrapped",
  },
  WETH: {
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    symbol: "WETH",
    name: "Wrapped Ether",
    decimals: 18,
    type: "wrapped",
  },
  WBTC: {
    address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6",
    symbol: "WBTC",
    name: "Wrapped BTC",
    decimals: 8,
    type: "wrapped",
  },

  // DeFi Tokens
  AAVE: {
    address: "0xD6DF932A45C0f255f85145f286eA0b292B21C90B",
    symbol: "AAVE",
    name: "Aave (PoS)",
    decimals: 18,
    type: "defi",
  },
  LINK: {
    address: "0x53E0bca35eC356BD5ddDFebbD1Fc0fD03FaBad39",
    symbol: "LINK",
    name: "ChainLink Token",
    decimals: 18,
    type: "defi",
  },
  UNI: {
    address: "0xb33EaAd8d922B1083446DC23f610c2567fB5180f",
    symbol: "UNI",
    name: "Uniswap (PoS)",
    decimals: 18,
    type: "defi",
  },
  SUSHI: {
    address: "0x0b3F868E0BE5597D5DB7fEB59E1CADBb0fdDa50a",
    symbol: "SUSHI",
    name: "SushiToken (PoS)",
    decimals: 18,
    type: "defi",
  },
  CRV: {
    address: "0x172370d5Cd63279eFa6d502DAB29171933a610AF",
    symbol: "CRV",
    name: "CRV (PoS)",
    decimals: 18,
    type: "defi",
  },

  // // Gaming & Metaverse
  GHST: {
    address: "0x385Eeac5cB85A38A9a07A70c73e0a3271CfB54A7",
    symbol: "GHST",
    name: "Aavegotchi GHST Token",
    decimals: 18,
    type: "gaming",
  },
  SAND: {
    address: "0xBbba073C31bF03b8ACf7c28EF0738DeCF3695683",
    symbol: "SAND",
    name: "SAND",
    decimals: 18,
    type: "gaming",
  },
  MANA: {
    address: "0xA1c57f48F0Deb89f569dFbE6E2B7f46D33606fD4",
    symbol: "MANA",
    name: "Decentraland MANA",
    decimals: 18,
    type: "gaming",
  },

  // Note: Native MATIC (0x0000000000000000000000000000000000001010) removed
  // Native tokens don't work with Uniswap V2-style DEX routers
  // Always use WMATIC for trading on DEXes
};
