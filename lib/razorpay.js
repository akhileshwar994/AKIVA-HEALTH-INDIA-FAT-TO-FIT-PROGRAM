/**
 * ===========================================
 * RAZORPAY BACKEND CORE
 * ===========================================
 * Shared logic used by both the local Express server (server.js)
 * and the serverless functions in /api.
 *
 * Credentials are read from environment variables only.
 * RAZORPAY_KEY_SECRET must NEVER be sent to the browser.
 */

'use strict';

const crypto = require('crypto');
const Razorpay = require('razorpay');

const MIN_AMOUNT_PAISE = 100; // Razorpay minimum: ₹1.00

/** Lazily created singleton so a missing key fails loudly at request time, not import time. */
let client = null;

function getKeys() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    const err = new Error(
      'Razorpay credentials missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in your .env file.'
    );
    err.statusCode = 500;
    throw err;
  }
  return { keyId, keySecret };
}

function getClient() {
  if (!client) {
    const { keyId, keySecret } = getKeys();
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return client;
}

/**
 * Public config for the frontend. Key ID only — never the secret.
 * @returns {{ key_id: string, currency: string }}
 */
function getPublicConfig() {
  const { keyId } = getKeys();
  return { key_id: keyId, currency: 'INR' };
}

/**
 * Create a Razorpay order.
 * @param {{ amount:number, currency?:string, receipt?:string, notes?:object }} payload
 * @returns {Promise<{order_id:string, amount:number, currency:string, key_id:string, receipt:string}>}
 */
async function createOrder(payload = {}) {
  const amount = Number(payload.amount);
  const currency = (payload.currency || 'INR').toUpperCase();

  if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
    const err = new Error('`amount` is required and must be an integer number of paise.');
    err.statusCode = 400;
    throw err;
  }
  if (amount < MIN_AMOUNT_PAISE) {
    const err = new Error(`Amount must be at least ${MIN_AMOUNT_PAISE} paise (₹1.00).`);
    err.statusCode = 400;
    throw err;
  }

  const receipt = String(payload.receipt || `iftf_${Date.now()}`).slice(0, 40);

  try {
    const order = await getClient().orders.create({
      amount,
      currency,
      receipt,
      notes: payload.notes && typeof payload.notes === 'object' ? payload.notes : {},
    });

    return {
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      key_id: getKeys().keyId,
    };
  } catch (apiError) {
    const status = apiError.statusCode || apiError.status;
    const description =
      (apiError.error && apiError.error.description) || apiError.message || 'Razorpay API error.';

    // Bad or revoked API keys
    if (status === 401) {
      const err = new Error('Razorpay authentication failed. Check RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET.');
      err.statusCode = 401;
      throw err;
    }

    const err = new Error(`Could not create Razorpay order: ${description}`);
    err.statusCode = 500;
    throw err;
  }
}

/**
 * Verify the payment signature returned by Razorpay Checkout.
 * Signature = HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * @param {{ razorpay_order_id:string, razorpay_payment_id:string, razorpay_signature:string }} payload
 * @returns {{ verified:true, payment_id:string, order_id:string }}
 */
function verifyPayment(payload = {}) {
  const orderId = payload.razorpay_order_id;
  const paymentId = payload.razorpay_payment_id;
  const signature = payload.razorpay_signature;

  const missing = [];
  if (!orderId) missing.push('razorpay_order_id');
  if (!paymentId) missing.push('razorpay_payment_id');
  if (!signature) missing.push('razorpay_signature');

  if (missing.length) {
    const err = new Error(`Missing required field(s): ${missing.join(', ')}.`);
    err.statusCode = 400;
    throw err;
  }

  const { keySecret } = getKeys();
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  // Constant-time comparison to avoid timing leaks
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(String(signature), 'utf8');
  const match = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!match) {
    const err = new Error('Payment signature verification failed. Payment NOT marked as paid.');
    err.statusCode = 400;
    throw err;
  }

  return { verified: true, payment_id: paymentId, order_id: orderId };
}

/**
 * Read and JSON-parse a request body across runtimes.
 * Vercel/Express usually pre-parse; fall back to reading the stream.
 */
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string' && req.body.length) {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      const err = new Error('Request body is not valid JSON.');
      err.statusCode = 400;
      throw err;
    }
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch (_) {
    const err = new Error('Request body is not valid JSON.');
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Allow the frontend to call the API from another origin when the static site
 * and the API are deployed separately. Set ALLOWED_ORIGIN in the environment to
 * lock this down to your own domain (e.g. https://indiafattofit.com).
 * Returns true if the request was a preflight and has been fully answered.
 */
function applyCors(req, res) {
  const allowed = process.env.ALLOWED_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }
  return false;
}

/** Uniform JSON error response. */
function sendError(res, error) {
  const status = error.statusCode || 500;
  if (status >= 500) console.error('[razorpay]', error.message);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ success: false, error: error.message }));
}

/** Uniform JSON success response. */
function sendJson(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(data));
}

module.exports = {
  MIN_AMOUNT_PAISE,
  getPublicConfig,
  createOrder,
  verifyPayment,
  readJsonBody,
  applyCors,
  sendError,
  sendJson,
};
