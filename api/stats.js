/**
 * GET /api/stats
 *
 * Real, non-identifying booking counters for the social-proof strip.
 * The frontend hides the strip when the counts are still zero, so the site
 * never shows invented numbers.
 */

'use strict';

require('dotenv').config();
const { getStats } = require('../lib/bookings');
const { applyCors, sendError, sendJson } = require('../lib/razorpay');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return; // preflight handled

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return sendError(res, Object.assign(new Error('Method not allowed. Use GET.'), { statusCode: 405 }));
  }

  try {
    res.setHeader('Cache-Control', 'public, max-age=60');
    return sendJson(res, { success: true, ...getStats() });
  } catch (error) {
    return sendError(res, error);
  }
};
