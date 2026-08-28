/**
 * ===========================================
 * CONSULTATION BOOKINGS
 * ===========================================
 * Records a doctor consultation booking after its payment has been
 * confirmed with Razorpay, and builds the WhatsApp hand-off link.
 *
 * Storage is a newline-delimited JSON file — no database, no schema.
 * On read-only/ephemeral hosts (Vercel, Netlify) the write is skipped
 * rather than failing the booking, so the patient still reaches WhatsApp.
 * See PAYMENTS.md for how to make bookings durable in production.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { verifyPayment } = require('./razorpay');

const CONSULT_FEE_PAISE = 99900; // ₹999 offer price
const CONSULT_LIST_PAISE = 299900; // ₹2,999 list price

const DOCTOR = {
  name: 'Dr. Akhileshwar Reddy Vangala',
  credentials: 'MBBS, MD (Community and Family Medicine)',
  whatsapp: (process.env.DOCTOR_WHATSAPP || '917801009912').replace(/\D/g, ''),
};

const BOOKINGS_FILE =
  process.env.BOOKINGS_FILE || path.join(__dirname, '..', 'data', 'bookings.jsonl');

/* ---------------------------------------------------------------- helpers */

function fail(message, statusCode = 400) {
  const err = new Error(message);
  err.statusCode = statusCode;
  throw err;
}

/** Trim, collapse whitespace, cap length. */
function clean(value, max = 200) {
  return String(value == null ? '' : value)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Normalise an Indian mobile number to 10 digits; '' if not usable. */
function normalisePhone(value) {
  const digits = String(value == null ? '' : value).replace(/\D/g, '');
  const local = digits.length > 10 ? digits.slice(-10) : digits;
  return /^[6-9]\d{9}$/.test(local) ? local : '';
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

/** IFTF-8K3M2Q — short, readable, unambiguous. */
function makeBookingId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1
  let out = '';
  for (const byte of crypto.randomBytes(6)) out += alphabet[byte % alphabet.length];
  return `IFTF-${out}`;
}

/* -------------------------------------------------- payment confirmation */

/**
 * Ask Razorpay directly whether this payment really succeeded, and whether it
 * belongs to the order and covers the consultation fee. The browser is never
 * trusted for this — a caller could otherwise post arbitrary payment ids.
 */
async function confirmPaymentWithRazorpay(paymentId, orderId) {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) fail('Razorpay credentials are not configured.', 500);

  let payment;
  try {
    payment = await new Razorpay({ key_id: keyId, key_secret: keySecret }).payments.fetch(paymentId);
  } catch (apiError) {
    const status = apiError.statusCode || apiError.status;
    if (status === 400 || status === 404) fail('That payment could not be found at Razorpay.', 400);
    if (status === 401) fail('Razorpay authentication failed.', 401);
    fail('Could not confirm the payment with Razorpay. Please try again.', 502);
  }

  if (!['captured', 'authorized'].includes(payment.status)) {
    fail(`Payment is not successful (status: ${payment.status}).`, 400);
  }
  if (orderId && payment.order_id && payment.order_id !== orderId) {
    fail('Payment does not belong to the given order.', 400);
  }
  if (Number(payment.amount) < CONSULT_FEE_PAISE) {
    fail('Payment amount is less than the consultation fee.', 400);
  }

  return payment;
}

/* -------------------------------------------------------------- storage */

function appendBooking(record) {
  try {
    fs.mkdirSync(path.dirname(BOOKINGS_FILE), { recursive: true });
    fs.appendFileSync(BOOKINGS_FILE, JSON.stringify(record) + '\n', 'utf8');
    return true;
  } catch (error) {
    // Read-only or ephemeral filesystem (serverless). Never block the booking.
    console.warn('[bookings] could not persist booking %s: %s', record.booking_id, error.message);
    return false;
  }
}

function readBookings() {
  try {
    return fs
      .readFileSync(BOOKINGS_FILE, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch (_) {
          return null;
        }
      })
      .filter(Boolean);
  } catch (_) {
    return [];
  }
}

/* -------------------------------------------------------- WhatsApp link */

