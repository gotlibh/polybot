/**
 * Address mappings and groups for PolyBot
 *
 * This file defines:
 * 1. Named addresses with optional tags/descriptions
 * 2. Address groups for filtering and organization
 *
 * Usage:
 * - Add addresses with human-readable names
 * - Organize addresses into groups (myAddresses, dexes, etc.)
 * - Reference groups in filter configuration
 */

export default {
  // Individual address mappings
  // Format: 'address': { name: 'Name', tags: ['tag1', 'tag2'], description: 'Optional description' }
  addresses: {
    // My Addresses
    "0xcdaA95C0c9859063614Ad9f9fd114B914B490B9c": {
      name: "My Wallet 1",
      tags: ["personal", "wallet"],
      description: "Primary trading wallet",
    },

    // DEX Routers
    "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff": {
      name: "QuickSwap Router",
      tags: ["dex", "quickswap", "router"],
      description: "QuickSwap V2 Router",
    },
    // "0x5757371414417b8c6caad45baef941abc7d3ab32": {
    "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F": {
      name: "SushiSwap Router",
      tags: ["dex", "sushiswap", "router"],
    },
    "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506": {
      name: "SushiSwap Factory",
      tags: ["dex", "sushiswap", "factory"],
    },
    "0x111111125421cA6dc452d289314280a0f8842a65": {
      name: "1inch Router",
      tags: ["dex", "aggregator", "1inch", "router"],
    },

    // Balancer
    "0xBA12222222228d8Ba445958a75a0704d566BF2C8": {
      name: "Balancer Vault",
      tags: ["dex", "balancer", "vault"],
    },

    // Uniswap
    "0xA102072A4C07F06EC3B4900FDC4C7B80B6C57429": {
      name: "Uniswap V3 Router",
      tags: ["dex", "uniswap", "router"],
    },

    // Other DEXes
    "0x2fA4334cfD7c56a0E7Ca02BD81455205FcBDc5E9": {
      name: "DODO Router",
      tags: ["dex", "dodo", "router"],
    },
    "0x1a1ec25DC08e98e5E93F1104B5e5cdD298707d31": {
      name: "Curve Router",
      tags: ["dex", "curve", "router"],
    },

    // Add more addresses here...
    // '0x...': { name: 'Name', tags: ['tag1', 'tag2'] },
  },

  // Address groups for easy reference in filters
  // Format: 'groupName': ['address1', 'address2', ...]
  groups: {
    myAddresses: [
      "0xcdaA95C0c9859063614Ad9f9fd114B914B490B9c",
      "0x2f5e87C9312fa29aed5c179E456625D79015299c",
      "0x4e68Ccd3E89f51C3074ca5072bbAC773960dFa36",
    ],

    quickswap: ["0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff"],

    sushiswap: [
      "0x5757371414417b8c6caad45baef941abc7d3ab32",
      "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
    ],

    uniswap: ["0xA102072A4C07F06EC3B4900FDC4C7B80B6C57429"],

    balancer: ["0xBA12222222228d8Ba445958a75a0704d566BF2C8"],

    aggregators: [
      "0x111111125421cA6dc452d289314280a0f8842a65", // 1inch
      "0x2fA4334cfD7c56a0E7Ca02BD81455205FcBDc5E9", // DODO
    ],

    allDexes: [
      "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff", // QuickSwap
      "0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F", // SushiSwap Router (new)
      "0x5757371414417b8c6caad45baef941abc7d3ab32", // SushiSwap Router
      "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506", // SushiSwap Factory
      "0x111111125421cA6dc452d289314280a0f8842a65", // 1inch
      "0xBA12222222228d8Ba445958a75a0704d566BF2C8", // Balancer
      "0xA102072A4C07F06EC3B4900FDC4C7B80B6C57429", // Uniswap V3
      "0x2fA4334cfD7c56a0E7Ca02BD81455205FcBDc5E9", // DODO
      "0x1a1ec25DC08e98e5E93F1104B5e5cdD298707d31", // Curve
    ],
  },
};
