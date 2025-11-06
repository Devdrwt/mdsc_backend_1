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

module.exports = router;

