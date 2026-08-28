/**
 * ===========================================
 * LOCAL DEV / SELF-HOSTED SERVER
 * ===========================================
 * Serves the static site and mounts the same handlers that run as
 * serverless functions in production (/api/*).
 *
 *   npm install
 *   cp .env.example .env   # then fill in your Razorpay keys
 *   npm start              # http://localhost:3000
 */

'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');

const createOrderHandler = require('./api/create-order');
const verifyPaymentHandler = require('./api/verify-payment');
const configHandler = require('./api/config');
const consultationBookingHandler = require('./api/consultation-booking');
const statsHandler = require('./api/stats');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '100kb' }));

// --- API routes (identical handlers to the serverless deployment) ---
// `app.all` lets each handler return its own 405 for the wrong verb,
// matching the behaviour of the serverless runtime.
app.all('/api/config', configHandler);
app.all('/api/create-order', createOrderHandler);
app.all('/api/verify-payment', verifyPaymentHandler);
app.all('/api/consultation-booking', consultationBookingHandler);
app.all('/api/stats', statsHandler);

// --- Static site ---
app.use(express.static(__dirname, { extensions: ['html'] }));

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  const configured = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  console.log(`\n  India Fat to Fit  →  http://localhost:${PORT}`);
  console.log(`  Razorpay keys: ${configured ? 'loaded from .env' : 'MISSING — add them to .env'}\n`);
});
