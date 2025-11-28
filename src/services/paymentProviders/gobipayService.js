const axios = require('axios');

class GobiPayService {
  constructor(config = null) {
    this.defaultBaseUrl = 'https://api-pay.gobiworld.com/api';
    this.publicKey = null;
    this.secretKey = null;
    this.baseUrl = this.defaultBaseUrl;
    this.metadata = {};
    this.platformMoneyList = ['MTN_BEN_XOF'];
    this.redirectOverrides = {};
    this.storeCurrency = 'XOF';
    this.storeSlug = null; // Store slug pour construire l'URL de redirection

    if (config) {
      this.applyConfig(config);
    } else {
      this.applyEnvConfig();
    }
  }

  applyEnvConfig() {
    this.baseUrl = (process.env.GOBIPAY_BASE_URL || this.defaultBaseUrl).replace(/\/$/, '');
    this.publicKey = process.env.GOBIPAY_PUBLIC_KEY ? String(process.env.GOBIPAY_PUBLIC_KEY).trim() : null;
    this.secretKey = process.env.GOBIPAY_SECRET_KEY ? String(process.env.GOBIPAY_SECRET_KEY).trim() : null;
    this.metadata = {};
    this.platformMoneyList = this.normalizePlatformMoneyInput(process.env.GOBIPAY_PLATFORM_MONEY || 'MTN_BEN_XOF');
    this.storeCurrency = this.extractCurrencyFromWallets(this.platformMoneyList);
    this.redirectOverrides = {};
  }

  applyConfig(config) {
    this.publicKey = config.public_key ? String(config.public_key).trim() : null;
    this.secretKey = config.secret_key ? String(config.secret_key).trim() : null;
    this.metadata = config.metadata || {};
    const baseUrlCandidate = config.base_url || process.env.GOBIPAY_BASE_URL || this.defaultBaseUrl;
    this.baseUrl = baseUrlCandidate.replace(/\/$/, '');
    const metadataPlatformMoney =
      this.metadata.platform_money_list ||
      this.metadata.platformMoney ||
      this.metadata.platform_money;
    const fallbackPlatformMoney = process.env.GOBIPAY_PLATFORM_MONEY || 'MTN_BEN_XOF';
    this.platformMoneyList = this.normalizePlatformMoneyInput(metadataPlatformMoney || fallbackPlatformMoney);
    this.storeCurrency = this.extractCurrencyFromWallets(
      this.platformMoneyList,
      this.metadata.store_currency
    );
    this.redirectOverrides = this.metadata.redirect_urls || {};
    // Extraire store_slug depuis les métadonnées (peut être configuré par l'admin)
    this.storeSlug = 
      this.metadata.store_slug || 
      this.metadata.store || 
      this.metadata.store_identifier ||
      process.env.GOBIPAY_STORE_SLUG ||
      null;
  }

  normalizePlatformMoneyInput(input) {
    if (!input) {
      return ['MTN_BEN_XOF'];
    }
    if (Array.isArray(input)) {
      const cleaned = input.map((item) => String(item).trim()).filter(Boolean);
      return cleaned.length ? cleaned : ['MTN_BEN_XOF'];
    }
    const cleaned = String(input)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    return cleaned.length ? cleaned : ['MTN_BEN_XOF'];
  }

  extractCurrencyFromWallets(wallets, fallbackCurrency) {
    if (fallbackCurrency) {
      return String(fallbackCurrency).toUpperCase();
    }
    const firstWallet = Array.isArray(wallets) && wallets.length ? wallets[0] : 'MTN_BEN_XOF';
    return (firstWallet.split('_').pop() || 'XOF').toUpperCase();
  }

  async loadConfig() {
    try {
      const paymentConfigService = require('../paymentConfigService');
      const config = await paymentConfigService.getProviderConfigByName('gobipay');
      if (config && config.public_key && config.secret_key) {
        this.applyConfig(config);
        console.log('[GobiPay] ✅ Configuration chargée depuis la base de données');
        return true;
      }
      return false;
    } catch (error) {
      console.error('[GobiPay] ❌ Erreur lors du chargement de la configuration DB:', error.message);
      return false;
    }
  }

  async ensureReady() {
    if (!this.publicKey || !this.secretKey) {
      const loaded = await this.loadConfig();
      if (!loaded) {
        this.ensureConfigured();
      }
    } else {
      this.ensureConfigured();
    }
  }

  ensureConfigured() {
    if (!this.publicKey || !this.secretKey) {
      throw new Error(
        'Clés GobiPay manquantes. Configurez-les dans le panneau admin ou via les variables GOBIPAY_PUBLIC_KEY / GOBIPAY_SECRET_KEY.'
      );
    }
  }

