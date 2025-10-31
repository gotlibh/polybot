import Logger from './logger.js';

/**
 * AddressMapper - Maps blockchain addresses to human-readable names
 * Supports address groups for filtering and organization
 */
class AddressMapper {
  constructor(addressConfig = {}) {
    this.addresses = addressConfig.addresses || {};
    this.groups = addressConfig.groups || {};
    this.logger = new Logger('AddressMapper');

    // Create a lowercase lookup map for case-insensitive matching
    this.addressLookup = {};
    for (const [address, info] of Object.entries(this.addresses)) {
      this.addressLookup[address.toLowerCase()] = {
        address: address, // Original case
        ...info
      };
    }

    this.logger.info('AddressMapper initialized', {
      addressCount: Object.keys(this.addresses).length,
      groupCount: Object.keys(this.groups).length
    });
  }

  /**
   * Get name for an address
   * @param {string} address - The blockchain address
   * @returns {string|null} - The name or null if not found
   */
  getName(address) {
    if (!address) return null;
    const info = this.addressLookup[address.toLowerCase()];
    return info ? info.name : null;
  }

  /**
   * Get full info for an address
   * @param {string} address - The blockchain address
   * @returns {Object|null} - Address info (name, tags, description) or null
   */
  getInfo(address) {
    if (!address) return null;
    return this.addressLookup[address.toLowerCase()] || null;
  }

  /**
   * Format address with name if available
   * @param {string} address - The blockchain address
   * @param {Object} options - Formatting options
   * @returns {string} - Formatted address (e.g., "My Wallet (0x1234...5678)")
   */
  format(address, options = {}) {
    const {
      showAddress = true,
      showName = true,
      shortenAddress = false,
      maxLength = 42
    } = options;

    if (!address) return 'N/A';

    const info = this.getInfo(address);
    const name = info ? info.name : null;

    // If no name found, just return the address
    if (!name) {
      return shortenAddress ? this._shortenAddress(address) : address;
    }

    // Format based on options
    if (showName && showAddress) {
      const addr = shortenAddress ? this._shortenAddress(address) : address;
      return `${name} (${addr})`;
    } else if (showName) {
      return name;
    } else {
      return shortenAddress ? this._shortenAddress(address) : address;
    }
  }

  /**
   * Check if address is in a specific group
   * @param {string} address - The blockchain address
   * @param {string} groupName - The group name
   * @returns {boolean}
   */
  isInGroup(address, groupName) {
    if (!address || !groupName) return false;
    const group = this.groups[groupName];
    if (!group) return false;
    return group.map(a => a.toLowerCase()).includes(address.toLowerCase());
  }

  /**
   * Get all addresses in a group
   * @param {string} groupName - The group name
   * @returns {Array<string>} - Array of addresses
   */
  getGroup(groupName) {
    return this.groups[groupName] || [];
  }

  /**
   * Resolve group names to addresses in a list
   * Supports both individual addresses and group references (prefixed with '@')
   * @param {Array<string>} addressesOrGroups - Array of addresses or @groupName
   * @returns {Array<string>} - Resolved array of addresses
   *
   * Example:
   *   ['0x123...', '@myAddresses', '0x456...']
   *   => ['0x123...', '0xabc...', '0xdef...', '0x456...']
   */
  resolveAddresses(addressesOrGroups) {
    if (!Array.isArray(addressesOrGroups)) {
      return [];
    }

    const resolved = [];
    for (const item of addressesOrGroups) {
      if (typeof item === 'string' && item.startsWith('@')) {
        // Group reference (e.g., '@myAddresses')
        const groupName = item.substring(1);
        const groupAddresses = this.getGroup(groupName);
        if (groupAddresses.length > 0) {
          resolved.push(...groupAddresses);
          this.logger.debug(`Resolved group '${groupName}' to ${groupAddresses.length} addresses`);
        } else {
          this.logger.warn(`Group '${groupName}' not found or empty`);
        }
      } else {
        // Individual address
        resolved.push(item);
      }
    }

    return resolved;
  }

  /**
   * Get all tags for an address
   * @param {string} address - The blockchain address
   * @returns {Array<string>} - Array of tags
   */
  getTags(address) {
    const info = this.getInfo(address);
    return info ? (info.tags || []) : [];
  }

  /**
   * Find addresses by tag
   * @param {string} tag - The tag to search for
   * @returns {Array<string>} - Array of addresses with that tag
   */
  findByTag(tag) {
    const result = [];
    for (const [address, info] of Object.entries(this.addressLookup)) {
      if (info.tags && info.tags.includes(tag)) {
        result.push(info.address);
      }
    }
    return result;
  }

  /**
   * Shorten address for display (0x1234...5678)
   */
  _shortenAddress(address) {
    if (!address || address.length <= 10) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  }

  /**
   * Get statistics about loaded addresses
   */
  getStats() {
    const tagCounts = {};
    for (const info of Object.values(this.addressLookup)) {
      if (info.tags) {
        for (const tag of info.tags) {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        }
      }
    }

    return {
      totalAddresses: Object.keys(this.addresses).length,
      totalGroups: Object.keys(this.groups).length,
      tagCounts
    };
  }
}

export default AddressMapper;
