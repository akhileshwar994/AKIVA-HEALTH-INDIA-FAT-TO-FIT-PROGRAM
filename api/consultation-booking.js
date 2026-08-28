/**
 * POST /api/consultation-booking
 *
 * Called after the ₹999 consultation payment is verified and the patient has
 * submitted their contact details (including an alternate phone number).
 *
 * The payment is re-confirmed directly with Razorpay before anything is
 * recorded, so a caller cannot fabricate a booking.
 *
 * Returns: { success, booking_id, whatsapp_url, doctor }
 */

'use strict';

require('dotenv').config();
const { createBooking } = require('../lib/bookings');
const { applyCors, readJsonBody, sendError, sendJson } = require('../lib/razorpay');

module.exports = async function handler(req, res) {
  if (applyCors(req, res)) return; // preflight handled

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendError(res, Object.assign(new Error('Method not allowed. Use POST.'), { statusCode: 405 }));
  }

  try {
    const body = await readJsonBody(req);
    const result = await createBooking(body);
    return sendJson(res, { success: true, ...result });
  } catch (error) {
    return sendError(res, error);
  }
};