  getPlatformMoneyList() {
    return this.platformMoneyList && this.platformMoneyList.length
      ? this.platformMoneyList
      : ['MTN_BEN_XOF'];
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
    await this.ensureReady();

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
      
      // Extraire order_uuid (peut être uuid, slug, ou identifier)
      const orderUuid = data.uuid || data.slug || data.identifier || null;
      
      // Extraire store_slug (peut être dans store, store_slug, ou depuis la configuration)
      const storeSlugRaw = 
        data.store || 
        data.store_slug || 
        data.store_identifier ||
        response.data?.store ||
        response.data?.store_slug ||
        this.storeSlug || // Fallback sur la configuration
        null;
      
      // Normaliser store_slug : peut être un objet avec une propriété 'slug' ou une chaîne
      let storeSlug = null;
      if (storeSlugRaw) {
        if (typeof storeSlugRaw === 'string') {
          storeSlug = storeSlugRaw;
        } else if (typeof storeSlugRaw === 'object' && storeSlugRaw.slug) {
          storeSlug = storeSlugRaw.slug;
        } else if (typeof storeSlugRaw === 'object' && storeSlugRaw.identifier) {
          storeSlug = storeSlugRaw.identifier;
        }
      }
      
      // Construire l'URL de redirection GobiPay au format officiel
      let paymentUrl = null;
      if (orderUuid && storeSlug) {
        paymentUrl = `https://pay.gobiworld.com/payment/?store=${storeSlug}&order=${orderUuid}`;
      } else {
        // Fallback sur les autres formats d'URL si disponibles
        paymentUrl = 
          data.payment_url || 
          data.redirect_url || 
          data.payment_link ||
          data.link ||
          response.data?.payment_url || 
          response.data?.redirect_url ||
          null;
      }
      
      console.log('[GobiPay] ✅ createOrder response (full)', {
        identifier: data.identifier || data.slug,
        orderUuid,
        storeSlug,
        paymentUrl,
        fullData: JSON.stringify(data, null, 2),
        fullResponse: JSON.stringify(response.data, null, 2),
      });

      return {
        raw: response.data,
        identifier: data.identifier || data.slug || null,
        uuid: orderUuid,
        store_slug: storeSlug,
        payment_url: paymentUrl,
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
    await this.ensureReady();

    const platformMoneyInput =
      transactionPayload.from_plateform_money ||
      transactionPayload.platform_money ||
      this.getPlatformMoneyList();

    const platformMoneyList = Array.isArray(platformMoneyInput)
      ? platformMoneyInput.filter(Boolean)
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

    let requestedCurrency = (
      transactionPayload.currency ||
      this.storeCurrency
    ).toString().toUpperCase();

    const walletsMatchingCurrency = platformMoneyList.filter((wallet) => {
      const walletCurrency = wallet.split('_').pop()?.toUpperCase();
      return walletCurrency === requestedCurrency;
    });

    let walletsToUse = walletsMatchingCurrency;

    if (!walletsMatchingCurrency.length) {
      console.warn('[GobiPay] ⚠️ No wallet matches requested currency. Falling back to store currency.', {
        requestedCurrency,
        storeCurrency: this.storeCurrency,
        availableWallets: platformMoneyList,
      });
      requestedCurrency = this.storeCurrency;
      walletsToUse = platformMoneyList.filter((wallet) => {
        const walletCurrency = wallet.split('_').pop()?.toUpperCase();
        return walletCurrency === requestedCurrency;
      });
      if (!walletsToUse.length) {
        walletsToUse = platformMoneyList;
      }
    }

    const selectedPlatformMoney = walletsToUse[0];
    if (!selectedPlatformMoney) {
      throw new Error('Aucun portefeuille GobiPay valide n\'a été trouvé');
    }

    const payload = {
      from_plateform_money: selectedPlatformMoney,
      amount: amountNumeric,
      currency: requestedCurrency,
      extra_infos: {
        customer_fullname: transactionPayload.customer_fullname,
        customer_email: transactionPayload.customer_email,
        customer_phone: transactionPayload.customer_phone,
        order_uuid: transactionPayload.order_uuid,
        ...transactionPayload.extra_infos,
        currency: requestedCurrency,
        platform_money_list: walletsToUse,
      },
    };

    console.log('[GobiPay] 🔄 initTransaction payload', {
      amount: payload.amount,
      orderUuid: payload.extra_infos.order_uuid,
      fromPlatformMoney: selectedPlatformMoney,
      availablePlatformMoney: walletsToUse,
      requestedCurrency,
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
      console.log('[GobiPay] ✅ initTransaction response (full)', {
        identifier: data.slug || data.id,
        status: data.status,
        paymentUrl: data.payment_url || data.redirect_url || data.payment_link || data.link,
        fullData: JSON.stringify(data, null, 2),
        fullResponse: JSON.stringify(response.data, null, 2),
      });
      return {
        raw: response.data,
        identifier: data.slug || data.id || null,
        payment_url: data.payment_url || data.redirect_url || data.payment_link || data.link || null,
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
    await this.ensureReady();

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
      
      // Extraire order_uuid et store_slug depuis la réponse (peuvent être dans exchange_transaction)
      const exchangeTransaction = data.exchange_transaction || {};
      const orderUuid = 
        exchangeTransaction.order_uuid || 
        exchangeTransaction.slug || 
        exchangeTransaction.gobi_app_transaction_id ||
        data.order_uuid ||
        data.slug ||
        null;
      
      const storeSlugRaw = 
        data.store || 
        data.store_slug || 
        data.store_identifier ||
        exchangeTransaction.store ||
        exchangeTransaction.store_slug ||
        this.storeSlug || // Fallback sur la configuration
        null;
      
      // Normaliser store_slug : peut être un objet avec une propriété 'slug' ou une chaîne
      let storeSlug = null;
      if (storeSlugRaw) {
        if (typeof storeSlugRaw === 'string') {
          storeSlug = storeSlugRaw;
        } else if (typeof storeSlugRaw === 'object' && storeSlugRaw.slug) {
          storeSlug = storeSlugRaw.slug;
        } else if (typeof storeSlugRaw === 'object' && storeSlugRaw.identifier) {
          storeSlug = storeSlugRaw.identifier;
        }
      }
      
      console.log('[GobiPay] ✅ payOrder response (full)', {
        redirect: data.redirect,
        redirectUrl: data.redirect_url || data.payment_url || data.payment_link || data.link,
        status: data.status,
        payload: data.payload,
        orderUuid,
        storeSlug,
        storeSlugRaw: typeof storeSlugRaw === 'object' ? 'object' : storeSlugRaw,
        fullData: JSON.stringify(data, null, 2),
        fullResponse: JSON.stringify(response.data, null, 2),
      });
      
      // Construire l'URL de redirection GobiPay au format officiel si on a les infos
      let paymentUrl = null;
      if (orderUuid && storeSlug) {
        paymentUrl = `https://pay.gobiworld.com/payment/?store=${storeSlug}&order=${orderUuid}`;
        console.log('[GobiPay] 🔗 URL de redirection construite depuis payOrder:', {
          storeSlug,
          orderUuid,
          paymentUrl,
        });
      } else {
        // Fallback : chercher l'URL dans les autres champs
        paymentUrl = 
          data.redirect_url || 
          data.payment_url || 
          data.payment_link ||
          data.link ||
          null;
        
        // Si pas d'URL directe, chercher dans payload.url (URL relative)
        if (!paymentUrl && data.payload && data.payload.url) {
          const relativeUrl = data.payload.url;
          // Si c'est une URL relative, construire l'URL complète avec baseUrl
          if (relativeUrl.startsWith('/')) {
            paymentUrl = `${this.baseUrl}${relativeUrl}`;
            console.log('[GobiPay] 🔗 Construite URL complète depuis payload.url:', {
              relativeUrl,
              baseUrl: this.baseUrl,
              fullUrl: paymentUrl,
            });
          } else if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
            // URL absolue déjà complète
            paymentUrl = relativeUrl;
          } else {
            // URL relative sans slash, ajouter le slash
            paymentUrl = `${this.baseUrl}/${relativeUrl}`;
          }
        } else if (!paymentUrl && data.payload && typeof data.payload === 'string') {
          // Si payload est une string (URL)
          paymentUrl = data.payload.startsWith('http') ? data.payload : `${this.baseUrl}${data.payload}`;
        }
      }
      
      return {
        raw: response.data,
        redirect_url: paymentUrl,
        redirect: data.redirect ?? (paymentUrl ? true : false),
        payload: data.payload || null,
        status: data.status || null,
        local_api: data.local ?? false,
        fields: data.payload?.fields || null,
        order_uuid: orderUuid,
        store_slug: storeSlug,
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
    await this.ensureReady();

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
    const backendUrl = (process.env.BACKEND_URL || 'http://localhost:5000').replace(
      /\/$/,
      ''
    );
    const path = '/dashboard/student';
    const override = this.redirectOverrides?.[status];
    if (override) {
      return override;
    }

    switch (status) {
      case 'success':
        // Rediriger vers le callback backend qui vérifiera le paiement et créera l'inscription
        // Le callback redirigera ensuite vers le frontend
        // Note: Les paramètres transaction_slug et order_slug seront ajoutés par GobiPay dans l'URL de redirection
        return `${backendUrl}/api/payments/callback/gobipay?payment=success`;
      case 'failed':
        // Rediriger aussi vers le callback backend pour mettre à jour le statut
        return `${backendUrl}/api/payments/callback/gobipay?payment=failed`;
      case 'cancelled':
        // Rediriger aussi vers le callback backend pour mettre à jour le statut
        return `${backendUrl}/api/payments/callback/gobipay?payment=cancelled`;
      default:
        return `${frontendUrl}${path}`;
    }
  }
}

module.exports = GobiPayService;

