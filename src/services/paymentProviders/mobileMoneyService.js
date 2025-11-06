const axios = require('axios');

class MobileMoneyService {
  /**
   * Initier un paiement Mobile Money
   */
  static async initiatePayment({ provider, amount, currency, phoneNumber, paymentId, userId, courseId }) {
    try {
      // Configuration selon le provider
      const config = this.getProviderConfig(provider);

      const response = await axios.post(config.apiUrl, {
        amount,
        currency,
        phoneNumber,
        merchantId: config.merchantId,
        merchantKey: config.merchantKey,
        callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:5000'}/api/payments/webhook/mobile-money/${provider}`,
        metadata: {
          payment_id: paymentId,
          user_id: userId,
          course_id: courseId
        }
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      return {
        transactionId: response.data.transaction_id,
        redirectUrl: response.data.redirect_url || null,
        status: response.data.status
      };

    } catch (error) {
      console.error(`Erreur ${provider}:`, error);
      throw new Error(`Erreur ${provider}: ${error.message}`);
    }
  }

  /**
   * Vérifier la signature du webhook
   */
  static async verifyWebhookSignature(provider, payload) {
    const config = this.getProviderConfig(provider);
    
    if (!config.webhookSecret) {
      console.warn(`⚠️ Webhook secret non configuré pour ${provider}`);
      return true; // En développement, accepter sans vérification
    }

    const signature = payload.signature || payload.hash;
    const expectedSignature = this.generateSignature(payload, config.webhookSecret);

    return signature === expectedSignature;
  }

  /**
   * Générer la signature
   */
  static generateSignature(payload, secret) {
    const crypto = require('crypto');
    const data = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }

  /**
   * Configuration par provider
   */
  static getProviderConfig(provider) {
    const configs = {
      'orange-money': {
        apiUrl: process.env.ORANGE_MONEY_API_URL || 'https://api.orange.com/orange-money-webpay/v1/webpay',
        merchantId: process.env.ORANGE_MONEY_MERCHANT_ID,
        merchantKey: process.env.ORANGE_MONEY_MERCHANT_KEY,
        apiKey: process.env.ORANGE_MONEY_API_KEY,
        webhookSecret: process.env.ORANGE_MONEY_WEBHOOK_SECRET
      },
      'mtn-mobile-money': {
        apiUrl: process.env.MTN_MOBILE_MONEY_API_URL || 'https://api.mtn.com/v1/mobile-money',
        merchantId: process.env.MTN_MERCHANT_ID,
        merchantKey: process.env.MTN_MERCHANT_KEY,
        apiKey: process.env.MTN_API_KEY,
        webhookSecret: process.env.MTN_WEBHOOK_SECRET
      }
    };

    const config = configs[provider];
    if (!config) {
      throw new Error(`Provider ${provider} non configuré`);
    }

    return config;
  }
}

module.exports = MobileMoneyService;

