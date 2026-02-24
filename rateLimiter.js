import dotenv from 'dotenv';

dotenv.config();

const WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX || '60', 10);

// In-memory store: Map<apiKey, timestamp[]>
const requestHistory = new Map();

/**
 * Clean up old timestamps for a given API key
 * @param {string} apiKey - API key identifier
 */
function cleanupOldRequests(apiKey) {
  const now = Date.now();
  const timestamps = requestHistory.get(apiKey) || [];
  const recentTimestamps = timestamps.filter(ts => now - ts < WINDOW_MS);
  
  if (recentTimestamps.length === 0) {
    requestHistory.delete(apiKey);
  } else {
    requestHistory.set(apiKey, recentTimestamps);
  }
}

/**
 * Check if API key has exceeded rate limit
 * @param {string} apiKey - API key identifier
 * @returns {{ allowed: boolean, retryAfter?: number }}
 */
export function checkRateLimit(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    return { allowed: false, retryAfter: 60 };
  }

  const now = Date.now();
  
  // Clean up old requests for this key
  cleanupOldRequests(apiKey);
  
  // Get current request count
  const timestamps = requestHistory.get(apiKey) || [];
  
  // Check if limit would be exceeded BEFORE adding this request
  if (timestamps.length >= MAX_REQUESTS) {
    // Find oldest timestamp to calculate retryAfter
    const oldestTimestamp = Math.min(...timestamps);
    const retryAfter = Math.ceil((WINDOW_MS - (now - oldestTimestamp)) / 1000);
    return {
      allowed: false,
      retryAfter: Math.max(1, retryAfter)
    };
  }
  
  // Add current request timestamp (only if allowed)
  timestamps.push(now);
  requestHistory.set(apiKey, timestamps);
  
  return { allowed: true };
}

/**
 * Get current rate limit configuration
 * @returns {{ windowMs: number, maxRequests: number }}
 */
export function getRateLimitConfig() {
  return {
    windowMs: WINDOW_MS,
    maxRequests: MAX_REQUESTS
  };
}
