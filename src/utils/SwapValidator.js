import Joi from 'joi';
import { isAddress } from 'ethers';
import Logger from './logger.js';

/**
 * SwapValidator - Validates swap parameters using Joi validation library
 */
class SwapValidator {
  constructor(options = {}) {
    this.options = {
      maxSlippage: options.maxSlippage || 5, // Max 5% slippage
      minSlippage: options.minSlippage || 0.1, // Min 0.1% slippage
      maxDeadlineMinutes: options.maxDeadlineMinutes || 60, // Max 60 minutes
      minDeadlineMinutes: options.minDeadlineMinutes || 1, // Min 1 minute
      maxGasPrice: options.maxGasPrice || 500, // Max 500 gwei
      allowedDexes: options.allowedDexes || [], // Empty = all allowed
      allowedTokens: options.allowedTokens || [], // Empty = all allowed
      requireRecipientWhitelist: options.requireRecipientWhitelist || false,
      recipientWhitelist: options.recipientWhitelist || [],
      ...options
    };

    this.logger = new Logger('SwapValidator');
    this._buildSchemas();
  }

  /**
   * Build Joi validation schemas
   */
  _buildSchemas() {
    // Custom Joi validator for Ethereum addresses
    const ethereumAddress = Joi.string()
      .custom((value, helpers) => {
        if (!isAddress(value)) {
          return helpers.error('any.invalid');
        }
        return value;
      }, 'Ethereum address validation')
      .messages({
        'any.invalid': '{{#label}} must be a valid Ethereum address'
      });

    // Custom Joi validator for private key
    const privateKey = Joi.string()
      .pattern(/^0x[a-fA-F0-9]{64}$/)
      .custom((value, helpers) => {
        try {
          // Additional validation could be done here
          return value;
        } catch (error) {
          return helpers.error('any.invalid');
        }
      }, 'Private key validation')
      .messages({
        'string.pattern.base': '{{#label}} must be a valid private key (0x + 64 hex characters)',
        'any.invalid': '{{#label}} is not a valid private key'
      });

    // Custom validator for BigInt-compatible strings
    const bigIntString = Joi.string()
      .pattern(/^[0-9]+$/)
      .messages({
        'string.pattern.base': '{{#label}} must be a valid number string'
      });

    // Build DEX name validator with optional whitelist
    let dexNameStringValidator = Joi.string().required();
    if (this.options.allowedDexes.length > 0) {
      dexNameStringValidator = dexNameStringValidator
        .valid(...this.options.allowedDexes)
        .messages({
          'any.only': `{{#label}} must be one of: ${this.options.allowedDexes.join(', ')}`
        });
    }

    // DEX name can be either a single string or an array of strings
    const dexNameValidator = Joi.alternatives().try(
      dexNameStringValidator,
      Joi.array().items(dexNameStringValidator).min(1).required()
    );

    // Build token address validator with optional whitelist
    const buildTokenValidator = () => {
      let validator = ethereumAddress.required();
      if (this.options.allowedTokens.length > 0) {
        const allowedLowercase = this.options.allowedTokens.map(t => t.toLowerCase());
        validator = validator.custom((value, helpers) => {
          if (!allowedLowercase.includes(value.toLowerCase())) {
            return helpers.error('any.only');
          }
          return value;
        }).messages({
          'any.only': '{{#label}} is not in the allowed token list'
        });
      }
      return validator;
    };

    // Build recipient validator with optional whitelist
    const buildRecipientValidator = () => {
      let validator = ethereumAddress;
      if (this.options.requireRecipientWhitelist) {
        const whitelistLowercase = this.options.recipientWhitelist.map(a => a.toLowerCase());
        validator = validator.custom((value, helpers) => {
          if (!whitelistLowercase.includes(value.toLowerCase())) {
            return helpers.error('any.only');
          }
          return value;
        }).messages({
          'any.only': '{{#label}} is not in the recipient whitelist'
        });
      }
      return validator;
    };

    // Swap execution schema
    this.swapSchema = Joi.object({
      // Required fields
      dexName: dexNameValidator.label('DEX name'),

      tokenIn: buildTokenValidator().label('tokenIn'),

      tokenOut: buildTokenValidator()
        .invalid(Joi.ref('tokenIn'))
        .label('tokenOut')
        .messages({
          'any.invalid': 'tokenOut must be different from tokenIn'
        }),

      amountIn: Joi.string()
        .required()
        .pattern(/^[0-9]+\.?[0-9]*$/)
        .custom((value, helpers) => {
          const num = parseFloat(value);
          if (num <= 0) {
            return helpers.error('number.positive');
          }
          if (num > 1e18) {
            return helpers.error('number.max');
          }
          return value;
        })
        .label('amountIn')
        .messages({
          'string.pattern.base': '{{#label}} must be a valid positive number',
          'number.positive': '{{#label}} must be greater than 0',
          'number.max': '{{#label}} is unreasonably large (max: 1e18)'
        }),

      tokenInDecimals: Joi.number()
        .integer()
        .min(0)
        .max(18)
        .required()
        .label('tokenInDecimals'),

      tokenOutDecimals: Joi.number()
        .integer()
        .min(0)
        .max(18)
        .required()
        .label('tokenOutDecimals'),

      privateKey: privateKey.required().label('privateKey'),

      // Optional fields
      recipient: buildRecipientValidator().optional().label('recipient'),

      slippage: Joi.number()
        .min(this.options.minSlippage)
        .max(this.options.maxSlippage)
        .optional()
        .label('slippage')
        .messages({
          'number.min': `{{#label}} must be at least ${this.options.minSlippage}%`,
          'number.max': `{{#label}} must not exceed ${this.options.maxSlippage}%`
        }),

      deadline: Joi.number()
        .integer()
        .min(this.options.minDeadlineMinutes)
        .max(this.options.maxDeadlineMinutes)
        .optional()
        .label('deadline')
        .messages({
          'number.min': `{{#label}} must be at least ${this.options.minDeadlineMinutes} minute(s)`,
          'number.max': `{{#label}} must not exceed ${this.options.maxDeadlineMinutes} minutes`
        }),

      gasLimit: bigIntString
        .custom((value, helpers) => {
          const limit = BigInt(value);
          if (limit <= 0n || limit > 10000000n) {
            return helpers.error('number.range');
          }
          return value;
        })
        .optional()
        .label('gasLimit')
        .messages({
          'number.range': '{{#label}} must be between 1 and 10,000,000'
        }),

      gasPrice: Joi.number()
        .positive()
        .max(this.options.maxGasPrice)
        .optional()
        .label('gasPrice')
        .messages({
          'number.max': `{{#label}} must not exceed ${this.options.maxGasPrice} gwei`
        }),

      maxFeePerGas: Joi.number()
        .positive()
        .max(this.options.maxGasPrice)
        .optional()
        .label('maxFeePerGas')
        .messages({
          'number.max': `{{#label}} must not exceed ${this.options.maxGasPrice} gwei`
        }),

      maxPriorityFeePerGas: Joi.number()
        .positive()
        .max(this.options.maxGasPrice)
        .when('maxFeePerGas', {
          is: Joi.exist(),
          then: Joi.number().max(Joi.ref('maxFeePerGas')),
          otherwise: Joi.number()
        })
        .optional()
        .label('maxPriorityFeePerGas')
        .messages({
          'number.max': '{{#label}} must not exceed maxFeePerGas'
        })
    })
    // Validate that gasPrice and EIP-1559 params are not both provided
    .custom((value, helpers) => {
      if (value.gasPrice && (value.maxFeePerGas || value.maxPriorityFeePerGas)) {
        return helpers.error('object.conflictingGas');
      }
      return value;
    })
    .messages({
      'object.conflictingGas': 'Cannot specify both gasPrice (legacy) and EIP-1559 gas parameters (maxFeePerGas/maxPriorityFeePerGas)'
    });

    // Quote schema (similar to swap but without private key)
    // Supports either (tokenIn + tokenOut) OR (token with "TOKEN1/TOKEN2" format)
    this.quoteSchema = Joi.object({
      dexName: dexNameValidator.label('DEX name'),

      // Token pair format (e.g., "WBTC/USDC")
      token: Joi.string()
        .pattern(/^[a-zA-Z0-9.]+\/[a-zA-Z0-9.]+$/)
        .optional()
        .label('token')
        .messages({
          'string.pattern.base': '{{#label}} must be in format "TOKEN1/TOKEN2" (e.g., "WBTC/USDC")'
        }),

      tokenIn: buildTokenValidator()
        .when('token', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required()
        })
        .label('tokenIn'),

      tokenOut: buildTokenValidator()
        .invalid(Joi.ref('tokenIn'))
        .when('token', {
          is: Joi.exist(),
          then: Joi.optional(),
          otherwise: Joi.required()
        })
        .label('tokenOut')
        .messages({
          'any.invalid': 'tokenOut must be different from tokenIn'
        }),

      amountIn: Joi.string()
        .required()
        .pattern(/^[0-9]+\.?[0-9]*$/)
        .custom((value, helpers) => {
          const num = parseFloat(value);
          if (num <= 0) {
            return helpers.error('number.positive');
          }
          if (num > 1e18) {
            return helpers.error('number.max');
          }
          return value;
        })
        .label('amountIn')
        .messages({
          'string.pattern.base': '{{#label}} must be a valid positive number',
          'number.positive': '{{#label}} must be greater than 0',
          'number.max': '{{#label}} is unreasonably large'
        }),

      tokenInDecimals: Joi.number()
        .integer()
        .min(0)
        .max(18)
        .optional()
        .label('tokenInDecimals'),

      tokenOutDecimals: Joi.number()
        .integer()
        .min(0)
        .max(18)
        .optional()
        .label('tokenOutDecimals'),

      slippage: Joi.number()
        .min(this.options.minSlippage)
        .max(this.options.maxSlippage)
        .optional()
        .label('slippage')
    })
    .custom((value, helpers) => {
      // Must have either 'token' OR both 'tokenIn' and 'tokenOut'
      if (!value.token && (!value.tokenIn || !value.tokenOut)) {
        return helpers.error('object.missingTokens');
      }
      if (value.token && (value.tokenIn || value.tokenOut)) {
        return helpers.error('object.conflictingTokens');
      }
      return value;
    })
    .messages({
      'object.missingTokens': 'Must provide either "token" (e.g., "WBTC/USDC") or both "tokenIn" and "tokenOut"',
      'object.conflictingTokens': 'Cannot specify both "token" and "tokenIn"/"tokenOut". Use one format only.'
    });
  }

  /**
   * Validate swap parameters
   * @param {Object} params - Swap parameters to validate
   * @returns {Object} - Validation result { valid: boolean, errors: string[], value?: Object }
   */
  validate(params) {
    const { error, value } = this.swapSchema.validate(params, {
      abortEarly: false, // Return all errors, not just the first one
      stripUnknown: true, // Remove unknown keys
      convert: true // Convert types when possible
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);

      this.logger.warn('Swap validation failed', {
        errors,
        params: this._sanitizeParams(params)
      });

      return {
        valid: false,
        errors
      };
    }

    this.logger.debug('Swap validation passed', {
      dex: value.dexName,
      tokenIn: value.tokenIn,
      tokenOut: value.tokenOut
    });

    return {
      valid: true,
      errors: [],
      value // Return validated and sanitized value
    };
  }

  /**
   * Validate quote parameters
   * @param {Object} params - Quote parameters to validate
   * @returns {Object} - Validation result { valid: boolean, errors: string[], value?: Object }
   */
  validateQuote(params) {
    const { error, value } = this.quoteSchema.validate(params, {
      abortEarly: false,
      stripUnknown: true,
      convert: true
    });

    if (error) {
      const errors = error.details.map(detail => detail.message);

      this.logger.warn('Quote validation failed', {
        errors,
        params: this._sanitizeParams(params)
      });

      return {
        valid: false,
        errors
      };
    }

    this.logger.debug('Quote validation passed', {
      dex: value.dexName,
      tokenIn: value.tokenIn,
      tokenOut: value.tokenOut
    });

    return {
      valid: true,
      errors: [],
      value
    };
  }

  /**
   * Sanitize parameters for logging (remove sensitive data)
   */
  _sanitizeParams(params) {
    const sanitized = { ...params };
    if (sanitized.privateKey) {
      sanitized.privateKey = '***REDACTED***';
    }
    return sanitized;
  }

  /**
   * Update validator configuration and rebuild schemas
   */
  updateConfig(newConfig) {
    this.options = { ...this.options, ...newConfig };
    this._buildSchemas(); // Rebuild schemas with new config

    this.logger.info('Validator configuration updated', {
      maxSlippage: this.options.maxSlippage,
      maxGasPrice: this.options.maxGasPrice,
      allowedDexes: this.options.allowedDexes.length > 0 ? this.options.allowedDexes : 'all',
      allowedTokens: this.options.allowedTokens.length > 0 ? `${this.options.allowedTokens.length} tokens` : 'all'
    });
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return { ...this.options };
  }

  /**
   * Get validation schemas (for testing/debugging)
   */
  getSchemas() {
    return {
      swap: this.swapSchema.describe(),
      quote: this.quoteSchema.describe()
    };
  }
}

export default SwapValidator;
