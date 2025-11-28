const axios = require('axios');

class KkiapayService {
  constructor(config = null) {
    // Si une configuration est fournie, l'utiliser (depuis la DB)
    if (config) {
      this.publicKey = String(config.public_key || '').trim();
      this.secretKey = String(config.secret_key || '').trim();
      
      // Détecter automatiquement l'environnement basé sur les clés (même logique que loadConfig)
      let detectedSandbox = config.is_sandbox !== undefined ? config.is_sandbox : true;
      
      const publicKeyLower = this.publicKey.toLowerCase();
      const secretKeyLower = this.secretKey.toLowerCase();
      
      if (publicKeyLower.includes('test') || secretKeyLower.includes('test') || 
          publicKeyLower.includes('sandbox') || secretKeyLower.includes('sandbox')) {
        detectedSandbox = true;
        console.log('[Kkiapay] 🟡 Clé sandbox détectée dans le constructeur, utilisation de l\'environnement sandbox');
      } else if (publicKeyLower.includes('live') || secretKeyLower.includes('live') ||
                 publicKeyLower.includes('prod') || secretKeyLower.includes('prod')) {
        detectedSandbox = false;
        console.log('[Kkiapay] 🔴 Clé production détectée dans le constructeur, passage en mode production');
      } else {
        // Si aucune détection automatique, utiliser le flag de la DB
        console.log('[Kkiapay] ℹ️ Aucune détection automatique, utilisation du flag is_sandbox de la DB:', detectedSandbox);
      }
      
      this.sandbox = detectedSandbox;
      this.baseUrl = (config.base_url || this.getDefaultBaseUrl(this.sandbox)).replace(/\/$/, '');
    } else {
      // Fallback sur les variables d'environnement
      const isSandbox = process.env.KKIAPAY_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
      // Kkiapay utilise https://cdn.kkiapay.me comme base URL pour tout
      const fallbackUrl = 'https://cdn.kkiapay.me';
      
      this.baseUrl = (process.env.KKIAPAY_BASE_URL || fallbackUrl).replace(/\/$/, '');
      this.publicKey = process.env.KKIAPAY_PUBLIC_KEY;
      this.secretKey = process.env.KKIAPAY_SECRET_KEY;
      this.sandbox = isSandbox;
    }
    
    // Vérifier que la clé publique n'est pas une Private Api Key
    if (this.publicKey && (this.publicKey.startsWith('tpk_') || this.publicKey.startsWith('pk_'))) {
      console.warn('[Kkiapay] ⚠️ ATTENTION: La clé fournie semble être une Private Api Key (commence par tpk_ ou pk_)');
      console.warn('[Kkiapay] ⚠️ Le widget nécessite la Public Api Key (sans préfixe tpk_/pk_)');
    }
    
    // Devise par défaut
    this.defaultCurrency = (process.env.KKIAPAY_CURRENCY || 'XOF').toUpperCase();
  }

  /**
   * Obtenir l'URL de base par défaut selon l'environnement
   */
  getDefaultBaseUrl(isSandbox) {
    // Kkiapay utilise https://cdn.kkiapay.me comme base URL pour tout
    return 'https://cdn.kkiapay.me';
  }

