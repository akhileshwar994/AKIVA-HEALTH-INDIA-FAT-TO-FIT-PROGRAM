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

### The ₹999 consultation funnel

`consult.js` drives a second, self-contained flow on top of the same two endpoints:

```
Stage 1  Offer      ₹2,999 struck → ₹999, consent checkbox, Pay button
   │              POST /api/create-order → Razorpay Checkout → POST /api/verify-payment
   ▼
Stage 2  Details    Name, WhatsApp number, ALTERNATE number (must differ), email,
   │              age, sex, city, language, preferred slot, concern, referral code
   │              POST /api/consultation-booking  ← re-verifies the signature server-side
   ▼
Stage 3  WhatsApp   Booking ID (IFTF-XXXXXX), "Open WhatsApp Chat" button that opens
                  wa.me/<DOCTOR_WHATSAPP> pre-filled with the booking summary,
                  plus a referral code the patient can copy or share
```

`/api/consultation-booking` calls `verifyPayment()` **before** it writes anything, so a
forged or replayed payment id returns 400 and no booking is created. It then confirms
the payment exists and is captured at Razorpay. Only then is the record written.

Bookings append as JSON lines to `data/bookings.jsonl` (git-ignored; override the path
with `BOOKINGS_FILE`). This is best-effort: **on Vercel and other serverless hosts the
filesystem is read-only and ephemeral**, so the endpoint logs a warning, still returns
the WhatsApp link, and sets `persisted: false`. Move this to a database (or a Razorpay
`payment.captured` webhook writing to one) before you rely on it as the booking record.

The social-proof strip fed by `GET /api/stats` stays hidden until there are at least 5
real bookings — it never shows invented numbers.

Deep link: `https://indiafattofit.com/#consult` opens the consultation modal directly,
which is what the announcement bar, the nav button, the mobile bar and any ad campaign
link should point at.

---

## Files

| File | Role |
| --- | --- |
| `lib/razorpay.js` | Order creation, signature verification, validation, CORS, JSON helpers |
| `lib/bookings.js` | Consultation booking record, WhatsApp link builder, aggregate stats |
| `api/create-order.js` | `POST /api/create-order` |
| `api/verify-payment.js` | `POST /api/verify-payment` |
| `api/config.js` | `GET /api/config` — returns the public `key_id` only |
| `api/consultation-booking.js` | `POST /api/consultation-booking` — re-verifies the payment, stores the booking, returns the WhatsApp handoff link |
| `api/stats.js` | `GET /api/stats` — anonymous booking counts for the social-proof strip |
| `consult.js` | The ₹999 consultation funnel: announcement bar, offer popup, nav button, 3-stage modal, referral share |
| `server.js` | Express dev/self-host server: mounts the API + serves the static site |
| `vercel.json` | Routes the five functions on Vercel |
| `netlify.toml` | Publishes the site and redirects `/api/*` to Netlify Functions |
| `netlify/functions/_adapter.js` | Runs the `api/` handlers as Netlify Functions (no duplicated logic) |
| `netlify/functions/*.js` | One three-line wrapper per endpoint |
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

### Netlify (this is how indiafattofit.com is hosted)

Already wired up: `netlify.toml` publishes the site from the repo root, points
`functions` at `netlify/functions/`, and redirects every `/api/*` path to the matching
function. `netlify/functions/_adapter.js` runs the same handlers from `api/`, so there
is one implementation per endpoint shared by Netlify, Vercel and the local server.

**You must set the environment variables in the Netlify dashboard.** Netlify never reads
your local `.env`. Go to *Site configuration → Environment variables* and add:

| Key | Value |
| --- | --- |
| `RAZORPAY_KEY_ID` | `rzp_test_*` while testing, `rzp_live_*` in production |
| `RAZORPAY_KEY_SECRET` | from the Razorpay dashboard |
| `ALLOWED_ORIGIN` | `https://indiafattofit.com` |
| `DOCTOR_WHATSAPP` | `917801009912` |

Then trigger a redeploy — environment variables only apply to builds that run after
they are saved. Confirm it worked:

```bash
curl https://indiafattofit.com/api/config
# {"success":true,"key_id":"rzp_...","currency":"INR"}
```

If that returns **404**, the functions did not deploy (check the deploy log for
`netlify/functions`). If it returns **500**, the keys are missing from the dashboard.

Note that Netlify's filesystem is read-only, so `data/bookings.jsonl` will not persist
there — bookings return `persisted: false` and the WhatsApp message is the record. See
"The ₹999 consultation funnel" above.

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
- [ ] Set `DOCTOR_WHATSAPP` to the number that should receive bookings (digits with
      country code, no `+` — e.g. `917801009912`). It defaults to `917801009912`.
- [ ] Replace `data/bookings.jsonl` with a database if you deploy serverless; see
      "The ₹999 consultation funnel" above.
- [ ] Honour the referral codes. `consult.js` issues them and accepts one on the form,
      but nothing redeems them yet — the ₹500 discount is a manual step today.
