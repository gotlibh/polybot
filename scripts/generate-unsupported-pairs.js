#!/usr/bin/env node

/**
 * Generate Unsupported Pairs Configuration
 *
 * This script reads arbitrage scan results and generates a configuration
 * snippet for unsupported pairs grouped by DEX.
 *
 * Usage:
 *   node scripts/generate-unsupported-pairs.js scan_results.json
 *   node scripts/generate-unsupported-pairs.js scan_results.json --format=js
 *   node scripts/generate-unsupported-pairs.js scan_results.json --format=json
 */

import { readFileSync } from 'fs';

// Parse command line arguments
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Error: Missing input file');
  console.error('Usage: node scripts/generate-unsupported-pairs.js <scan_results.json> [--format=js|json]');
  process.exit(1);
}

const inputFile = args[0];
const format = args.find(arg => arg.startsWith('--format='))?.split('=')[1] || 'js';

if (!['js', 'json'].includes(format)) {
  console.error('Error: Format must be "js" or "json"');
  process.exit(1);
}

// Read scan results
let scanResults;
try {
  const fileContent = readFileSync(inputFile, 'utf-8');
  scanResults = JSON.parse(fileContent);
} catch (error) {
  console.error(`Error reading file: ${error.message}`);
  process.exit(1);
}

// Extract unsupported pairs
if (!scanResults.unsupportedPairs || !scanResults.unsupportedPairs.byDex) {
  console.log('No unsupported pairs found in scan results.');
  process.exit(0);
}

const unsupportedByDex = scanResults.unsupportedPairs.byDex;

// Build unique pairs per DEX (avoid duplicates from both directions)
const dexPairs = {};
for (const [dexName, pairs] of Object.entries(unsupportedByDex)) {
  const uniquePairs = new Set();

  pairs.forEach(item => {
    // Normalize pair (always use alphabetical order to avoid duplicates)
    const [token1, token2] = item.pair.split('/').sort();
    uniquePairs.add(`${token1}/${token2}`);
  });

  dexPairs[dexName] = Array.from(uniquePairs).sort();
}

// Generate output
console.log('/**');
console.log(' * Generated Unsupported Pairs Configuration');
console.log(` * Generated from: ${inputFile}`);
console.log(` * Date: ${new Date().toISOString()}`);
console.log(` * Total unsupported pairs: ${scanResults.unsupportedPairs.total}`);
console.log(' * ');
console.log(' * Copy and paste the relevant sections into your src/config/default.js');
console.log(' */');
console.log('');

if (format === 'js') {
  // JavaScript format for config file
  console.log('dexRouters: [');

  for (const [dexName, pairs] of Object.entries(dexPairs)) {
    console.log('  {');
    console.log(`    name: "${dexName}",`);
    console.log('    address: "0x...",  // Add your DEX address here');
    console.log('    enabled: true,');

    if (pairs.length > 0) {
      console.log('    unsupportedPairs: [');
      pairs.forEach((pair, index) => {
        const comma = index < pairs.length - 1 ? ',' : '';
        console.log(`      "${pair}"${comma}`);
      });
      console.log('    ]');
    } else {
      console.log('    unsupportedPairs: []');
    }

    console.log('  },');
  }

  console.log(']');
} else {
  // JSON format
  console.log(JSON.stringify(dexPairs, null, 2));
}

console.log('');
console.log('// Summary:');
for (const [dexName, pairs] of Object.entries(dexPairs)) {
  console.log(`//   ${dexName}: ${pairs.length} unsupported pairs`);
}
console.log(`// Total: ${Object.values(dexPairs).reduce((sum, pairs) => sum + pairs.length, 0)} unique pairs`);
