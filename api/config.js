/**
 * GET /api/config
 * Exposes the PUBLIC Razorpay key id to the browser.
 *
 * This site has no build step, so there is no way to inline a
 * VITE_/NEXT_PUBLIC_ style variable at compile time. Serving the
 * key id from the backend keeps it out of source control while
 * ensuring RAZORPAY_KEY_SECRET never reaches the frontend.
 */

'use strict';

require('dotenv').config();
const { applyCors, getPublicConfig, sendError, sendJson } = require('../lib/razorpay');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return; // preflight handled

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, Object.assign(new Error('Method not allowed. Use GET.'), { statusCode: 405 }));
  }

  try {
    return sendJson(res, { success: true, ...getPublicConfig() });
  } catch (error) {
    return sendError(res, error);
  }
};
