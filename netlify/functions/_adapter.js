/**
 * Adapter: runs the existing Node-style API handlers in `api/` as Netlify Functions.
 *
 * The handlers in `api/` take `(req, res)` — the shape Vercel and the Express dev
 * server both provide. Netlify Functions instead take an `event` and return a
 * response object. Rather than fork the business logic, this wraps a handler in
 * the minimal `req`/`res` surface those handlers actually use:
 *
 *   req  -> method, headers, body (string), url
 *   res  -> statusCode, setHeader(), end()
 *
 * So there is exactly one implementation of each endpoint, shared by all hosts.
 */

'use strict';

function toNetlify(handler) {
  return async function netlifyHandler(event) {
    const req = {
      method: event.httpMethod,
      headers: event.headers || {},
      url: event.path || '/',
      // `readJsonBody` accepts a string body and parses it, so no stream is needed.
      body: event.isBase64Encoded && event.body
        ? Buffer.from(event.body, 'base64').toString('utf8')
        : event.body,
    };

    const headers = {};
    let statusCode = 200;
    let body = '';
    let finished = false;

    const res = {
      get statusCode() {
        return statusCode;
      },
      set statusCode(value) {
        statusCode = value;
      },
      setHeader(name, value) {
        headers[name] = value;
      },
      getHeader(name) {
        return headers[name];
      },
      end(chunk) {
        if (chunk) body = typeof chunk === 'string' ? chunk : String(chunk);
        finished = true;
      },
    };

    try {
      await handler(req, res);
    } catch (error) {
      console.error('[netlify]', error);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Server error.' }),
      };
    }

    if (!finished) {
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: false, error: 'Handler produced no response.' }),
      };
    }

    return { statusCode, headers, body };
  };
}

module.exports = { toNetlify };
