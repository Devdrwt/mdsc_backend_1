const axios = require('axios');

class GobiPayService {
  constructor() {
    const fallbackUrl = 'https://api-pay.gobiworld.com/api';
    this.baseUrl = (process.env.GOBIPAY_BASE_URL || fallbackUrl).replace(/\/$/, '');
    this.publicKey = process.env.GOBIPAY_PUBLIC_KEY;
    this.secretKey = process.env.GOBIPAY_SECRET_KEY;
    this.defaultPlatformMoney = process.env.GOBIPAY_PLATFORM_MONEY || 'MTN_BEN_XOF';
  }

  ensureConfigured() {
    if (!this.publicKey || !this.secretKey) {
      throw new Error(
        'Clés GobiPay manquantes. Vérifiez GOBIPAY_PUBLIC_KEY et GOBIPAY_SECRET_KEY.'
      );
    }
  }

  normaliseAmount(value) {
    if (value === undefined || value === null) return '0';
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0) {
      return '0';
    }
    return Math.trunc(numeric).toString();
  }

  buildOrderPayload(orderPayload = {}) {
    const total = this.normaliseAmount(orderPayload.total);
    const items = Array.isArray(orderPayload.items) ? orderPayload.items : [];

    const normalisedItems = items.length
      ? items.map((item) => ({
          name: item.name || orderPayload.description || 'Formation',
          quantity: this.normaliseAmount(item.quantity || 1),
          price: this.normaliseAmount(item.price || total),
        }))
      : [
          {
            name: orderPayload.description || 'Formation',
            quantity: '1',
            price: total,
          },
        ];

    return {
      description: orderPayload.description || 'Paiement formation MdSC',
      total,
      order_type: orderPayload.order_type || 'global',
      customer_fullname: orderPayload.customer_fullname || 'Étudiant MdSC',
      customer_email: orderPayload.customer_email || 'student@mdsc.local',
      notified_for_partial_payment:
        orderPayload.notified_for_partial_payment !== undefined
          ? Boolean(orderPayload.notified_for_partial_payment)
          : true,
      items: normalisedItems,
      minimum_payment_amount: this.normaliseAmount(
        orderPayload.minimum_payment_amount || 0
      ),
      metadata: orderPayload.metadata || {},
      success_redirect_url:
        orderPayload.success_redirect_url || this.getRedirectUrl('success'),
      failed_redirect_url:
        orderPayload.failed_redirect_url || this.getRedirectUrl('failed'),
      cancel_redirection_url:
        orderPayload.cancel_redirection_url || this.getRedirectUrl('cancelled'),
      default_redirect_url:
        orderPayload.default_redirect_url || this.getRedirectUrl('default'),
    };
  }

  async createOrder(orderPayload = {}) {
    this.ensureConfigured();

    const payload = this.buildOrderPayload(orderPayload);
    console.log('[GobiPay] 🧾 createOrder payload', {
      description: payload.description,
      total: payload.total,
      customer: payload.customer_fullname,
      metadata: payload.metadata,
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/gobipay/orders/`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-STORE-PUBLIC-KEY': this.publicKey,
            'X-STORE-SECRET-KEY': this.secretKey,
          },
          timeout: 20000,
        }
      );

      const data = response.data?.data || response.data || {};
      console.log('[GobiPay] ✅ createOrder response', {
        identifier: data.identifier || data.slug,
        paymentUrl: data.payment_url || data.redirect_url,
      });

      return {
        raw: response.data,
        identifier: data.identifier || data.slug || null,
        payment_url:
          data.payment_url || data.redirect_url || response.data?.payment_url || null,
      };
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        'Erreur inconnue lors de la création de la commande GobiPay';

      console.error('[GobiPay] ❌ createOrder failed', {
        message: errMsg,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      throw new Error(`GobiPay createOrder: ${errMsg}`);
    }
  }

  async initTransaction(transactionPayload = {}) {
    this.ensureConfigured();

    const platformMoneyInput =
      transactionPayload.from_plateform_money ||
      transactionPayload.platform_money ||
      this.defaultPlatformMoney;

    const platformMoneyList = Array.isArray(platformMoneyInput)
      ? platformMoneyInput
      : `${platformMoneyInput}`
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);

    if (!platformMoneyList.length) {
      throw new Error('Plateforme de paiement GobiPay non configurée');
    }

    const amountNumeric = Number(transactionPayload.amount);
    if (Number.isNaN(amountNumeric) || amountNumeric <= 0) {
      throw new Error('Montant de transaction GobiPay invalide');
    }

    const payload = {
      from_plateform_money: platformMoneyList,
      amount: amountNumeric,
      extra_infos: {
        customer_fullname: transactionPayload.customer_fullname,
        customer_email: transactionPayload.customer_email,
        customer_phone: transactionPayload.customer_phone,
        order_uuid: transactionPayload.order_uuid,
        ...transactionPayload.extra_infos,
      },
    };

    console.log('[GobiPay] 🔄 initTransaction payload', {
      amount: payload.amount,
      orderUuid: payload.extra_infos.order_uuid,
      fromPlatformMoney: payload.from_plateform_money,
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/gobipay/payment/init-transaction/`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-STORE-PUBLIC-KEY': this.publicKey,
            'X-STORE-SECRET-KEY': this.secretKey,
          },
          timeout: 20000,
        }
      );

      const data = response.data?.data || response.data || {};
      console.log('[GobiPay] ✅ initTransaction response', {
        identifier: data.slug || data.id,
        status: data.status,
      });
      return {
        raw: response.data,
        identifier: data.slug || data.id || null,
        extra: data,
      };
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        "Erreur inconnue lors de l'initiation de la transaction GobiPay";

      console.error('[GobiPay] ❌ initTransaction failed', {
        message: errMsg,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      throw new Error(`GobiPay initTransaction: ${errMsg}`);
    }
  }

  async payOrder(identifier, paymentPayload = {}) {
    this.ensureConfigured();

    if (!identifier) {
      throw new Error('Identifiant de commande GobiPay manquant');
    }

    const payload = paymentPayload.body || paymentPayload;
    console.log('[GobiPay] 💳 payOrder payload', {
      identifier,
      hasPayload: Boolean(payload && Object.keys(payload).length),
    });

    try {
      const response = await axios.post(
        `${this.baseUrl}/gobipay/payment/${identifier}/pay/`,
        payload || {},
        {
          headers: {
            'Content-Type': 'application/json',
            'X-STORE-PUBLIC-KEY': this.publicKey,
            'X-STORE-SECRET-KEY': this.secretKey,
          },
          timeout: 20000,
        }
      );

      const data = response.data?.data || response.data || {};
      console.log('[GobiPay] ✅ payOrder response', {
        redirect: data.redirect,
        redirectUrl: data.redirect_url || data.payment_url,
        status: data.status,
      });
      return {
        raw: response.data,
        redirect_url: data.redirect_url || data.payment_url || null,
        redirect: data.redirect ?? false,
        payload: data.payload || null,
        status: data.status || null,
      };
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        'Erreur inconnue lors de la confirmation GobiPay';

      console.error('[GobiPay] ❌ payOrder failed', {
        message: errMsg,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      throw new Error(`GobiPay payOrder: ${errMsg}`);
    }
  }

  async getTransactionStatus(identifier) {
    this.ensureConfigured();

    try {
      const response = await axios.post(
        `${this.baseUrl}/gobipay/payment/${identifier}/check-transaction/`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'X-STORE-PUBLIC-KEY': this.publicKey,
            'X-STORE-SECRET-KEY': this.secretKey,
          },
          timeout: 15000,
        }
      );

      return response.data;
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.response?.data?.detail ||
        error?.message ||
        'Erreur inconnue lors de la vérification GobiPay';
      throw new Error(`GobiPay getTransactionStatus: ${errMsg}`);
    }
  }

  getRedirectUrl(status) {
    const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(
      /\/$/,
      ''
    );
    const path = '/dashboard/student/courses';

    switch (status) {
      case 'success':
        return `${frontendUrl}${path}?payment=success`;
      case 'failed':
        return `${frontendUrl}${path}?payment=failed`;
      case 'cancelled':
        return `${frontendUrl}${path}?payment=cancelled`;
      default:
        return `${frontendUrl}${path}`;
    }
  }
}

module.exports = new GobiPayService();

