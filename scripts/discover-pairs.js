#!/usr/bin/env node

/**
 * DEX Pair Discovery Script
 *
 * This script tests all token pairs against all DEXes to discover which pairs
 * are supported and which are not. It generates configuration for both
 * supportedPairs and unsupportedPairs arrays.
 *
 * Usage:
 *   node scripts/discover-pairs.js
 *   node scripts/discover-pairs.js --dex=QuickSwap
 *   node scripts/discover-pairs.js --dex=QuickSwap,SushiSwap
 *   node scripts/discover-pairs.js --output=supported  (generate supportedPairs)
 *   node scripts/discover-pairs.js --output=unsupported  (generate unsupportedPairs)
 *   node scripts/discover-pairs.js --test-amount=1
 */

import { JsonRpcProvider, Contract, parseUnits } from "ethers";
import config from "../src/config/default.js";
import tokens from "../src/config/tokens.js";
import { UNISWAP_V2_ROUTER_ABI } from "../src/abi/DexRouter.js";

// Parse command line arguments
const args = process.argv.slice(2);
const dexFilter = args
  .find((arg) => arg.startsWith("--dex="))
  ?.split("=")[1]
  ?.split(",");
const outputMode = args.find((arg) => arg.startsWith("--output="))?.split("=")[1] || "both";
const testAmount = args.find((arg) => arg.startsWith("--test-amount="))?.split("=")[1] || "1";

if (outputMode && !["supported", "unsupported", "both"].includes(outputMode)) {
  console.error('Error: --output must be "supported", "unsupported", or "both"');
  process.exit(1);
}

// Initialize provider
const rpcUrl = config.web3.rpcUrl || process.env.WEB3_RPC_URL;
if (!rpcUrl) {
  console.error("Error: RPC URL not configured");
  console.error("Set WEB3_RPC_URL environment variable or configure in src/config/default.js");
  process.exit(1);
}

const provider = new JsonRpcProvider(rpcUrl);

// Get enabled DEX routers
const enabledDexes = config.swap.dexRouters.filter((dex) => dex.enabled);

// Filter DEXes if specified
const dexesToTest = dexFilter
  ? enabledDexes.filter((dex) => dexFilter.includes(dex.name))
  : enabledDexes;

if (dexesToTest.length === 0) {
  console.error("Error: No DEXes to test");
  process.exit(1);
}

// Generate all token pairs
const tokenSymbols = Object.keys(tokens);
const tokenPairs = [];

for (let i = 0; i < tokenSymbols.length; i++) {
  for (let j = i + 1; j < tokenSymbols.length; j++) {
    tokenPairs.push({
      token1: tokenSymbols[i],
      token2: tokenSymbols[j],
      token1Address: tokens[tokenSymbols[i]].address,
      token2Address: tokens[tokenSymbols[j]].address,
      token1Decimals: tokens[tokenSymbols[i]].decimals,
      token2Decimals: tokens[tokenSymbols[j]].decimals,
    });
  }
}

console.log("╔════════════════════════════════════════════════════════════╗");
console.log("║         DEX Pair Discovery Script                         ║");
console.log("╚════════════════════════════════════════════════════════════╝");
console.log("");
console.log(`Network: ${config.web3.network || "Polygon"}`);
console.log(`RPC URL: ${rpcUrl.substring(0, 50)}...`);
console.log(`Test Amount: ${testAmount} tokens`);
console.log(`Output Mode: ${outputMode}`);
console.log(`DEXes to test: ${dexesToTest.map((d) => d.name).join(", ")}`);
console.log(`Total token pairs: ${tokenPairs.length}`);
console.log(`Total tests: ${tokenPairs.length * dexesToTest.length}`);
console.log("");
console.log("Starting discovery... This may take several minutes.");
console.log("");

// Test a single pair on a single DEX
async function testPair(dex, pair) {
  try {
    const router = new Contract(dex.address, UNISWAP_V2_ROUTER_ABI, provider);

    const amountInWei = parseUnits(testAmount, pair.token1Decimals);
    const path = [pair.token1Address, pair.token2Address];

    // Try to get amounts out - this will fail if pair doesn't exist
    const amountsOut = await router.getAmountsOut(amountInWei, path);

    // If we got here, the pair is supported
    return {
      supported: true,
      expectedOut: amountsOut[1].toString(),
    };
  } catch (error) {
    // Pair is not supported
    return {
      supported: false,
      error: error.message.substring(0, 100),
    };
  }
}

