# Pair Filtering Configuration Examples

This document provides practical examples for configuring `supportedPairs` and `unsupportedPairs` in different scenarios.

## Understanding the Filtering Logic

The system provides three filtering modes:

1. **Whitelist Mode** - Use `supportedPairs` to define ONLY the pairs to query
2. **Blacklist Mode** - Use `unsupportedPairs` to define pairs to skip
3. **Override Mode** - Use `useUnsupportedOnly: true` to force blacklist mode even when whitelist is defined

## Configuration Examples

### Example 1: No Filtering (Default)

Query all pairs - no restrictions.

```javascript
{
  name: "QuickSwap",
  address: "0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff",
  enabled: true,
  supportedPairs: [],      // Empty - no whitelist
  unsupportedPairs: []     // Empty - no blacklist
}
```

**Result:** All pairs will be queried.

**Use case:** Initial setup, discovery phase, or DEXes with comprehensive support.

---

### Example 2: Blacklist Mode (Skip Known Unsupported Pairs)

Query all pairs except those explicitly unsupported.

```javascript
{
  name: "ApeSwap",
  address: "0xC0788A3aD43d79aa53B09c2EaCc313A787d1d607",
  enabled: true,
  supportedPairs: [],      // Empty - use blacklist instead
  unsupportedPairs: [
    "USDC/AAVE",
    "WETH/LINK",
    "LINK/CRV",
    "DAI/GHST"
  ]
}
```

**Result:** All pairs EXCEPT `USDC/AAVE`, `WETH/LINK`, `LINK/CRV`, and `DAI/GHST` will be queried.

**Use case:** DEXes with broad support but some known gaps.

---

### Example 3: Whitelist Mode (Only Query Supported Pairs)

Query ONLY the explicitly supported pairs.

```javascript
{
  name: "JetSwap",
  address: "0x5C6EC38fb0e2609672BDf628B1fD605A523E5923",
  enabled: true,
  supportedPairs: [
    "USDC/WPOL",
    "WETH/USDC",
    "DAI/USDC",
    "USDT/WPOL"
  ],
  unsupportedPairs: [      // This is IGNORED when supportedPairs is defined
    "LINK/CRV"             // Will have no effect
  ]
}
```

**Result:** ONLY `USDC/WPOL`, `WETH/USDC`, `DAI/USDC`, and `USDT/WPOL` will be queried.

**Use case:** DEXes with limited pair support, high-liquidity pairs only.

---

### Example 4: Mixed Configuration (Both Lists Defined)

When both lists are defined, `supportedPairs` takes priority by default.

```javascript
{
  name: "Polycat Finance",
  address: "0x94930a328162957FF1dd48900aF67B5439336cBD",
  enabled: true,
  supportedPairs: [        // Priority: whitelist
    "USDC/WPOL",
    "WETH/USDC"
  ],
  unsupportedPairs: [      // IGNORED (unless useUnsupportedOnly: true)
    "LINK/CRV",
    "AAVE/UNI"
  ]
}
```

**Default behavior:** Only `USDC/WPOL` and `WETH/USDC` will be queried.

**With `useUnsupportedOnly: true`:** All pairs EXCEPT `LINK/CRV` and `AAVE/UNI` will be queried (whitelist is ignored).

**Use case:** Production uses whitelist, but you can temporarily test other pairs using the override.

---

## API Request Examples

### Example 5: Using Default Filter (Whitelist)

```bash
curl -X POST http://localhost:30000/api/v1/swap/quote \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "USDC/WPOL",
    "dexName": ["QuickSwap", "JetSwap"],
    "amountIn": "1000"
  }'
```

**Result:**
- QuickSwap: Queries if `USDC/WPOL` is in supportedPairs or if supportedPairs is empty
- JetSwap: Queries if `USDC/WPOL` is in supportedPairs (from Example 3)

---

### Example 6: Override to Use Blacklist

```bash
curl -X POST http://localhost:30000/api/v1/swap/quote \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "WETH/LINK",
    "dexName": ["Polycat Finance"],
    "amountIn": "1",
    "useUnsupportedOnly": true
  }'
```

**Result:**
- Polycat Finance: Ignores `supportedPairs` whitelist, uses `unsupportedPairs` blacklist instead
- `WETH/LINK` will NOT be queried if it's in the unsupportedPairs list

**Use case:** You want to test a pair that's not in the whitelist, or scan beyond the whitelist temporarily.

---

### Example 7: Arbitrage Scan with Filtering

```bash
curl -X POST http://localhost:30000/api/v1/swap/scan-arbitrage \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "dexName": ["QuickSwap", "SushiSwap", "JetSwap"],
    "amountIn": "1000",
    "minProfitPercentage": 0.5
  }'
```

**Result:**
- QuickSwap: Uses its filter configuration
- SushiSwap: Uses its filter configuration
- JetSwap: Only scans pairs in its `supportedPairs` list

