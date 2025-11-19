const { pool } = require('../config/database');
const StripeService = require('../services/paymentProviders/stripeService');
const MobileMoneyService = require('../services/paymentProviders/mobileMoneyService');

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

  // Créer l'inscription automatiquement
  const [payments] = await pool.execute(
    'SELECT user_id, course_id FROM payments WHERE id = ?',
    [paymentId]
  );

  if (payments.length > 0) {
    const { user_id, course_id } = payments[0];

    // Vérifier qu'une inscription n'existe pas déjà
    const [existing] = await pool.execute(
      'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
      [user_id, course_id]
    );

    if (existing.length === 0) {
      // Créer l'inscription
      const [enrollmentResult] = await pool.execute(
        `INSERT INTO enrollments (user_id, course_id, payment_id, enrollment_date, status)
         VALUES (?, ?, ?, NOW(), 'enrolled')`,
        [user_id, course_id, paymentId]
      );

      console.log(`✅ Inscription créée automatiquement: ${enrollmentResult.insertId}`);
    }
  }
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

    // Créer l'inscription
    const [payments] = await pool.execute(
      'SELECT user_id, course_id FROM payments WHERE id = ?',
      [paymentId]
    );

    if (payments.length > 0) {
      const { user_id, course_id } = payments[0];
      const [existing] = await pool.execute(
        'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
        [user_id, course_id]
      );

      if (existing.length === 0) {
        await pool.execute(
          `INSERT INTO enrollments (user_id, course_id, payment_id, enrollment_date, status)
           VALUES (?, ?, ?, NOW(), 'enrolled')`,
          [user_id, course_id, paymentId]
        );
      }
    }
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    await pool.execute(
      'UPDATE payments SET status = "failed", error_message = ? WHERE id = ?',
      [payload.error_message || 'Paiement échoué', paymentId]
    );
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

    // Créer l'inscription
    const [payments] = await pool.execute(
      'SELECT user_id, course_id FROM payments WHERE id = ?',
      [paymentId]
    );

    if (payments.length > 0) {
      const { user_id, course_id } = payments[0];
      const [existing] = await pool.execute(
        'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
        [user_id, course_id]
      );

      if (existing.length === 0) {
        await pool.execute(
          `INSERT INTO enrollments (user_id, course_id, payment_id, enrollment_date, status)
           VALUES (?, ?, ?, NOW(), 'enrolled')`,
          [user_id, course_id, paymentId]
        );
      }
    }
  } else if (status === 'FAILED' || status === 'CANCELLED') {
    await pool.execute(
      'UPDATE payments SET status = "failed", error_message = ? WHERE id = ?',
      [payload.error_message || 'Paiement échoué', paymentId]
    );
  }
};

module.exports = {
  handleStripeWebhook,
  handleMobileMoneyWebhook
};