// Test all pairs for all DEXes
async function discoverPairs() {
  const results = {};

  for (const dex of dexesToTest) {
    console.log(`\n📊 Testing ${dex.name}...`);
    console.log(`   Address: ${dex.address}`);

    results[dex.name] = {
      address: dex.address,
      supported: [],
      unsupported: [],
      tested: 0,
      supportedCount: 0,
      unsupportedCount: 0,
    };

    // Test pairs in batches to avoid rate limits
    const batchSize = 10;
    for (let i = 0; i < tokenPairs.length; i += batchSize) {
      const batch = tokenPairs.slice(i, i + batchSize);

      const batchResults = await Promise.allSettled(
        batch.map((pair) => testPair(dex, pair))
      );

      for (let j = 0; j < batch.length; j++) {
        const pair = batch[j];
        const result = batchResults[j];

        const pairName = `${pair.token1}/${pair.token2}`;
        results[dex.name].tested++;

        if (result.status === "fulfilled" && result.value.supported) {
          results[dex.name].supported.push(pairName);
          results[dex.name].supportedCount++;
        } else {
          results[dex.name].unsupported.push(pairName);
          results[dex.name].unsupportedCount++;
        }

        // Show progress
        const progress = Math.round(
          (results[dex.name].tested / tokenPairs.length) * 100
        );
        process.stdout.write(
          `\r   Progress: ${progress}% (${results[dex.name].supportedCount} supported, ${results[dex.name].unsupportedCount} unsupported)`
        );
      }

      // Small delay between batches to avoid rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(""); // New line after progress
  }

  return results;
}

// Generate configuration output
function generateConfig(results) {
  console.log("\n");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                    Discovery Results                       ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  for (const [dexName, data] of Object.entries(results)) {
    console.log(`${dexName}:`);
    console.log(`  Supported: ${data.supportedCount} pairs`);
    console.log(`  Unsupported: ${data.unsupportedCount} pairs`);
    console.log(
      `  Success Rate: ${Math.round((data.supportedCount / data.tested) * 100)}%`
    );
    console.log("");
  }

  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                Generated Configuration                     ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");
  console.log("Copy and paste this into your src/config/default.js:");
  console.log("");
  console.log("dexRouters: [");

  for (const [dexName, data] of Object.entries(results)) {
    console.log("  {");
    console.log(`    name: "${dexName}",`);
    console.log(`    address: "${data.address}",`);
    console.log("    enabled: true,");
    console.log("");

    if (outputMode === "supported" || outputMode === "both") {
      if (data.supportedCount > 0) {
        console.log("    // Supported pairs (whitelist)");
        console.log("    supportedPairs: [");
        data.supported.forEach((pair, index) => {
          const comma = index < data.supported.length - 1 ? "," : "";
          console.log(`      "${pair}"${comma}`);
        });
        console.log("    ],");
      } else {
        console.log("    supportedPairs: [],");
      }
      console.log("");
    }

    if (outputMode === "unsupported" || outputMode === "both") {
      if (data.unsupportedCount > 0) {
        console.log("    // Unsupported pairs (blacklist)");
        console.log("    unsupportedPairs: [");
        data.unsupported.forEach((pair, index) => {
          const comma = index < data.unsupported.length - 1 ? "," : "";
          console.log(`      "${pair}"${comma}`);
        });
        console.log("    ]");
      } else {
        console.log("    unsupportedPairs: []");
      }
    }

    console.log("  },");
  }

  console.log("]");
  console.log("");
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                      Summary                               ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  const totalSupported = Object.values(results).reduce(
    (sum, data) => sum + data.supportedCount,
    0
  );
  const totalUnsupported = Object.values(results).reduce(
    (sum, data) => sum + data.unsupportedCount,
    0
  );
  const totalTests = totalSupported + totalUnsupported;

  console.log(`Total pairs tested: ${tokenPairs.length}`);
  console.log(`Total DEXes tested: ${Object.keys(results).length}`);
  console.log(`Total tests performed: ${totalTests}`);
  console.log(`Total supported: ${totalSupported}`);
  console.log(`Total unsupported: ${totalUnsupported}`);
  console.log(
    `Overall success rate: ${Math.round((totalSupported / totalTests) * 100)}%`
  );
  console.log("");

  // Recommendations
  console.log("╔════════════════════════════════════════════════════════════╗");
  console.log("║                    Recommendations                         ║");
  console.log("╚════════════════════════════════════════════════════════════╝");
  console.log("");

  for (const [dexName, data] of Object.entries(results)) {
    const successRate = Math.round((data.supportedCount / data.tested) * 100);

    if (successRate > 70) {
      console.log(
        `✅ ${dexName}: Use unsupportedPairs (blacklist) - high success rate (${successRate}%)`
      );
    } else if (successRate > 30) {
      console.log(
        `⚠️  ${dexName}: Consider either approach - moderate success rate (${successRate}%)`
      );
    } else {
      console.log(
        `📋 ${dexName}: Use supportedPairs (whitelist) - low success rate (${successRate}%)`
      );
    }
  }

  console.log("");
}

// Run discovery
try {
  const results = await discoverPairs();
  generateConfig(results);
} catch (error) {
  console.error("\n❌ Error during discovery:", error.message);
  process.exit(1);
}