  /**
   * Charger la configuration depuis la base de données
   */
  async loadConfig() {
    try {
      const paymentConfigService = require('../paymentConfigService');
      const config = await paymentConfigService.getProviderConfigByName('kkiapay');
      
      if (config && config.public_key && config.secret_key) {
        this.publicKey = String(config.public_key).trim();
        this.secretKey = String(config.secret_key).trim();
        
        // Détecter automatiquement l'environnement basé sur les clés (même logique que le constructeur)
        let detectedSandbox = config.is_sandbox !== undefined ? config.is_sandbox : true;
        
        const publicKeyLower = this.publicKey.toLowerCase();
        const secretKeyLower = this.secretKey.toLowerCase();
        
        if (publicKeyLower.includes('test') || secretKeyLower.includes('test') || 
            publicKeyLower.includes('sandbox') || secretKeyLower.includes('sandbox')) {
          detectedSandbox = true;
          console.log('[Kkiapay] 🟡 Clé sandbox détectée, utilisation de l\'environnement sandbox');
        } else if (publicKeyLower.includes('live') || secretKeyLower.includes('live') ||
                   publicKeyLower.includes('prod') || secretKeyLower.includes('prod')) {
          detectedSandbox = false;
          console.log('[Kkiapay] 🔴 Clé production détectée, passage en mode production');
        }
        
        this.sandbox = detectedSandbox;
        this.baseUrl = (config.base_url || this.getDefaultBaseUrl(this.sandbox)).replace(/\/$/, '');
        
        console.log('[Kkiapay] ✅ Configuration chargée depuis la base de données', {
          isSandbox: this.sandbox,
          baseUrl: this.baseUrl,
          publicKeyLength: this.publicKey ? this.publicKey.length : 0,
          secretKeyLength: this.secretKey ? this.secretKey.length : 0,
          publicKeyPrefix: this.publicKey ? `${this.publicKey.substring(0, 20)}...` : 'missing',
          publicKeySuffix: this.publicKey ? `...${this.publicKey.substring(this.publicKey.length - 10)}` : 'missing',
          environment: this.sandbox ? 'SANDBOX' : 'PRODUCTION',
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Kkiapay] Erreur lors du chargement de la config depuis la DB:', error);
      return false;
    }
  }

  ensureConfigured() {
    if (!this.publicKey || !this.secretKey) {
      throw new Error(
        'Clés Kkiapay manquantes. Vérifiez la configuration dans l\'interface admin ou les variables d\'environnement KKIAPAY_PUBLIC_KEY et KKIAPAY_SECRET_KEY.'
      );
    }
  }

  normaliseAmount(value) {
    if (value === undefined || value === null) return 0;
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0) {
      return 0;
    }
    // Kkiapay utilise généralement le montant en unités (pas en centimes pour XOF)
    return Math.round(numeric);
  }

  /**
   * Préparer les données pour le widget Kkiapay (côté client)
   * Kkiapay utilise principalement le SDK JavaScript côté client
   * Cette méthode retourne les informations nécessaires pour initialiser le widget
   */
  async createTransaction(transactionPayload = {}) {
    // Essayer de charger la config depuis la DB si pas déjà configuré
    if (!this.publicKey || !this.secretKey) {
      const loaded = await this.loadConfig();
      if (!loaded) {
        this.ensureConfigured(); // Lancer l'erreur si toujours pas configuré
      }
    } else {
      this.ensureConfigured();
    }

    const amount = this.normaliseAmount(transactionPayload.amount);
    if (amount <= 0) {
      throw new Error('Montant de transaction Kkiapay invalide');
    }

    console.log('[Kkiapay] 🧾 Préparation des données pour le widget', {
      amount: amount,
      currency: (transactionPayload.currency || this.defaultCurrency).toUpperCase(),
      description: transactionPayload.description || 'Paiement formation MdSC',
    });

    // Pour Kkiapay, on retourne simplement les infos nécessaires pour le widget
    // Le widget sera créé côté client via le SDK JavaScript
    // IMPORTANT: public_key doit être la Public Api Key (sans préfixe tpk_/pk_)
    if (this.publicKey && (this.publicKey.startsWith('tpk_') || this.publicKey.startsWith('pk_'))) {
      console.error('[Kkiapay] ❌ ERREUR CRITIQUE: Private Api Key détectée dans KKIAPAY_PUBLIC_KEY');
      console.error('[Kkiapay] ❌ La clé fournie commence par tpk_ ou pk_, ce qui indique une Private Api Key');
      console.error('[Kkiapay] ❌ Le widget nécessite la Public Api Key (sans préfixe)');
      console.error('[Kkiapay] ❌ Vérifiez votre fichier .env: KKIAPAY_PUBLIC_KEY doit contenir la Public Api Key');
      throw new Error('Configuration incorrecte: Private Api Key détectée dans KKIAPAY_PUBLIC_KEY. Utilisez la Public Api Key (sans préfixe tpk_/pk_).');
    }
    
    // S'assurer que sandbox est un booléen explicite
    const sandboxValue = Boolean(this.sandbox);
    
    console.log('[Kkiapay] 📤 Envoi de la clé publique au frontend', {
      keyPrefix: this.publicKey ? this.publicKey.substring(0, 20) + '...' : 'null',
      keySuffix: this.publicKey ? '...' + this.publicKey.substring(this.publicKey.length - 10) : 'null',
      keyLength: this.publicKey ? this.publicKey.length : 0,
      sandbox: sandboxValue,
      sandboxType: typeof sandboxValue,
      environment: sandboxValue ? 'SANDBOX' : 'PRODUCTION',
      baseUrl: this.baseUrl,
    });
    
    return {
      raw: {
        public_key: this.publicKey,
        sandbox: sandboxValue, // Booléen explicite
        amount: amount,
        currency: (transactionPayload.currency || this.defaultCurrency).toUpperCase(),
        description: transactionPayload.description || 'Paiement formation MdSC',
        customer: {
          name: transactionPayload.customer_fullname || transactionPayload.customerName || 'Étudiant MdSC',
          email: transactionPayload.customer_email || transactionPayload.customerEmail || 'student@mdsc.local',
          phone: transactionPayload.customer_phone || transactionPayload.customerPhone || null,
        },
        metadata: transactionPayload.metadata || {},
        success_url: transactionPayload.success_url || this.getRedirectUrl('success'),
        fail_url: transactionPayload.fail_url || this.getRedirectUrl('failed'),
        cancel_url: transactionPayload.cancel_url || this.getRedirectUrl('cancelled'),
      },
      transaction_id: null, // Sera généré par le widget côté client
      payment_url: null, // Pas d'URL de redirection, le widget s'ouvre directement
      status: 'pending',
    };
  }

  /**
   * Vérifier le statut d'une transaction
   */
  async getTransactionStatus(transactionId) {
    // Essayer de charger la config depuis la DB si pas déjà configuré
    if (!this.publicKey || !this.secretKey) {
      const loaded = await this.loadConfig();
      if (!loaded) {
        this.ensureConfigured(); // Lancer l'erreur si toujours pas configuré
      }
    } else {
      this.ensureConfigured();
    }

    if (!transactionId) {
      throw new Error('Identifiant de transaction Kkiapay manquant');
    }

    console.log('[Kkiapay] 🔍 getTransactionStatus', { transactionId });

    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/transactions/${transactionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': this.publicKey,
            'X-API-SECRET': this.secretKey,
          },
          timeout: 15000,
        }
      );

