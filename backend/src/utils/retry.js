const logger = require('./logger');

/**
 * Retry a function up to maxAttempts times with exponential backoff
 * @param {Function} fn - async function to retry
 * @param {Object} options
 * @param {number} options.maxAttempts - max retry attempts (default 3)
 * @param {number} options.delayMs - initial delay in ms (default 500)
 * @param {string} options.label - label for logging
 * @returns {Promise<any>}
 */
async function retry(fn, { maxAttempts = 3, delayMs = 500, label = 'operation' } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        const wait = delayMs * Math.pow(2, attempt - 1);
        logger.warn(`[RETRY] ${label} attempt ${attempt}/${maxAttempts} failed: ${error.message}. Retrying in ${wait}ms`);
        await new Promise(resolve => setTimeout(resolve, wait));
      }
    }
  }
  logger.error(`[RETRY] ${label} failed after ${maxAttempts} attempts: ${lastError.message}`);
  throw lastError;
}

/**
 * Wrap an Express route handler with automatic error catching
 * Eliminates try/catch boilerplate
 * @param {Function} fn - async route handler (req, res, next)
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { retry, asyncHandler };
