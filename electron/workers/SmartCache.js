"use strict";
/**
 * Smart Cache - LRU-K with Memory Limits
 *
 * Advanced caching with:
 * - LRU-K eviction (considers K-th most recent access)
 * - Memory-based limits (not just item count)
 * - Hit rate metrics
 * - Automatic size estimation
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScriptCache = exports.SmartCache = void 0;
exports.createSmartCache = createSmartCache;
exports.createScriptCache = createScriptCache;
exports.createTempCache = createTempCache;
var vm_1 = require("vm");
var crypto_1 = require("crypto");
// ============================================================================
// DEFAULT CONFIGURATION  
// ============================================================================
var DEFAULT_CONFIG = {
    maxMemory: 50 * 1024 * 1024, // 50MB
    k: 2, // LRU-2
    minEntries: 10,
    enableMetrics: true,
};
// ============================================================================
// SMART CACHE CLASS
// ============================================================================
var SmartCache = /** @class */ (function () {
    function SmartCache(config) {
        if (config === void 0) { config = {}; }
        this.cache = new Map();
        this.currentMemory = 0;
        // Metrics
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.totalAccessTime = 0;
        this.accessCount = 0;
        this.config = __assign(__assign({}, DEFAULT_CONFIG), config);
    }
    /**
     * Get value from cache
     */
    SmartCache.prototype.get = function (key) {
        var startTime = performance.now();
        var entry = this.cache.get(key);
        if (entry) {
            this.hits++;
            this.recordAccess(entry);
            this.recordAccessTime(performance.now() - startTime);
            return entry.value;
        }
        this.misses++;
        this.recordAccessTime(performance.now() - startTime);
        return undefined;
    };
    /**
     * Set value in cache
     */
    SmartCache.prototype.set = function (key, value, sizeEstimate) {
        var size = sizeEstimate !== null && sizeEstimate !== void 0 ? sizeEstimate : this.estimateSize(value);
        // Remove existing entry if present
        if (this.cache.has(key)) {
            var existing = this.cache.get(key);
            this.currentMemory -= existing.size;
            this.cache.delete(key);
        }
        // Ensure we have space
        while (this.shouldEvict(size)) {
            this.evictOne();
        }
        // Add new entry
        var entry = {
            key: key,
            value: value,
            size: size,
            accessHistory: [Date.now()],
            createdAt: Date.now(),
            hitCount: 0,
        };
        this.cache.set(key, entry);
        this.currentMemory += size;
    };
    /**
     * Check if key exists
     */
    SmartCache.prototype.has = function (key) {
        return this.cache.has(key);
    };
    /**
     * Delete from cache
     */
    SmartCache.prototype.delete = function (key) {
        var entry = this.cache.get(key);
        if (entry) {
            this.currentMemory -= entry.size;
            this.cache.delete(key);
            return true;
        }
        return false;
    };
    /**
     * Clear entire cache
     */
    SmartCache.prototype.clear = function () {
        this.cache.clear();
        this.currentMemory = 0;
    };
    /**
     * Get cache metrics
     */
    SmartCache.prototype.getMetrics = function () {
        var total = this.hits + this.misses;
        var now = Date.now();
        // Categorize entries by age
        var oneMinute = 60 * 1000;
        var fiveMinutes = 5 * 60 * 1000;
        var recent = 0, medium = 0, old = 0;
        for (var _i = 0, _a = this.cache.values(); _i < _a.length; _i++) {
            var entry = _a[_i];
            var age = now - entry.createdAt;
            if (age < oneMinute)
                recent++;
            else if (age < fiveMinutes)
                medium++;
            else
                old++;
        }
        return {
            hits: this.hits,
            misses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            evictions: this.evictions,
            currentSize: this.cache.size,
            currentMemory: this.currentMemory,
            avgAccessTime: this.accessCount > 0 ? this.totalAccessTime / this.accessCount : 0,
            entriesByAge: { recent: recent, medium: medium, old: old },
        };
    };
    /**
     * Reset metrics
     */
    SmartCache.prototype.resetMetrics = function () {
        this.hits = 0;
        this.misses = 0;
        this.evictions = 0;
        this.totalAccessTime = 0;
        this.accessCount = 0;
    };
    Object.defineProperty(SmartCache.prototype, "size", {
        /**
         * Get cache size
         */
        get: function () {
            return this.cache.size;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SmartCache.prototype, "memoryUsage", {
        /**
         * Get memory usage
         */
        get: function () {
            return this.currentMemory;
        },
        enumerable: false,
        configurable: true
    });
    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================
    /**
     * Record access for LRU-K tracking
     */
    SmartCache.prototype.recordAccess = function (entry) {
        entry.accessHistory.push(Date.now());
        entry.hitCount++;
        // Keep only last K+1 accesses (we need K for eviction, +1 for current)
        if (entry.accessHistory.length > this.config.k + 1) {
            entry.accessHistory.shift();
        }
    };
    /**
     * Record access time for metrics
     */
    SmartCache.prototype.recordAccessTime = function (time) {
        if (this.config.enableMetrics) {
            this.totalAccessTime += time;
            this.accessCount++;
        }
    };
    /**
     * Check if eviction is needed
     */
    SmartCache.prototype.shouldEvict = function (additionalSize) {
        // Don't evict if we're at minimum entries
        if (this.cache.size <= this.config.minEntries) {
            return false;
        }
        return this.currentMemory + additionalSize > this.config.maxMemory;
    };
    /**
     * Evict one entry using LRU-K algorithm
     */
    SmartCache.prototype.evictOne = function () {
        var _a;
        if (this.cache.size <= this.config.minEntries) {
            return;
        }
        var evictKey = null;
        var minKthAccess = Infinity;
        for (var _i = 0, _b = this.cache; _i < _b.length; _i++) {
            var _c = _b[_i], key = _c[0], entry = _c[1];
            // Get K-th most recent access (or earliest if fewer than K accesses)
            var k = Math.min(this.config.k, entry.accessHistory.length);
            var kthAccess = (_a = entry.accessHistory[entry.accessHistory.length - k]) !== null && _a !== void 0 ? _a : 0;
            if (kthAccess < minKthAccess) {
                minKthAccess = kthAccess;
                evictKey = key;
            }
        }
        if (evictKey) {
            var entry = this.cache.get(evictKey);
            this.currentMemory -= entry.size;
            this.cache.delete(evictKey);
            this.evictions++;
        }
    };
    /**
     * Estimate size of value
     */
    SmartCache.prototype.estimateSize = function (value) {
        try {
            // For strings
            if (typeof value === 'string') {
                return value.length * 2; // UTF-16
            }
            // For compiled scripts
            if (value instanceof vm_1.default.Script) {
                // Estimate based on source code length
                return 1024; // Base overhead
            }
            // For objects, use JSON size as estimate
            var json = JSON.stringify(value);
            return json.length * 2;
        }
        catch (_a) {
            return 1024; // Default estimate
        }
    };
    return SmartCache;
}());
exports.SmartCache = SmartCache;
var ScriptCache = /** @class */ (function (_super) {
    __extends(ScriptCache, _super);
    function ScriptCache(config) {
        if (config === void 0) { config = {}; }
        return _super.call(this, __assign({ maxMemory: 30 * 1024 * 1024, k: 2, minEntries: 20 }, config)) || this;
    }
    /**
     * Get or create script from code
     */
    ScriptCache.prototype.getOrCreate = function (code) {
        var hash = this.hashCode(code);
        var cached = this.get(hash);
        if (cached && cached.code === code) {
            return cached.script;
        }
        // Create new script
        var script = new vm_1.default.Script(code, {
            filename: 'usercode.js',
            lineOffset: -2,
            columnOffset: 0,
        });
        var entry = {
            script: script,
            code: code,
            hash: hash,
        };
        // Estimate size: base overhead + code size
        var size = 2048 + code.length * 2;
        this.set(hash, entry, size);
        return script;
    };
    /**
     * Hash code string
     */
    ScriptCache.prototype.hashCode = function (str) {
        return crypto_1.default.createHash('sha256').update(str, 'utf8').digest('hex');
    };
    return ScriptCache;
}(SmartCache));
exports.ScriptCache = ScriptCache;
// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================
/**
 * Create a general-purpose smart cache
 */
function createSmartCache(config) {
    return new SmartCache(config);
}
/**
 * Create a script cache for code execution
 */
function createScriptCache(config) {
    return new ScriptCache(config);
}
/**
 * Create a small cache for temporary data
 */
function createTempCache() {
    return new SmartCache({
        maxMemory: 5 * 1024 * 1024, // 5MB
        minEntries: 5,
    });
}
exports.default = SmartCache;
