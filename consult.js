
/* ==========================================================================
   DOCTOR CONSULTATION OFFER
   Announcement strip, offer pop-up, ₹999 booking flow and WhatsApp hand-off.

   Flow: /api/create-order -> Razorpay Checkout -> /api/verify-payment
         -> contact form -> /api/consultation-booking -> WhatsApp deep link
   ========================================================================== */
(function () {
  'use strict';

  const API_BASE = (window.API_BASE || '').replace(/\/$/, '');
  const FEE_PAISE = 99900;   // ₹999 discounted price
  const LIST_PAISE = 299900; // ₹2,999 stated value
  const WHATSAPP_NUMBER = '917801009912';
  const OFFER_HOLD_SECONDS = 10 * 60;
  const POPUP_DELAY_MS = 12000;

  // Session-scoped flags kept in cookies: they survive a page reload, expire
  // when the browser closes, and work in sandboxed/embedded contexts where the
  // storage APIs are unavailable.
  const store = {
    get(key) {
      const match = document.cookie.match(new RegExp('(?:^|; )' + key + '=([^;]*)'));
      return match ? decodeURIComponent(match[1]) : null;
    },
    set(key, value) {
      try {
        document.cookie = key + '=' + encodeURIComponent(value) + '; path=/; SameSite=Lax';
      } catch (_) { /* cookies blocked — the flow still works, just repeats */ }
    },
  };

  function $(id) { return document.getElementById(id); }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      window.lucide.createIcons();
    }
  }

  async function postJson(path, payload) {
    const res = await fetch(API_BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    let body = {};
    try { body = await res.json(); } catch (_) { /* non-JSON response */ }
    if (!res.ok || body.success === false) {
      throw new Error(body.error || 'Request failed (HTTP ' + res.status + ').');
    }
    return body;
  }

  /* ---------------------------------------------------------------- *
   * Announcement strip
   * ---------------------------------------------------------------- */
  const announceBar = $('announceBar');

  function measureAnnounce() {
    if (!announceBar || announceBar.classList.contains('is-dismissed')) return;
    const height = announceBar.offsetHeight;
    if (height) {
      document.documentElement.style.setProperty('--announce-h', height + 'px');
    }
  }

  if (announceBar) {
    if (store.get('iftf_announce_dismissed') === '1') {
      announceBar.classList.add('is-dismissed');
    } else {
      document.body.classList.add('has-announce');
      measureAnnounce();
      window.addEventListener('resize', measureAnnounce, { passive: true });
    }

    const announceClose = $('announceClose');
    if (announceClose) {
      announceClose.addEventListener('click', function () {
        announceBar.classList.add('is-dismissed');
        document.body.classList.remove('has-announce');
        store.set('iftf_announce_dismissed', '1');
      });
    }
  }

  /* ---------------------------------------------------------------- *
   * Offer pop-up: timed + exit-intent, once per browsing session
   * ---------------------------------------------------------------- */
  const offerPopup = $('offerPopup');
  let countdownTimer = null;

  function startCountdown() {
    const label = $('offerCountdown');
    if (!label || countdownTimer) return;

    let deadline = parseInt(store.get('iftf_offer_deadline'), 10);
    if (!deadline || Number.isNaN(deadline) || deadline < Date.now()) {
      deadline = Date.now() + OFFER_HOLD_SECONDS * 1000;
      store.set('iftf_offer_deadline', String(deadline));
    }

    const tick = function () {
      const remaining = Math.max(0, Math.round((deadline - Date.now()) / 1000));
      const minutes = Math.floor(remaining / 60);
      const seconds = remaining % 60;
      label.textContent = minutes + ':' + String(seconds).padStart(2, '0');
      if (remaining === 0) {
        window.clearInterval(countdownTimer);
        countdownTimer = null;
        const timer = $('offerTimer');
        if (timer) {
          timer.innerHTML = '<span>Offer price still honoured for today &mdash; book now.</span>';
        }
      }
    };

    tick();
    countdownTimer = window.setInterval(tick, 1000);
  }

  function openPopup() {
    if (!offerPopup) return;
    if (store.get('iftf_popup_seen') === '1') return;
    if (consultOverlay && !consultOverlay.hidden) return;

    offerPopup.hidden = false;
    document.body.style.overflow = 'hidden';
    store.set('iftf_popup_seen', '1');
    startCountdown();
    refreshIcons();
  }

  function closePopup() {
    if (!offerPopup) return;
    offerPopup.hidden = true;
    if (!consultOverlay || consultOverlay.hidden) {
      document.body.style.overflow = '';
    }
  }

  if (offerPopup) {
    if (store.get('iftf_popup_seen') !== '1') {
      window.setTimeout(openPopup, POPUP_DELAY_MS);

      // Exit intent: pointer leaves through the top of the viewport.
      document.addEventListener('mouseout', function (event) {
        if (!event.relatedTarget && event.clientY <= 4) openPopup();
      });
    }

    const popupClose = $('offerPopupClose');
    const popupDismiss = $('offerPopupDismiss');
    if (popupClose) popupClose.addEventListener('click', closePopup);
    if (popupDismiss) popupDismiss.addEventListener('click', closePopup);

    offerPopup.addEventListener('click', function (event) {
      if (event.target === offerPopup) closePopup();
    });
  }

  /* ---------------------------------------------------------------- *
   * Consultation modal
   * ---------------------------------------------------------------- */
  const consultOverlay = $('consultOverlay');
  if (!consultOverlay) return;

  const consultStatus = $('consultStatus');
  const consultFormStatus = $('consultFormStatus');
  const consultPayBtn = $('consultPayBtn');
  const consultConsent = $('consultConsent');
  const consultForm = $('consultForm');
  const consultSubmitBtn = $('consultSubmitBtn');

  let payment = null;        // { order_id, payment_id, signature }
  let redirectTimer = null;

  function setStage(stage) {
    consultOverlay.querySelectorAll('.consult__stage').forEach(function (section) {
      section.classList.toggle('is-active', Number(section.dataset.stage) === stage);
    });
    consultOverlay.querySelectorAll('.consult__stepdot').forEach(function (dot) {
      const index = Number(dot.dataset.dot);
      dot.classList.toggle('is-active', index === stage);
      dot.classList.toggle('is-done', index < stage);
    });
    consultOverlay.scrollTop = 0;
    refreshIcons();
  }

  function setStatus(node, message, type) {
    if (!node) return;
    if (!message) {
      node.hidden = true;
      node.textContent = '';
      node.className = 'consult-status';
      return;
    }
    node.hidden = false;
    node.textContent = message;
    node.className = 'consult-status consult-status--' + (type || 'info');
  }

  function setBusy(button, isBusy, label) {
    if (!button) return;
    button.disabled = isBusy;
    button.classList.toggle('is-loading', isBusy);
    if (isBusy) {
      button.dataset.originalHtml = button.dataset.originalHtml || button.innerHTML;
      button.textContent = label || 'Processing…';
    } else if (button.dataset.originalHtml) {
      button.innerHTML = button.dataset.originalHtml;
      refreshIcons();
    }
  }

  function openConsult(source) {
    closePopup();
    consultOverlay.hidden = false;
    document.body.style.overflow = 'hidden';
    consultOverlay.dataset.source = source || 'unknown';
    if (!payment) setStage(1);
    startCountdown();
    refreshIcons();
  }

  function closeConsult() {
    // Never trap someone who has paid but not yet submitted their details.
    if (payment && !consultOverlay.querySelector('[data-stage="3"]').classList.contains('is-active')) {
      const leave = window.confirm(
        'Your ₹999 payment is already confirmed. If you close now, your contact details are not submitted ' +
        'and the doctor cannot reach you. Close anyway?'
      );
      if (!leave) return;
    }
    consultOverlay.hidden = true;
    document.body.style.overflow = '';
    if (redirectTimer) { window.clearTimeout(redirectTimer); redirectTimer = null; }
  }

  document.querySelectorAll('[data-open-consult]').forEach(function (trigger) {
    trigger.addEventListener('click', function (event) {
      event.preventDefault();
      openConsult(trigger.getAttribute('data-open-consult'));
    });
  });

  const consultClose = $('consultClose');
  if (consultClose) consultClose.addEventListener('click', closeConsult);

  consultOverlay.addEventListener('click', function (event) {
    if (event.target === consultOverlay) closeConsult();
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    if (offerPopup && !offerPopup.hidden) closePopup();
    else if (!consultOverlay.hidden) closeConsult();
  });

  /* ---------------------------------------------------------------- *
   * Stage 1 — pay ₹999
   * ---------------------------------------------------------------- */
  if (consultPayBtn) {
    consultPayBtn.addEventListener('click', async function () {
      if (consultConsent && !consultConsent.checked) {
        setStatus(consultStatus, 'Please give teleconsultation consent before paying.', 'error');
        return;
      }
      if (!window.Razorpay) {
        setStatus(consultStatus, 'Payment library did not load. Check your connection and reload the page.', 'error');
        return;
      }

      setStatus(consultStatus, '');
      setBusy(consultPayBtn, true, 'Creating secure order…');

      try {
        const order = await postJson('/api/create-order', {
          amount: FEE_PAISE,
          currency: 'INR',
          receipt: 'consult_' + Date.now(),
          notes: {
            purpose: 'doctor_consultation',
            list_price_paise: String(LIST_PAISE),
            source: consultOverlay.dataset.source || 'unknown',
          },
        });

        setBusy(consultPayBtn, false);

        const rzp = new window.Razorpay({
          key: order.key_id,
          amount: order.amount,
          currency: order.currency,
          order_id: order.order_id,
          name: 'India Fat to Fit',
          description: 'Expert Doctor Consultation (worth ₹2,999)',
          notes: { receipt: order.receipt, purpose: 'doctor_consultation' },
          theme: { color: '#E63946' },

          handler: async function (response) {
            setBusy(consultPayBtn, true, 'Verifying payment…');
            try {
              await postJson('/api/verify-payment', {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              });

              payment = {
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              };

              const ref = $('consultPaidRef');
              if (ref) ref.textContent = 'Payment ID ' + payment.payment_id;

              setBusy(consultPayBtn, false);
              setStatus(consultStatus, '');
              setStage(2);
              const nameField = $('cName');
              if (nameField) nameField.focus();
            } catch (verifyError) {
              setBusy(consultPayBtn, false);
              setStatus(consultStatus,
                'We could not verify your payment (' + verifyError.message + '). Do not pay again — ' +
                'message us on WhatsApp with payment ID ' + response.razorpay_payment_id + ' and we will confirm your booking.',
                'error');
            }
          },

          modal: {
            ondismiss: function () {
              setBusy(consultPayBtn, false);
              setStatus(consultStatus, 'Payment cancelled. The ₹999 offer price is still available.', 'warn');
            },
          },
        });

        rzp.on('payment.failed', function (response) {
          setBusy(consultPayBtn, false);
          const err = (response && response.error) || {};
          setStatus(consultStatus,
            'Payment failed: ' + (err.description || 'Unknown error') +
            (err.reason ? ' (' + err.reason + ')' : '') + '. Please try another method — UPI usually works best.',
            'error');
        });

        rzp.open();
      } catch (orderError) {
        setBusy(consultPayBtn, false);
        setStatus(consultStatus, 'Could not start payment: ' + orderError.message, 'error');
      }
    });
  }

  /* ---------------------------------------------------------------- *
   * Stage 2 — contact details (primary + alternate phone)
   * ---------------------------------------------------------------- */
  function digitsOnly(value) {
    return String(value || '').replace(/\D/g, '').slice(-10);
  }

  ['cPhone', 'cAltPhone'].forEach(function (id) {
    const field = $(id);
    if (!field) return;
    field.addEventListener('input', function () {
      field.value = field.value.replace(/\D/g, '').slice(0, 10);
      field.classList.remove('is-invalid');
    });
  });

  function validateContact() {
    const errors = [];
    const name = ($('cName').value || '').trim();
    const phone = digitsOnly($('cPhone').value);
    const altPhone = digitsOnly($('cAltPhone').value);
    const email = ($('cEmail').value || '').trim();

    [['cName', name.length >= 2], ['cPhone', /^[6-9]\d{9}$/.test(phone)],
     ['cAltPhone', /^[6-9]\d{9}$/.test(altPhone) && altPhone !== phone]].forEach(function (pair) {
      const field = $(pair[0]);
      if (field) field.classList.toggle('is-invalid', !pair[1]);
    });

    if (name.length < 2) errors.push('your full name');
    if (!/^[6-9]\d{9}$/.test(phone)) errors.push('a valid 10-digit WhatsApp number');
    if (!/^[6-9]\d{9}$/.test(altPhone)) errors.push('a valid 10-digit alternate number');
    else if (altPhone === phone) errors.push('an alternate number different from your WhatsApp number');
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) errors.push('a valid email address');

    return {
      errors: errors,
      payload: {
        name: name,
        phone: phone,
        alt_phone: altPhone,
        email: email,
        age: ($('cAge').value || '').trim(),
        sex: $('cSex').value,
        city: ($('cCity').value || '').trim(),
        language: $('cLanguage').value,
        preferred_slot: $('cSlot').value,
        concern: ($('cConcern').value || '').trim(),
        referral_code: ($('cReferral').value || '').trim(),
        consent_telemedicine: true,
      },
    };
  }

  if (consultForm) {
    consultForm.addEventListener('submit', async function (event) {
      event.preventDefault();

      if (!payment) {
        setStatus(consultFormStatus, 'We have no verified payment on record for this session. Please start again.', 'error');
        return;
      }

      const check = validateContact();
      if (check.errors.length) {
        setStatus(consultFormStatus, 'Please provide ' + check.errors.join(', ') + '.', 'error');
        return;
      }

      setStatus(consultFormStatus, '');
      setBusy(consultSubmitBtn, true, 'Confirming your booking…');

      try {
        const result = await postJson('/api/consultation-booking', Object.assign({}, check.payload, {
          razorpay_order_id: payment.order_id,
          razorpay_payment_id: payment.payment_id,
          razorpay_signature: payment.signature,
        }));

        setBusy(consultSubmitBtn, false);
        showSuccess(result, check.payload);
      } catch (bookingError) {
        setBusy(consultSubmitBtn, false);
        setStatus(consultFormStatus,
          'We could not save your booking: ' + bookingError.message +
          ' Your payment is safe — message us on WhatsApp with payment ID ' + payment.payment_id + '.',
          'error');
      }
    });
  }

  /* ---------------------------------------------------------------- *
   * Stage 3 — success, WhatsApp hand-off and referral share
   * ---------------------------------------------------------------- */
  function showSuccess(result, contact) {
    const bookingId = result.booking_id || '—';
    const whatsAppUrl = result.whatsapp_url ||
      ('https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(
        'Hello Doctor, my consultation is booked. Booking ID ' + bookingId + '. Name: ' + contact.name + '.'
      ));

    const idNode = $('consultBookingId');
    if (idNode) idNode.textContent = bookingId;

    const waBtn = $('consultWhatsAppBtn');
    if (waBtn) waBtn.setAttribute('href', whatsAppUrl);

    const referralCode = result.referral_code || bookingId;
    const codeNode = $('consultReferCode');
    if (codeNode) codeNode.textContent = referralCode;

    const shareBtn = $('consultShareBtn');
    if (shareBtn) {
      const shareText =
        'I just booked an expert doctor consultation on India Fat to Fit for ₹999 instead of ₹2,999 ' +
        '(MBBS, MD doctor — GLP-1 weight loss). Use my referral code ' + referralCode +
        ' to get the same price: https://indiafattofit.com';
      shareBtn.setAttribute('href', 'https://wa.me/?text=' + encodeURIComponent(shareText));
    }

    const copyBtn = $('consultCopyCode');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        const done = function () {
          copyBtn.textContent = 'Copied';
          window.setTimeout(function () { copyBtn.textContent = 'Copy'; }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(referralCode).then(done, function () { /* ignore */ });
        } else {
          done();
        }
      });
    }

    setStage(3);

    // Hand off to WhatsApp automatically, but leave the button as the fallback
    // in case the browser blocks the programmatic open.
    const note = $('consultRedirectNote');
    let seconds = 3;
    const countdown = window.setInterval(function () {
      seconds -= 1;
      if (note) {
        note.textContent = seconds > 0
          ? 'Opening WhatsApp in ' + seconds + 's… or tap the button above.'
          : 'If WhatsApp did not open, tap the button above.';
      }
      if (seconds <= 0) window.clearInterval(countdown);
    }, 1000);

    redirectTimer = window.setTimeout(function () {
      window.open(whatsAppUrl, '_blank', 'noopener');
    }, 3000);
  }

  /* ---------------------------------------------------------------- *
   * Honest social proof — only rendered when real bookings exist
   * ---------------------------------------------------------------- */
  (async function loadStats() {
    const strip = document.querySelector('[data-consult-stats]');
    if (!strip) return;
    try {
      const res = await fetch(API_BASE + '/api/stats');
      if (!res.ok) return;
      const data = await res.json();
      const total = Number(data.total_consultations) || 0;
      if (total < 5) return; // stay silent rather than show a token number
      strip.textContent = total + ' consultations booked so far' +
        (data.consultations_this_week ? ' · ' + data.consultations_this_week + ' this week' : '');
      strip.hidden = false;
    } catch (_) { /* stats are optional */ }
  }());

  // Deep link: /#consult opens the booking flow directly (useful in ads and
  // WhatsApp broadcasts).
  function handleHash() {
    if (window.location.hash === '#consult') openConsult('deep-link');
  }
  handleHash();
  window.addEventListener('hashchange', handleHash);
}());