      const data = response.data?.data || response.data || {};
      console.log('[Kkiapay] ✅ getTransactionStatus response', {
        transactionId,
        status: data.status,
        amount: data.amount,
      });

      return {
        raw: response.data,
        transaction_id: data.transaction_id || data.id || transactionId,
        status: data.status || 'pending',
        amount: data.amount || null,
        currency: data.currency || null,
        payment_method: data.payment_method || null,
        created_at: data.created_at || data.createdAt || null,
        updated_at: data.updated_at || data.updatedAt || null,
      };
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Erreur inconnue lors de la vérification Kkiapay';
      
      console.error('[Kkiapay] ❌ getTransactionStatus failed', {
        message: errMsg,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      
      throw new Error(`Kkiapay getTransactionStatus: ${errMsg}`);
    }
  }

  /**
   * Vérifier le statut d'une transaction (alias pour compatibilité)
   */
  async verifyTransaction(transactionId) {
    return this.getTransactionStatus(transactionId);
  }

  /**
   * Annuler une transaction
   */
  async cancelTransaction(transactionId) {
    // Essayer de charger la config depuis la DB si pas déjà configuré
    if (!this.publicKey || !this.secretKey) {
      const loaded = await this.loadConfig();
      if (!loaded) {
        this.ensureConfigured(); // Lancer l'erreur si toujours pas configuré
      }
    } else {
      this.ensureConfigured();
    }

    if (!transactionId) {
      throw new Error('Identifiant de transaction Kkiapay manquant');
    }

    console.log('[Kkiapay] 🚫 cancelTransaction', { transactionId });

    try {
      const response = await axios.post(
        `${this.baseUrl}/api/v1/transactions/${transactionId}/cancel`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'X-API-KEY': this.publicKey,
            'X-API-SECRET': this.secretKey,
          },
          timeout: 15000,
        }
      );

      const data = response.data?.data || response.data || {};
      console.log('[Kkiapay] ✅ cancelTransaction response', {
        transactionId,
        status: data.status,
      });

      return {
        raw: response.data,
        transaction_id: data.transaction_id || data.id || transactionId,
        status: data.status || 'cancelled',
      };
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Erreur inconnue lors de l\'annulation Kkiapay';
      
      console.error('[Kkiapay] ❌ cancelTransaction failed', {
        message: errMsg,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      
      throw new Error(`Kkiapay cancelTransaction: ${errMsg}`);
    }
  }

  /**
   * Vérifier la signature d'un webhook
   */
  verifyWebhookSignature(payload, signature) {
    // Kkiapay utilise généralement une signature HMAC
    // Cette méthode doit être implémentée selon la documentation Kkiapay
    // Pour l'instant, on retourne true si la signature est présente
    if (!this.secretKey) {
      return false;
    }
    
    // TODO: Implémenter la vérification de signature selon la doc Kkiapay
    // Pour l'instant, on accepte si la signature est fournie
    return Boolean(signature);
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

// Exporter la classe pour permettre la création d'instances avec config
module.exports = KkiapayService;
// Exporter aussi une instance par défaut pour compatibilité
module.exports.default = new KkiapayService();

