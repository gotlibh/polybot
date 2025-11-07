import express from "express";
import Logger from "../utils/logger.js";
import SwapValidator from "../utils/SwapValidator.js";
import TokenResolver from "../utils/TokenResolver.js";

/**
 * SwapAPI - REST API for swap execution
 * Provides endpoints for executing swaps and getting quotes
 */
class SwapAPI {
  constructor(swapExecutor, provider, options = {}) {
    this.swapExecutor = swapExecutor;
    this.provider = provider;
    this.options = {
      port: options.port || 3000,
      host: options.host || "localhost",
      apiKey: options.apiKey || null, // API key for authentication
      rateLimit: options.rateLimit || { maxRequests: 100, windowMs: 60000 }, // 100 requests per minute
      ...options,
    };

    this.logger = new Logger("SwapAPI");
    this.validator = new SwapValidator(options.validation || {});
    this.tokenResolver = new TokenResolver(provider);
    this.app = express();
    this.server = null;

    // Rate limiting state
    this.rateLimitState = new Map();

    this._setupMiddleware();
    this._setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  _setupMiddleware() {
    // Parse JSON bodies
    this.app.use(express.json());

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get("user-agent"),
      });
      next();
    });

    // API key authentication
    if (this.options.apiKey) {
      this.app.use((req, res, next) => {
        // Skip authentication for health check
        if (req.path === "/health") {
          return next();
        }

        const providedKey = req.headers["x-api-key"] || req.query.apiKey;
        if (providedKey !== this.options.apiKey) {
          this.logger.warn("Unauthorized API access attempt", {
            ip: req.ip,
            path: req.path,
          });
          return res.status(401).json({
            success: false,
            error: "Unauthorized",
            message: "Invalid or missing API key",
          });
        }
        next();
      });
    }

    // Rate limiting
    this.app.use((req, res, next) => {
      if (req.path === "/health") {
        return next();
      }

      const clientId = req.ip;
      const now = Date.now();
      const windowMs = this.options.rateLimit.windowMs;
      const maxRequests = this.options.rateLimit.maxRequests;

      // Get or create client state
      let clientState = this.rateLimitState.get(clientId);
      if (!clientState) {
        clientState = { requests: [], windowStart: now };
        this.rateLimitState.set(clientId, clientState);
      }

      // Clean old requests
      clientState.requests = clientState.requests.filter(
        (timestamp) => now - timestamp < windowMs
      );

      // Check rate limit
      if (clientState.requests.length >= maxRequests) {
        this.logger.warn("Rate limit exceeded", {
          ip: clientId,
          requests: clientState.requests.length,
        });
        return res.status(429).json({
          success: false,
          error: "Rate limit exceeded",
          message: `Maximum ${maxRequests} requests per ${
            windowMs / 1000
          } seconds`,
        });
      }

      // Add current request
      clientState.requests.push(now);
      next();
    });

    // Error handling
    this.app.use((err, req, res, next) => {
      this.logger.error("API error", err);
      res.status(500).json({
        success: false,
        error: "Internal server error",
        message: err.message,
      });
    });
  }

  /**
   * Setup API routes
   */
  _setupRoutes() {
    // Health check
    this.app.get("/health", (req, res) => {
      res.json({
        success: true,
        status: "healthy",
        timestamp: Date.now(),
        uptime: process.uptime(),
      });
    });

    // Get available routers
    this.app.get("/api/v1/routers", (req, res) => {
      try {
        const routers = this.swapExecutor.getAvailableRouters();
        res.json({
          success: true,
          routers,
          count: routers.length,
        });
      } catch (error) {
        this.logger.error("Failed to get routers", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get swap quote
    this.app.post("/api/v1/swap/quote", async (req, res) => {
      try {
        // Check if this is a token pair request (e.g., "WBTC/USDC")
        if (req.body.token && req.body.token.includes("/")) {
          // Parse token pair
          const [token1, token2] = req.body.token
            .split("/")
            .map((t) => t.trim());

          if (!token1 || !token2) {
            return res.status(400).json({
              success: false,
              error: "Invalid token pair format",
              message: 'Token pair must be in format "TOKEN1/TOKEN2"',
            });
          }

          // Check if multi-DEX
          const isMultiDex = Array.isArray(req.body.dexName);
          if (!isMultiDex) {
            return res.status(400).json({
              success: false,
              error: "Multi-DEX required for arbitrage analysis",
              message:
                'Token pair format requires multiple DEXes. Use: "dexName": ["QuickSwap", "SushiSwap"]',
            });
          }

          // Get arbitrage analysis
          const result = await this.swapExecutor.getArbitrageAnalysis({
            ...req.body,
            token1,
            token2,
          });

          return res.json(result);
        }

        // Normal quote flow
        // Normalize token identifiers (resolve symbols to addresses and get decimals)
        const normalizedParams = await this.tokenResolver.normalizeSwapParams(
          req.body
        );

        // Validate request
        const validation = this.validator.validateQuote(normalizedParams);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: "Validation failed",
            details: validation.errors,
          });
        }

        // Check if single or multi-DEX quote
        const isMultiDex = Array.isArray(normalizedParams.dexName);

        // Get quote(s)
        const quote = isMultiDex
          ? await this.swapExecutor.getMultiDexQuote(normalizedParams)
          : await this.swapExecutor.getSwapQuote(normalizedParams);

        res.json(quote);
      } catch (error) {
        this.logger.error("Failed to get quote", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Scan all pairs for arbitrage
    this.app.post("/api/v1/swap/scan-arbitrage", async (req, res) => {
      try {
        // Validate required fields
        if (!req.body.dexName || !Array.isArray(req.body.dexName)) {
          return res.status(400).json({
            success: false,
            error: "Invalid request",
            message: "dexName must be an array of DEX names",
          });
        }

        if (!req.body.amountIn) {
          return res.status(400).json({
            success: false,
            error: "Invalid request",
            message: "amountIn is required",
          });
        }

        this.logger.info("Starting arbitrage scan", {
          dexes: req.body.dexName,
          amountIn: req.body.amountIn,
          minProfitPercentage: req.body.minProfitPercentage || 0.1,
        });

        // Run the scan
        const result = await this.swapExecutor.scanAllPairsForArbitrage({
          dexName: req.body.dexName,
          amountIn: req.body.amountIn,
          slippage: req.body.slippage,
          minProfitPercentage: req.body.minProfitPercentage,
        });

        res.json(result);
      } catch (error) {
        this.logger.error("Failed to scan for arbitrage", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Execute arbitrage by ID
    this.app.post("/api/v1/swap/execute-arbitrage", async (req, res) => {
      try {
        const { arbitrageId, privateKey, amountIn, slippage } = req.body;

        // Validate required fields
        if (!arbitrageId) {
          return res.status(400).json({
            success: false,
            error: "Missing arbitrageId",
            message: "arbitrageId is required",
          });
        }

        if (!privateKey) {
          return res.status(400).json({
            success: false,
            error: "Missing privateKey",
            message: "privateKey is required for transaction signing",
          });
        }

        this.logger.info("Executing arbitrage by ID via API", {
          arbitrageId,
          amountInOverride: amountIn || "using cached",
          slippageOverride: slippage || "using cached",
        });

        // Execute arbitrage
        const result = await this.swapExecutor.executeArbitrageById({
          arbitrageId,
          privateKey,
          amountIn,
          slippage,
        });

        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        this.logger.error("Failed to execute arbitrage", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Execute swap
    this.app.post("/api/v1/swap/execute", async (req, res) => {
      try {
        // Normalize token identifiers (resolve symbols to addresses and get decimals)
        const normalizedParams = await this.tokenResolver.normalizeSwapParams(
          req.body
        );

        // Validate request
        const validation = this.validator.validate(normalizedParams);
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: "Validation failed",
            details: validation.errors,
          });
        }

        this.logger.info("Executing swap via API", {
          dex: normalizedParams.dexName,
          tokenIn: `${normalizedParams.tokenInSymbol} (${normalizedParams.tokenIn})`,
          tokenOut: `${normalizedParams.tokenOutSymbol} (${normalizedParams.tokenOut})`,
          amount: normalizedParams.amountIn,
        });

        // Execute swap
        const result = await this.swapExecutor.executeSwap(normalizedParams);

        if (result.success) {
          res.json(result);
        } else {
          res.status(400).json(result);
        }
      } catch (error) {
        this.logger.error("Failed to execute swap", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get executor stats
    this.app.get("/api/v1/stats", (req, res) => {
      try {
        const stats = this.swapExecutor.getStats();
        res.json({
          success: true,
          stats,
        });
      } catch (error) {
        this.logger.error("Failed to get stats", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Reset stats (protected endpoint)
    this.app.post("/api/v1/stats/reset", (req, res) => {
      try {
        this.swapExecutor.resetStats();
        res.json({
          success: true,
          message: "Statistics reset successfully",
        });
      } catch (error) {
        this.logger.error("Failed to reset stats", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get validator config
    this.app.get("/api/v1/config/validator", (req, res) => {
      try {
        const config = this.validator.getConfig();
        res.json({
          success: true,
          config,
        });
      } catch (error) {
        this.logger.error("Failed to get validator config", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get all tokens
    this.app.get("/api/v1/tokens", (req, res) => {
      try {
        const tokens = this.tokenResolver.getAllTokens();
        res.json({
          success: true,
          tokens,
          count: tokens.length,
        });
      } catch (error) {
        this.logger.error("Failed to get tokens", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Search tokens
    this.app.get("/api/v1/tokens/search", (req, res) => {
      try {
        const query = req.query.q || req.query.query;
        if (!query) {
          return res.status(400).json({
            success: false,
            error: "Query parameter required",
            message: "Use ?q=USDC or ?query=USDC",
          });
        }

        const results = this.tokenResolver.searchTokens(query);
        res.json({
          success: true,
          query,
          results,
          count: results.length,
        });
      } catch (error) {
        this.logger.error("Failed to search tokens", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Resolve token (get info by symbol or address)
    this.app.post("/api/v1/tokens/resolve", async (req, res) => {
      try {
        const { token } = req.body;
        if (!token) {
          return res.status(400).json({
            success: false,
            error: "Token identifier required",
            message:
              'Provide token symbol or address in request body: { "token": "USDC" }',
          });
        }

        const tokenInfo = await this.tokenResolver.resolve(token);
        res.json({
          success: true,
          token: tokenInfo,
        });
      } catch (error) {
        this.logger.error("Failed to resolve token", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // Get token balance(s) for an address
    this.app.post("/api/v1/balance", async (req, res) => {
      try {
        const { address, token } = req.body;

        // Validate address
        if (!address) {
          return res.status(400).json({
            success: false,
            error: "Address required",
            message:
              'Provide wallet address in request body: { "address": "0x..." }',
          });
        }

        // Import required utilities
        const { Contract, formatUnits, isAddress } = await import("ethers");
        const { ERC20_ABI } = await import("../abi/DexRouter.js");

        // Validate address format
        if (!isAddress(address)) {
          return res.status(400).json({
            success: false,
            error: "Invalid address",
            message: "Provided address is not a valid Ethereum address",
          });
        }

        // If token is specified, get balance for that token only
        if (token) {
          const tokenInfo = await this.tokenResolver.resolve(token);
          const tokenContract = new Contract(
            tokenInfo.address,
            ERC20_ABI,
            this.provider
          );
          const balance = await tokenContract.balanceOf(address);
          const balanceFormatted = formatUnits(balance, tokenInfo.decimals);

          return res.json({
            success: true,
            address,
            token: {
              symbol: tokenInfo.symbol,
              address: tokenInfo.address,
              name: tokenInfo.name,
              decimals: tokenInfo.decimals,
              balance: balanceFormatted,
              balanceRaw: balance.toString(),
            },
            timestamp: Date.now(),
          });
        }

        // If no token specified, get balances for all tokens in registry
        this.logger.info("Fetching all token balances", { address });

        const allTokens = this.tokenResolver.getAllTokens();
        const balancePromises = allTokens.map(async (tokenInfo) => {
          try {
            const tokenContract = new Contract(
              tokenInfo.address,
              ERC20_ABI,
              this.provider
            );
            const balance = await tokenContract.balanceOf(address);
            const balanceFormatted = formatUnits(balance, tokenInfo.decimals);
            const balanceNum = parseFloat(balanceFormatted);

            return {
              symbol: tokenInfo.symbol,
              address: tokenInfo.address,
              name: tokenInfo.name,
              decimals: tokenInfo.decimals,
              balance: balanceFormatted,
              balanceRaw: balance.toString(),
              hasBalance: balanceNum > 0,
            };
          } catch (error) {
            this.logger.debug(
              `Failed to fetch balance for ${tokenInfo.symbol}`,
              {
                error: error.message,
              }
            );
            return {
              symbol: tokenInfo.symbol,
              address: tokenInfo.address,
              name: tokenInfo.name,
              decimals: tokenInfo.decimals,
              balance: null,
              error: error.message,
            };
          }
        });

        const balances = await Promise.all(balancePromises);

        // Separate tokens with balance from those without
        const tokensWithBalance = balances.filter(
          (b) => b.hasBalance && !b.error
        );
        const tokensWithoutBalance = balances.filter(
          (b) => !b.hasBalance && !b.error
        );
        const tokensWithErrors = balances.filter((b) => b.error);

        res.json({
          success: true,
          address,
          summary: {
            totalTokens: allTokens.length,
            tokensWithBalance: tokensWithBalance.length,
            tokensWithoutBalance: tokensWithoutBalance.length,
            errors: tokensWithErrors.length,
          },
          balances: {
            withBalance: tokensWithBalance,
            withoutBalance: tokensWithoutBalance,
            errors: tokensWithErrors.length > 0 ? tokensWithErrors : undefined,
          },
          timestamp: Date.now(),
        });
      } catch (error) {
        this.logger.error("Failed to get balance", error);
        res.status(500).json({
          success: false,
          error: error.message,
        });
      }
    });

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        error: "Not found",
        message: `Route ${req.method} ${req.path} not found`,
      });
    });
  }

  /**
   * Start API server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(
          this.options.port,
          this.options.host,
          () => {
            this.logger.info("Swap API server started", {
              host: this.options.host,
              port: this.options.port,
              apiKeyRequired: !!this.options.apiKey,
            });
            resolve();
          }
        );

        this.server.on("error", (error) => {
          this.logger.error("API server error", error);
          reject(error);
        });
      } catch (error) {
        this.logger.error("Failed to start API server", error);
        reject(error);
      }
    });
  }

  /**
   * Stop API server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          this.logger.info("Swap API server stopped");
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Get server info
   */
  getInfo() {
    return {
      host: this.options.host,
      port: this.options.port,
      apiKeyRequired: !!this.options.apiKey,
      rateLimit: this.options.rateLimit,
      endpoints: [
        "GET /health",
        "GET /api/v1/routers",
        "POST /api/v1/swap/quote",
        "POST /api/v1/swap/scan-arbitrage",
        "POST /api/v1/swap/execute-arbitrage",
        "POST /api/v1/swap/execute",
        "GET /api/v1/stats",
        "POST /api/v1/stats/reset",
        "GET /api/v1/config/validator",
        "GET /api/v1/tokens",
        "GET /api/v1/tokens/search?q=USDC",
        "POST /api/v1/tokens/resolve",
        "POST /api/v1/balance",
      ],
    };
  }
}

export default SwapAPI;
