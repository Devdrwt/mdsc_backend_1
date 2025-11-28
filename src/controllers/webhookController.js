const { pool } = require('../config/database');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');
const paymentController = require('./paymentController');

/**
 * Webhook Stripe
 */
const handleStripeWebhook = async (req, res) => {
  try {
    const signature = req.headers['stripe-signature'];
    const event = StripeService.verifyWebhookSignature(req.body, signature);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handleStripePaymentSuccess(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handleStripePaymentFailed(event.data.object);
        break;
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Erreur webhook Stripe:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Gérer un paiement Stripe réussi
 */
const handleStripePaymentSuccess = async (paymentIntent) => {
  const paymentId = paymentIntent.metadata?.payment_id;

  if (!paymentId) {
    console.error('payment_id manquant dans metadata');
    return;
  }

  // Mettre à jour le paiement
  await pool.execute(
    'UPDATE payments SET status = "completed", completed_at = NOW(), provider_transaction_id = ? WHERE id = ?',
    [paymentIntent.id, paymentId]
  );

  // Créer l'inscription automatiquement (utilise ensureEnrollmentForPayment pour gérer tous les cas)
  await paymentController.ensureEnrollmentForPayment(paymentId);
  
  console.log(`✅ [Stripe] Payment completed and enrollment ensured: ${paymentId}`);
};

/**
 * Gérer un paiement Stripe échoué
 */
const handleStripePaymentFailed = async (paymentIntent) => {
  const paymentId = paymentIntent.metadata?.payment_id;

  if (!paymentId) return;

  await pool.execute(
    'UPDATE payments SET status = "failed", error_message = ? WHERE id = ?',
    [paymentIntent.last_payment_error?.message || 'Paiement échoué', paymentId]
  );

  // Créer une notification pour l'échec
  try {
    const [payments] = await pool.execute(
      'SELECT user_id, course_id FROM payments WHERE id = ? LIMIT 1',
      [paymentId]
    );
    if (payments.length > 0) {
      const { user_id, course_id } = payments[0];
      await paymentController.createPaymentNotification(user_id, paymentId, course_id, 'failed');
    }
  } catch (error) {
    console.error('[Webhook][Stripe] ❌ Erreur lors de la création de la notification d\'échec:', error);
  }
};

/**
 * Webhook Mobile Money
 */
const handleMobileMoneyWebhook = async (req, res) => {
  try {
    const { provider } = req.params;
    const payload = req.body;

    // Vérifier la signature selon le provider
    const isValid = await MobileMoneyService.verifyWebhookSignature(provider, payload);

    if (!isValid) {
      return res.status(401).json({ error: 'Signature invalide' });
    }

    // Traiter selon le provider
    switch (provider) {
      case 'orange-money':
        await handleOrangeMoneyWebhook(payload);
        break;
      case 'mtn-mobile-money':
        await handleMTNWebhook(payload);
        break;
      default:
        return res.status(400).json({ error: 'Provider non supporté' });
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Erreur webhook Mobile Money:', error);
    res.status(400).json({ error: error.message });
  }
};

/**
 * Handler spécifique Orange Money
 */
const handleOrangeMoneyWebhook = async (payload) => {
  const paymentId = payload.metadata?.payment_id;
  const status = payload.status;

  if (!paymentId) {
    console.error('payment_id manquant dans payload Orange Money');
    return;
  }

  if (status === 'SUCCESS' || status === 'COMPLETED') {
    await pool.execute(
      'UPDATE payments SET status = "completed", completed_at = NOW(), provider_transaction_id = ? WHERE id = ?',
      [payload.transaction_id || payload.id, paymentId]
    );

    // Créer l'inscription automatiquement (utilise ensureEnrollmentForPayment pour gérer tous les cas)
    await paymentController.ensureEnrollmentForPayment(paymentId);
    
    console.log(`✅ [Orange Money] Payment completed and enrollment ensured: ${paymentId}`);
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    const errorStatus = status === 'CANCELLED' ? 'cancelled' : 'failed';
    await pool.execute(
      'UPDATE payments SET status = ?, error_message = ? WHERE id = ?',
      [errorStatus, payload.error_message || 'Paiement échoué', paymentId]
    );

    // Créer une notification pour l'échec ou l'annulation
    try {
      const [payments] = await pool.execute(
        'SELECT user_id, course_id FROM payments WHERE id = ? LIMIT 1',
        [paymentId]
      );
      if (payments.length > 0) {
        const { user_id, course_id } = payments[0];
        await paymentController.createPaymentNotification(user_id, paymentId, course_id, errorStatus);
      }
    } catch (error) {
      console.error('[Webhook][Orange Money] ❌ Erreur lors de la création de la notification:', error);
    }
  }
};

/**
 * Handler spécifique MTN Mobile Money
 */
const handleMTNWebhook = async (payload) => {
  const paymentId = payload.metadata?.payment_id;
  const status = payload.status;

  if (!paymentId) {
    console.error('payment_id manquant dans payload MTN');
    return;
  }

  if (status === 'SUCCESS' || status === 'COMPLETED') {
    await pool.execute(
      'UPDATE payments SET status = "completed", completed_at = NOW(), provider_transaction_id = ? WHERE id = ?',
      [payload.transaction_id || payload.id, paymentId]
    );

    // Créer l'inscription automatiquement (utilise ensureEnrollmentForPayment pour gérer tous les cas)
    await paymentController.ensureEnrollmentForPayment(paymentId);
    
    console.log(`✅ [MTN Mobile Money] Payment completed and enrollment ensured: ${paymentId}`);
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    const errorStatus = status === 'CANCELLED' ? 'cancelled' : 'failed';
    await pool.execute(
      'UPDATE payments SET status = ?, error_message = ? WHERE id = ?',
      [errorStatus, payload.error_message || 'Paiement échoué', paymentId]
    );

    // Créer une notification pour l'échec ou l'annulation
    try {
      const [payments] = await pool.execute(
        'SELECT user_id, course_id FROM payments WHERE id = ? LIMIT 1',
        [paymentId]
      );
      if (payments.length > 0) {
        const { user_id, course_id } = payments[0];
        await paymentController.createPaymentNotification(user_id, paymentId, course_id, errorStatus);
      }
    } catch (error) {
      console.error('[Webhook][MTN] ❌ Erreur lors de la création de la notification:', error);
    }
  }
};

module.exports = {
  handleStripeWebhook,
  handleMobileMoneyWebhook
};

