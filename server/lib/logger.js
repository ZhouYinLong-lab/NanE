/**
 * Structured logger for NanE API.
 * Outputs JSON lines to stdout for log aggregation.
 */

function iso() {
  return new Date().toISOString();
}

function logRequest(method, path, status, elapsedMs, userId) {
  console.log(JSON.stringify({
    level: "info",
    time: iso(),
    event: "request",
    method,
    path,
    status,
    elapsedMs,
    userId: userId || null
  }));
}

function logAudit(who, action, target, reason) {
  console.log(JSON.stringify({
    level: "info",
    time: iso(),
    event: "audit",
    who,
    action,
    target,
    reason: reason || null
  }));
}

function logError(error, context) {
  console.log(JSON.stringify({
    level: "error",
    time: iso(),
    event: "error",
    message: (error && (error.message || String(error))) || null,
    stack: error && error.stack ? error.stack.slice(0, 500) : null,
    context: context || null
  }));
}

/**
 * Wraps an async route handler (req, res, ...) so that the request
 * is logged after the handler completes or errors.
 */
function requestLogger(handler) {
  return async (req, res, ...args) => {
    const start = Date.now();
    const originalEnd = res.end.bind(res);
    res.end = (...endArgs) => {
      const elapsed = Date.now() - start;
      logRequest(req.method, req.url, res.statusCode, elapsed, null);
      return originalEnd(...endArgs);
    };
    try {
      await handler(req, res, ...args);
    } catch (error) {
      logError(error, { method: req.method, path: req.url });
      throw error;
    }
  };
}

module.exports = { logRequest, logAudit, logError, requestLogger };