**Performance:** If JetSwap has only 5 supported pairs, it will skip 185+ pairs (assuming 190 total), dramatically reducing scan time.

---

## Real-World Scenarios

### Scenario 1: Initial Setup (Discovery Phase)

Start with no filters to discover which pairs work:

```javascript
dexRouters: [
  {
    name: "QuickSwap",
    enabled: true,
    supportedPairs: [],
    unsupportedPairs: []
  },
  {
    name: "SushiSwap",
    enabled: true,
    supportedPairs: [],
    unsupportedPairs: []
  }
]
```

Run a scan, then use the `unsupportedPairs` output to populate your blacklist.

---

### Scenario 2: Production (Optimized)

After discovery, use whitelists for tight control:

```javascript
dexRouters: [
  {
    name: "QuickSwap",
    enabled: true,
    supportedPairs: [
      "USDC/WPOL",
      "WETH/USDC",
      "DAI/USDC",
      "USDT/WPOL",
      "WETH/WPOL"
    ],
    unsupportedPairs: []  // Not needed, whitelist handles everything
  },
  {
    name: "SushiSwap",
    enabled: true,
    supportedPairs: [
      "USDC/WPOL",
      "WETH/USDC",
      "WETH/WPOL"
    ],
    unsupportedPairs: []
  }
]
```

**Performance gain:** If you have 190 total pairs but only 5 supported per DEX:
- Before: 190 × 2 DEXes × 2 directions = 760 RPC calls
- After: 5 × 2 DEXes × 2 directions = 20 RPC calls
- **97% reduction!**

---

### Scenario 3: Hybrid Approach (Most Common)

Use whitelist for one DEX, blacklist for another:

```javascript
dexRouters: [
  {
    name: "QuickSwap",
    enabled: true,
    // QuickSwap has broad support - use blacklist
    supportedPairs: [],
    unsupportedPairs: [
      "LINK/CRV",
      "AAVE/UNI",
      "GHST/SAND"
    ]
  },
  {
    name: "ApeSwap",
    enabled: true,
    // ApeSwap has limited support - use whitelist
    supportedPairs: [
      "USDC/WPOL",
      "WETH/USDC",
      "BANANA/WPOL"
    ],
    unsupportedPairs: []
  }
]
```

**Result:**
- QuickSwap: Queries most pairs, skips only 3
- ApeSwap: Queries only 3 specific pairs

---

### Scenario 4: Testing New Pairs

You have a whitelist in production but want to test a new pair:

**Config:**
```javascript
{
  name: "QuickSwap",
  supportedPairs: ["USDC/WPOL", "WETH/USDC"],
  unsupportedPairs: ["LINK/CRV", "AAVE/UNI"]
}
```

**Test request:**
```bash
curl -X POST http://localhost:30000/api/v1/swap/quote \
  -H "X-API-Key: your-api-key" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "DAI/USDT",
    "dexName": ["QuickSwap"],
    "amountIn": "1000",
    "useUnsupportedOnly": true
  }'
```

**Result:**
- `DAI/USDT` will be queried because:
  1. `useUnsupportedOnly: true` disables the whitelist
  2. `DAI/USDT` is not in the blacklist
  3. Therefore it's allowed

---

## Decision Tree

```
Start
  │
  ├─> Is supportedPairs defined (non-empty)?
  │   ├─> YES: Is useUnsupportedOnly = true?
  │   │   ├─> YES: Use blacklist (unsupportedPairs)
  │   │   └─> NO:  Use whitelist (supportedPairs)
  │   │
  │   └─> NO: Is unsupportedPairs defined (non-empty)?
  │       ├─> YES: Use blacklist (unsupportedPairs)
  │       └─> NO:  Query everything (no filtering)
```

## Best Practices

1. **Start Broad** - Begin with no filters or blacklist only
2. **Collect Data** - Run scans to identify unsupported pairs
3. **Optimize Gradually** - Move to whitelists for DEXes with limited support
4. **Document** - Add comments explaining why pairs are filtered
5. **Test Override** - Use `useUnsupportedOnly` for testing without changing config
6. **Update Regularly** - DEXes add liquidity - review quarterly

## Summary Table

| Configuration | supportedPairs | unsupportedPairs | useUnsupportedOnly | Behavior |
|--------------|----------------|------------------|-------------------|----------|
| No filtering | empty | empty | false | Query all pairs |
| Blacklist | empty | defined | false | Query all except blacklist |
| Whitelist | defined | any | false | Query only whitelist |
| Override | defined | defined | true | Query all except blacklist (whitelist ignored) |

## Tips

- Use **whitelist** when you want strict control (e.g., 5 known good pairs)
- Use **blacklist** when you want flexibility (e.g., skip 5 known bad pairs)
- Use **override** for temporary testing without changing config
- Remember: pairs match in **both directions** (USDC/WPOL = WPOL/USDC)
- All matching is **case-insensitive**
