// Artillery processor for custom metrics and logic

module.exports = {
  // Custom functions for Artillery scenarios
  setRandomDeviceId,
  setRandomButtonIndex,
  validateResponse,
  logMetrics,

  // Hooks for test lifecycle
  beforeRequest,
  afterResponse,
};

function setRandomDeviceId(requestParams, context, ee, next) {
  const deviceIds = ['test-device-1', 'test-device-2', 'test-device-3'];
  context.vars.deviceId =
    deviceIds[Math.floor(Math.random() * deviceIds.length)];
  return next();
}

function setRandomButtonIndex(requestParams, context, ee, next) {
  context.vars.buttonIndex = Math.floor(Math.random() * 15); // 0-14 for standard StreamDeck
  return next();
}

function validateResponse(requestParams, response, context, ee, next) {
  // Custom response validation
  if (response.statusCode >= 500) {
    ee.emit('counter', 'errors.server', 1);
  } else if (response.statusCode >= 400) {
    ee.emit('counter', 'errors.client', 1);
  } else {
    ee.emit('counter', 'responses.success', 1);
  }

  // Track response times by endpoint
  const endpoint = requestParams.url.split('?')[0];
  ee.emit('histogram', `response_time.${endpoint}`, response.timings.response);

  return next();
}

function logMetrics(requestParams, response, context, ee, next) {
  // Log custom metrics
  if (response.body) {
    try {
      const body = JSON.parse(response.body);

      // Track memory usage if available in health endpoints
      if (body.data && body.data.system && body.data.system.memory) {
        ee.emit('histogram', 'memory.used', body.data.system.memory.used);
        ee.emit('histogram', 'memory.total', body.data.system.memory.total);
      }

      // Track cache metrics if available
      if (body.data && body.data.cache) {
        ee.emit('histogram', 'cache.size', body.data.cache.size);
        ee.emit('histogram', 'cache.hit_rate', body.data.cache.hitRate);
      }

      // Track device metrics if available
      if (body.data && body.data.devices) {
        ee.emit('histogram', 'devices.connected', body.data.devices.connected);
        ee.emit('histogram', 'devices.total', body.data.devices.total);
      }
    } catch (error) {
      // Ignore JSON parsing errors
    }
  }

  return next();
}

function beforeRequest(requestParams, context, ee, next) {
  // Add custom headers
  requestParams.headers = requestParams.headers || {};
  requestParams.headers['User-Agent'] = 'Artillery-LoadTest/1.0';
  requestParams.headers['X-Test-Run'] = context.vars.$uuid || 'unknown';

  // Add timestamp for request tracking
  context.vars._requestStart = Date.now();

  return next();
}

function afterResponse(requestParams, response, context, ee, next) {
  // Calculate custom timing metrics
  if (context.vars._requestStart) {
    const totalTime = Date.now() - context.vars._requestStart;
    ee.emit('histogram', 'request.total_time', totalTime);
  }

  // Track rate limiting
  if (response.statusCode === 429) {
    ee.emit('counter', 'rate_limited', 1);

    // Extract retry-after header if present
    const retryAfter = response.headers['retry-after'];
    if (retryAfter) {
      ee.emit('histogram', 'rate_limit.retry_after', parseInt(retryAfter));
    }
  }

  // Track different response sizes
  const contentLength = response.headers['content-length'];
  if (contentLength) {
    ee.emit('histogram', 'response.size', parseInt(contentLength));
  }

  return next();
}
