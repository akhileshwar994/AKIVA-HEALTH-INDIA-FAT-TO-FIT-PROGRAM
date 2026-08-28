/**
 * POST /api/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 * Returns 200 { success:true, verified:true, ... } only when the
 * HMAC-SHA256 signature matches. Otherwise 400 and the payment
 * must NOT be treated as paid.
 */

'use strict';

require('dotenv').config();
const { applyCors, verifyPayment, readJsonBody, sendError, sendJson } = require('../lib/razorpay');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return; // preflight handled

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, Object.assign(new Error('Method not allowed. Use POST.'), { statusCode: 405 }));
  }

  try {
    const body = await readJsonBody(req);
    const result = verifyPayment(body);
    return sendJson(res, { success: true, message: 'Payment verified successfully.', ...result });
  } catch (error) {
    return sendError(res, error);
  }
};
