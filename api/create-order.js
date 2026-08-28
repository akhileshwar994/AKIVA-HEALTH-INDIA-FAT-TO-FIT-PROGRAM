/**
 * POST /api/create-order
 * Body: { amount: <paise>, currency?: "INR", receipt?: string, notes?: object }
 * Returns: { success, order_id, amount, currency, key_id, receipt }
 */

'use strict';

require('dotenv').config();
const { applyCors, createOrder, readJsonBody, sendError, sendJson } = require('../lib/razorpay');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return; // preflight handled

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, Object.assign(new Error('Method not allowed. Use POST.'), { statusCode: 405 }));
  }

  try {
    const body = await readJsonBody(req);
    const order = await createOrder(body);
    return sendJson(res, { success: true, ...order });
  } catch (error) {
    return sendError(res, error);
  }
};
