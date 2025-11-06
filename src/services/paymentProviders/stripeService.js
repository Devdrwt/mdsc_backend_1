let stripe = null;
try {
  stripe = require('stripe');
} catch (e) {
  console.warn('⚠️ Package stripe non installé. Exécuter: npm install stripe');
}

class StripeService {
  constructor() {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.warn('⚠️ STRIPE_SECRET_KEY non configuré. Les paiements Stripe ne fonctionneront pas.');
      this.stripe = null;
    } else if (!stripe) {
      console.warn('⚠️ Package stripe non installé. Les paiements Stripe ne fonctionneront pas.');
      this.stripe = null;
    } else {
      this.stripe = stripe(stripeKey);
    }
  }

  /**
   * Créer un PaymentIntent
   */
  async createPaymentIntent({ amount, currency, metadata }) {
    if (!this.stripe) {
      throw new Error('Stripe non configuré');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convertir en centimes
        currency: currency.toLowerCase(),
        metadata,
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id,
        redirectUrl: null // Pour Stripe, utiliser le client_secret côté frontend
      };

    } catch (error) {
      console.error('Erreur Stripe:', error);
      throw new Error(`Erreur Stripe: ${error.message}`);
    }
  }

  /**
   * Vérifier la signature du webhook
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.stripe) {
      throw new Error('Stripe non configuré');
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET non configuré');
    }

    try {
      return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      throw new Error(`Signature invalide: ${error.message}`);
    }
  }

  /**
   * Récupérer le statut d'un paiement
   */
  async getPaymentStatus(paymentIntentId) {
    if (!this.stripe) {
      throw new Error('Stripe non configuré');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent.status;
    } catch (error) {
      throw new Error(`Erreur récupération statut: ${error.message}`);
    }
  }
}

module.exports = new StripeService();

