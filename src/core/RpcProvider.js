import { WebSocketProvider } from 'ethers';
import Logger from '../utils/logger.js';

/**
 * Manages WebSocket connection to RPC provider
 * Handles reconnection logic and connection state
 */
class RpcProvider {
  constructor(rpcUrl, options = {}) {
    this.rpcUrl = rpcUrl;
    this.options = {
      reconnect: true,
      reconnectDelay: options.reconnectDelay || 5000,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      ...options
    };

    this.provider = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.logger = new Logger('RpcProvider');
  }

  /**
   * Initialize WebSocket connection
   */
  async connect() {
    try {
      this.logger.info(`Connecting to RPC provider: ${this.rpcUrl}`);

      this.provider = new WebSocketProvider(this.rpcUrl);

      // Set up event listeners
      this.provider.websocket.on('open', () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.logger.info('WebSocket connection established');
      });

      this.provider.websocket.on('close', () => {
        this.isConnected = false;
        this.logger.warn('WebSocket connection closed');
        this._handleReconnect();
      });

      this.provider.websocket.on('error', (error) => {
        this.logger.error('WebSocket error', error);
      });

      // Wait for connection to be established
      await this._waitForConnection();

      return this.provider;
    } catch (error) {
      this.logger.error('Failed to connect to RPC provider', error);
      throw error;
    }
  }

  /**
   * Wait for WebSocket connection to be ready
   */
  async _waitForConnection(timeout = 10000) {
    const startTime = Date.now();

    while (!this.isConnected && Date.now() - startTime < timeout) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (!this.isConnected) {
      throw new Error('Connection timeout');
    }
  }

  /**
   * Handle reconnection logic
   */
  _handleReconnect() {
    if (!this.options.reconnect) {
      return;
    }

    if (this.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.logger.error('Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    this.logger.info(`Attempting to reconnect (${this.reconnectAttempts}/${this.options.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch(error => {
        this.logger.error('Reconnection failed', error);
      });
    }, this.options.reconnectDelay);
  }

  /**
   * Get the provider instance
   */
  getProvider() {
    if (!this.provider || !this.isConnected) {
      throw new Error('Provider not connected');
    }
    return this.provider;
  }

  /**
   * Check connection status
   */
  isProviderConnected() {
    return this.isConnected;
  }

  /**
   * Disconnect and cleanup
   */
  async disconnect() {
    if (this.provider) {
      this.logger.info('Disconnecting from RPC provider');
      this.options.reconnect = false; // Disable auto-reconnect
      await this.provider.destroy();
      this.provider = null;
      this.isConnected = false;
    }
  }
}

export default RpcProvider;
