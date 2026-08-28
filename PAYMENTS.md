# Razorpay Standard Web Checkout — Setup & Testing

The ₹999 consultation fee on the assessment form is collected through
[Razorpay Standard Checkout](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/).

Razorpay requires a server: orders must be created with your secret key, and every
payment must have its signature verified server-side. This repo was a static site, so
the integration ships as **serverless functions** (`/api`) plus a small **Express
server** (`server.js`) that runs the identical handlers for local development and
self-hosting.

---

## Architecture

```
Browser (index.html + app.js)
   │
   │ 1. POST /api/create-order   { amount: 99900 }
   ▼
Server ──► Razorpay Orders API ──► returns order_id + key_id
   │
   │ 2. Razorpay Checkout modal opens with order_id
   │    user pays → returns payment_id / order_id / signature
   ▼
   │ 3. POST /api/verify-payment  { all three fields }
   ▼
Server recomputes HMAC-SHA256(order_id|payment_id, KEY_SECRET)
   └─► match  → 200, form advances to the Thank You step
   └─► no match → 400, payment is NOT accepted
```

`RAZORPAY_KEY_SECRET` never leaves the server. The browser only ever receives the
public `key_id`, returned alongside each created order (and from `GET /api/config`).

---

## Files

| File | Role |
| --- | --- |
| `lib/razorpay.js` | Order creation, signature verification, validation, CORS, JSON helpers |
| `api/create-order.js` | `POST /api/create-order` |
| `api/verify-payment.js` | `POST /api/verify-payment` |
| `api/config.js` | `GET /api/config` — returns the public `key_id` only |
| `server.js` | Express dev/self-host server: mounts the API + serves the static site |
| `vercel.json` | Routes the three functions on Vercel |
| `.env` | Your real keys — **git-ignored, never commit** |
| `.env.example` | Template to copy |

---

## Local setup

```bash
npm install
cp .env.example .env      # then paste your keys from the Razorpay dashboard
npm start                 # http://localhost:3000
```

`.env`:

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxxx
RAZORPAY_KEY_SECRET=your_key_secret_here
PORT=3000
```

Get both from [Razorpay Dashboard → Account & Settings → API Keys](https://dashboard.razorpay.com/app/keys).
Keys beginning `rzp_test_` charge nothing; `rzp_live_` charge real money.

---

## Testing the payment flow

1. `npm start`, open <http://localhost:3000>.
2. Go to **Assessment**, complete steps 1–5, tick every consent checkbox.
3. Click **Pay ₹999 Securely** — the Razorpay modal opens with a **Test Mode** badge.
4. Pay with a test instrument:
   - **UPI**: enter `success@razorpay` as the VPA
   - **Card**: `4111 1111 1111 1111`, any future expiry, CVV `123`
   - To test a failure, use UPI `failure@razorpay`
5. On success the signature is verified and the form advances to the Thank You step.
6. Confirm the payment in [Dashboard → Transactions](https://dashboard.razorpay.com/app/payments).

### Testing the endpoints directly

```bash
# Create an order
curl -X POST http://localhost:3000/api/create-order \
  -H 'Content-Type: application/json' \
  -d '{"amount":99900,"currency":"INR","receipt":"test_001"}'

# Below the 100-paise minimum → 400
curl -X POST http://localhost:3000/api/create-order \
  -H 'Content-Type: application/json' -d '{"amount":50}'

# Tampered signature → 400, payment rejected
curl -X POST http://localhost:3000/api/verify-payment \
  -H 'Content-Type: application/json' \
  -d '{"razorpay_order_id":"order_x","razorpay_payment_id":"pay_x","razorpay_signature":"bad"}'
```

---

## Error handling

**Create order** — non-integer or missing amount → 400; below 100 paise → 400; bad
API keys → 401; any other Razorpay API failure → 500.

**Verify signature** — missing field → 400 naming the field; signature mismatch →
400 and the payment is never marked paid. Comparison uses
`crypto.timingSafeEqual`.

**Frontend** — the button disables and shows progress while an order is created;
`modal.ondismiss` reports a cancelled payment; `payment.failed` shows Razorpay's
own reason; a verification failure tells the patient not to retry and to quote their
payment ID. All messages render in the `#paymentStatus` banner below the button.

---

## Deploying

### Vercel (recommended — keeps the static site and adds the API)

```bash
npm i -g vercel
vercel
vercel env add RAZORPAY_KEY_ID
vercel env add RAZORPAY_KEY_SECRET
vercel --prod
```

Then point `indiafattofit.com` at the Vercel deployment.

### Netlify

Move the three files to `netlify/functions/` and add to `netlify.toml`:

```toml
[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/:splat"
  status = 200
```

### Any Node host (Render, Railway, VPS)

`npm start` serves both the API and the site on `PORT`.

### GitHub Pages

Pages is static-only and **cannot** run these endpoints. Either host the whole site
on Vercel/Netlify, or keep Pages for the site and deploy the API separately — in
which case add one line to `index.html` pointing at the API host:

```html
<script>window.API_BASE = "https://api.indiafattofit.com";</script>
```

and set `ALLOWED_ORIGIN=https://indiafattofit.com` in the API's environment so CORS
is restricted to your domain.

---

## Before going live

- [ ] Replace the test keys in `.env` with `rzp_live_*` keys and complete Razorpay KYC.
- [ ] Set `ALLOWED_ORIGIN` to your production domain.
- [ ] Persist verified payments. The admin queue currently keeps submissions in
      `window.__patientSubmissions`, which is lost on reload — move it to a database
      so paid consultations survive and the doctor queue is durable.
- [ ] Add a [Razorpay webhook](https://razorpay.com/docs/webhooks/) for
      `payment.captured` so a patient who closes the tab mid-redirect is still recorded.
- [ ] Charge the program tiers (₹4,999 / ₹12,999 / ₹21,999 / ₹29,999) through the same
      two endpoints — pass the amount in paise; no new code is needed.
- [ ] Keep the no-refund policy visible on the checkout step, as Razorpay requires a
      published refund policy.
