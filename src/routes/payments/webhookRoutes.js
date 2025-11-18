const express = require('express');
const router = express.Router();
const webhookController = require('../../controllers/webhookController');

// Webhook Stripe
router.post('/stripe',
  express.raw({ type: 'application/json' }),
  webhookController.handleStripeWebhook
);

// Webhook Mobile Money (Orange Money, MTN Mobile Money, etc.)
router.post('/mobile-money/:provider',
  webhookController.handleMobileMoneyWebhook
);

// Webhook Kkiapay
router.post('/kkiapay',
  express.json(),
  (req, res, next) => {
    console.log('[Webhook][Kkiapay] 📨 Route called', {
      method: req.method,
      url: req.url,
      body: req.body,
      headers: {
        'content-type': req.headers['content-type'],
        'authorization': req.headers['authorization'] ? 'present' : 'missing',
      },
    });
    next();
  },
  webhookController.handleKkiapayWebhook
);

module.exports = router;