function buildWhatsAppLink(booking) {
  const lines = [
    `Hello ${DOCTOR.name}, my consultation is booked and paid.`,
    '',
    `Booking ID: ${booking.booking_id}`,
    `Name: ${booking.name}`,
    `Age / Sex: ${booking.age || '—'} / ${booking.sex || '—'}`,
    `City: ${booking.city || '—'}`,
    `Phone: +91 ${booking.phone}`,
    booking.alt_phone ? `Alternate phone: +91 ${booking.alt_phone}` : null,
    `Email: ${booking.email || '—'}`,
    `Preferred time: ${booking.preferred_slot || 'Any time'}`,
    `Language: ${booking.language || '—'}`,
    '',
    `Main concern: ${booking.concern || '—'}`,
    '',
    `Paid: ₹${(CONSULT_FEE_PAISE / 100).toLocaleString('en-IN')} (Payment ID: ${booking.payment_id})`,
    'Please confirm my consultation slot.',
  ].filter((line) => line !== null);

  return `https://wa.me/${DOCTOR.whatsapp}?text=${encodeURIComponent(lines.join('\n'))}`;
}

/* --------------------------------------------------------- main entry pt */

/**
 * Validate contact details, confirm the payment with Razorpay, store the
 * booking, and return the booking id plus the WhatsApp hand-off URL.
 */
async function createBooking(payload = {}) {
  const paymentId = clean(payload.razorpay_payment_id, 60);
  const orderId = clean(payload.razorpay_order_id, 60);
  if (!paymentId) fail('Missing required field: razorpay_payment_id.');

  const name = clean(payload.name, 80);
  const phone = normalisePhone(payload.phone);
  const altPhone = normalisePhone(payload.alt_phone);
  const email = clean(payload.email, 120).toLowerCase();

  if (name.length < 2) fail('Please enter your full name.');
  if (!phone) fail('Please enter a valid 10-digit Indian mobile number.');
  if (!altPhone) fail('Please enter a valid 10-digit alternate mobile number.');
  if (altPhone === phone) fail('The alternate number must be different from your primary number.');
  if (email && !isEmail(email)) fail('Please enter a valid email address.');

  // Two independent checks before anything is recorded:
  //  1. the checkout signature must be a valid HMAC over order_id|payment_id
  //  2. Razorpay itself must confirm the payment succeeded for the right amount
  verifyPayment({
    razorpay_order_id: orderId,
    razorpay_payment_id: paymentId,
    razorpay_signature: clean(payload.razorpay_signature, 200),
  });

  const payment = await confirmPaymentWithRazorpay(paymentId, orderId);

  const booking = {
    booking_id: makeBookingId(),
    created_at: new Date().toISOString(),
    name,
    phone,
    alt_phone: altPhone,
    email,
    age: clean(payload.age, 3),
    sex: clean(payload.sex, 20),
    city: clean(payload.city, 60),
    language: clean(payload.language, 40),
    preferred_slot: clean(payload.preferred_slot, 60),
    concern: clean(payload.concern, 600),
    consent_telemedicine: Boolean(payload.consent_telemedicine),
    referral_code: clean(payload.referral_code, 24).toUpperCase(),
    payment_id: paymentId,
    order_id: orderId || payment.order_id || '',
    amount_paise: Number(payment.amount),
    payment_status: payment.status,
    payment_method: payment.method || '',
    status: 'Awaiting doctor confirmation',
  };

  booking.persisted = appendBooking(booking);

  return {
    booking_id: booking.booking_id,
    whatsapp_url: buildWhatsAppLink(booking),
    doctor: { name: DOCTOR.name, credentials: DOCTOR.credentials },
    persisted: booking.persisted,
  };
}

/** Honest, non-identifying counters for the site's social proof strip. */
function getStats() {
  const bookings = readBookings();
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return {
    total_consultations: bookings.length,
    consultations_this_week: bookings.filter((b) => Date.parse(b.created_at) >= weekAgo).length,
    cities: [...new Set(bookings.map((b) => b.city).filter(Boolean))].length,
  };
}

module.exports = {
  CONSULT_FEE_PAISE,
  CONSULT_LIST_PAISE,
  DOCTOR,
  createBooking,
  getStats,
  readBookings,
  buildWhatsAppLink,
};
