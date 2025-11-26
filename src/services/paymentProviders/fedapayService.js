const axios = require('axios');

class FedapayService {
  constructor(config = null) {
    // Si une configuration est fournie, l'utiliser (depuis la DB)
    if (config) {
      this.publicKey = config.public_key ? String(config.public_key).trim() : null;
      this.secretKey = config.secret_key ? String(config.secret_key).trim() : null;
      this.privateKey = config.private_key ? String(config.private_key).trim() : null;
      
      // Détecter automatiquement l'environnement basé sur le préfixe de la clé secrète (même logique que loadConfig)
      let detectedSandbox = config.is_sandbox !== undefined ? config.is_sandbox : true;
      
      if (this.secretKey) {
        // Les clés production commencent par 'sk_live_'
        // Les clés sandbox commencent par 'sk_test_' ou 'sk_sandbox_'
        if (this.secretKey.startsWith('sk_live_')) {
          detectedSandbox = false;
          console.log('[Fedapay] 🔴 Clé production détectée dans le constructeur (sk_live_), passage en mode production');
        } else if (this.secretKey.startsWith('sk_test_') || this.secretKey.startsWith('sk_sandbox_')) {
          detectedSandbox = true;
          console.log('[Fedapay] 🟡 Clé sandbox détectée dans le constructeur, utilisation de l\'environnement sandbox');
        } else {
          // Si aucune détection automatique, utiliser le flag de la DB
          console.log('[Fedapay] ℹ️ Aucune détection automatique dans le constructeur, utilisation du flag is_sandbox de la DB:', detectedSandbox);
        }
      }
      
      this.sandbox = detectedSandbox;
      
      // Utiliser l'URL fournie dans la DB si présente, sinon utiliser l'URL par défaut selon l'environnement détecté
      let baseUrl = config.base_url;
      if (!baseUrl || baseUrl.includes('cdn.fedapay.com')) {
        baseUrl = this.getDefaultBaseUrl(this.sandbox);
      }
      this.baseUrl = baseUrl.replace(/\/$/, '');
    } else {
      // Fallback sur les variables d'environnement
      const isSandbox = process.env.FEDAPAY_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
      // Fedapay utilise des URLs différentes pour sandbox et live
      const fallbackUrl = this.getDefaultBaseUrl(isSandbox);
      
      this.baseUrl = (process.env.FEDAPAY_BASE_URL || fallbackUrl).replace(/\/$/, '');
      // S'assurer qu'on n'utilise pas l'URL du CDN par erreur
      if (this.baseUrl.includes('cdn.fedapay.com')) {
        this.baseUrl = fallbackUrl;
      }
      this.publicKey = process.env.FEDAPAY_PUBLIC_KEY ? String(process.env.FEDAPAY_PUBLIC_KEY).trim() : null;
      this.secretKey = process.env.FEDAPAY_SECRET_KEY ? String(process.env.FEDAPAY_SECRET_KEY).trim() : null;
      this.privateKey = process.env.FEDAPAY_PRIVATE_KEY ? String(process.env.FEDAPAY_PRIVATE_KEY).trim() : null;
      this.sandbox = isSandbox;
    }
    
    // Devise par défaut
    this.defaultCurrency = (process.env.FEDAPAY_CURRENCY || 'XOF').toUpperCase();
  }

  /**
   * Obtenir l'URL de base par défaut selon l'environnement
   */
  getDefaultBaseUrl(isSandbox) {
    // Fedapay utilise des URLs différentes pour sandbox et live
    return isSandbox 
      ? 'https://sandbox-api.fedapay.com'
      : 'https://api.fedapay.com';
  }

  /**
   * Charger la configuration depuis la base de données avec fallback vers les variables d'environnement
   */
  async loadConfig() {
    try {
      const paymentConfigService = require('../paymentConfigService');
      const config = await paymentConfigService.getProviderConfigByName('fedapay');
      
      if (config && config.public_key && config.secret_key) {
        this.publicKey = config.public_key ? String(config.public_key).trim() : null;
        this.secretKey = config.secret_key ? String(config.secret_key).trim() : null;
        this.privateKey = config.private_key ? String(config.private_key).trim() : null;
        
        // Détecter automatiquement l'environnement basé sur le préfixe de la clé secrète (même logique que le constructeur)
        let detectedSandbox = config.is_sandbox !== undefined ? config.is_sandbox : true;
        
        if (this.secretKey) {
          // Les clés production commencent par 'sk_live_'
          // Les clés sandbox commencent par 'sk_test_' ou 'sk_sandbox_'
          if (this.secretKey.startsWith('sk_live_')) {
            detectedSandbox = false;
            console.log('[Fedapay] 🔴 Clé production détectée (sk_live_), passage en mode production');
          } else if (this.secretKey.startsWith('sk_test_') || this.secretKey.startsWith('sk_sandbox_')) {
            detectedSandbox = true;
            console.log('[Fedapay] 🟡 Clé sandbox détectée, utilisation de l\'environnement sandbox');
          } else {
            // Si aucune détection automatique, utiliser le flag de la DB
            console.log('[Fedapay] ℹ️ Aucune détection automatique, utilisation du flag is_sandbox de la DB:', detectedSandbox);
          }
        }
        
        this.sandbox = detectedSandbox;
        
        // Utiliser l'URL fournie dans la DB si présente, sinon utiliser l'URL par défaut selon l'environnement détecté
        let baseUrl = config.base_url;
        if (!baseUrl || baseUrl.includes('cdn.fedapay.com')) {
          baseUrl = this.getDefaultBaseUrl(this.sandbox);
        }
        this.baseUrl = baseUrl.replace(/\/$/, '');
        
        console.log('[Fedapay] ✅ Configuration chargée depuis la base de données', {
          isSandbox: this.sandbox,
          baseUrl: this.baseUrl,
          publicKeyPrefix: this.publicKey ? `${this.publicKey.substring(0, 20)}...` : 'missing',
          publicKeySuffix: this.publicKey ? `...${this.publicKey.substring(this.publicKey.length - 10)}` : 'missing',
          publicKeyLength: this.publicKey ? this.publicKey.length : 0,
          secretKeyLength: this.secretKey ? this.secretKey.length : 0,
          secretKeyPrefix: this.secretKey ? `${this.secretKey.substring(0, 15)}...` : 'missing',
          secretKeySuffix: this.secretKey ? `...${this.secretKey.substring(this.secretKey.length - 15)}` : 'missing',
          environment: this.sandbox ? 'SANDBOX' : 'PRODUCTION',
        });
        return true;
      }
      
      // Fallback vers les variables d'environnement si la DB n'a pas de config ou si le déchiffrement a échoué
      if (process.env.FEDAPAY_PUBLIC_KEY && process.env.FEDAPAY_SECRET_KEY) {
        console.warn('[Fedapay] ⚠️ Utilisation des variables d\'environnement comme fallback (config DB non disponible ou déchiffrement échoué)');
        const isSandbox = process.env.FEDAPAY_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
        const fallbackUrl = this.getDefaultBaseUrl(isSandbox);
        
        this.baseUrl = (process.env.FEDAPAY_BASE_URL || fallbackUrl).replace(/\/$/, '');
        // S'assurer qu'on n'utilise pas l'URL du CDN par erreur
        if (this.baseUrl.includes('cdn.fedapay.com')) {
          this.baseUrl = fallbackUrl;
        }
        this.publicKey = process.env.FEDAPAY_PUBLIC_KEY ? process.env.FEDAPAY_PUBLIC_KEY.trim() : null;
        this.secretKey = process.env.FEDAPAY_SECRET_KEY ? process.env.FEDAPAY_SECRET_KEY.trim() : null;
        this.privateKey = process.env.FEDAPAY_PRIVATE_KEY ? process.env.FEDAPAY_PRIVATE_KEY.trim() : null;
        this.sandbox = isSandbox;
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('[Fedapay] Erreur lors du chargement de la config depuis la DB:', error);
      
      // En cas d'erreur, essayer le fallback vers les variables d'environnement
      if (process.env.FEDAPAY_PUBLIC_KEY && process.env.FEDAPAY_SECRET_KEY) {
        console.warn('[Fedapay] ⚠️ Utilisation des variables d\'environnement comme fallback (erreur lors du chargement de la DB)');
        const isSandbox = process.env.FEDAPAY_SANDBOX === 'true' || process.env.NODE_ENV !== 'production';
        const fallbackUrl = this.getDefaultBaseUrl(isSandbox);
        
        this.baseUrl = (process.env.FEDAPAY_BASE_URL || fallbackUrl).replace(/\/$/, '');
        // S'assurer qu'on n'utilise pas l'URL du CDN par erreur
        if (this.baseUrl.includes('cdn.fedapay.com')) {
          this.baseUrl = fallbackUrl;
        }
        this.publicKey = process.env.FEDAPAY_PUBLIC_KEY ? process.env.FEDAPAY_PUBLIC_KEY.trim() : null;
        this.secretKey = process.env.FEDAPAY_SECRET_KEY ? process.env.FEDAPAY_SECRET_KEY.trim() : null;
        this.privateKey = process.env.FEDAPAY_PRIVATE_KEY ? process.env.FEDAPAY_PRIVATE_KEY.trim() : null;
        this.sandbox = isSandbox;
        return true;
      }
      
      return false;
    }
  }

  ensureConfigured() {
    if (!this.publicKey || !this.secretKey) {
      throw new Error(
        'Clés Fedapay manquantes. Vérifiez la configuration dans l\'interface admin ou les variables d\'environnement FEDAPAY_PUBLIC_KEY et FEDAPAY_SECRET_KEY.'
      );
    }
  }

  normaliseAmount(value) {
    if (value === undefined || value === null) return 0;
    const numeric = Number(value);
    if (Number.isNaN(numeric) || numeric < 0) {
      return 0;
    }
    // Fedapay utilise généralement le montant en unités (pas en centimes pour XOF)
    return Math.round(numeric);
  }

  /**
   * Préparer les données pour le widget Fedapay (côté client)
   * Fedapay utilise le SDK JavaScript Checkout.js côté client
   * Cette méthode retourne les informations nécessaires pour initialiser le widget
   * PAS d'appel API - le widget gère tout côté client
   */
  async createTransaction(transactionPayload = {}) {
    // Essayer de charger la config depuis la DB si pas déjà configuré
    if (!this.publicKey || !this.secretKey) {
      console.log('[Fedapay] ⚙️ Clés non configurées, chargement depuis la DB...');
      const loaded = await this.loadConfig();
      if (!loaded) {
        console.error('[Fedapay] ❌ Échec du chargement de la config depuis la DB');
        this.ensureConfigured(); // Lancer l'erreur si toujours pas configuré
      } else {
        console.log('[Fedapay] ✅ Configuration chargée avec succès');
      }
    } else {
      console.log('[Fedapay] ✅ Clés déjà configurées, validation...');
      this.ensureConfigured();
    }
    
    console.log('[Fedapay] 📋 Configuration actuelle:', {
      hasPublicKey: !!this.publicKey,
      publicKeyLength: this.publicKey?.length || 0,
      publicKeyPrefix: this.publicKey ? this.publicKey.substring(0, 20) + '...' : 'null',
      hasSecretKey: !!this.secretKey,
      secretKeyLength: this.secretKey?.length || 0,
      secretKeyPrefix: this.secretKey ? this.secretKey.substring(0, 20) + '...' : 'null',
      isSandbox: this.sandbox,
      baseUrl: this.baseUrl,
    });

    const amount = this.normaliseAmount(transactionPayload.amount);
    if (amount <= 0) {
      throw new Error('Montant de transaction Fedapay invalide');
    }

    console.log('[Fedapay] 🧾 Préparation des données pour le widget', {
      amount: amount,
      currency: (transactionPayload.currency || this.defaultCurrency).toUpperCase(),
      description: transactionPayload.description || 'Paiement formation MdSC',
    });

    // Pour Fedapay, on retourne simplement les infos nécessaires pour le widget
    // Le widget sera créé côté client via le SDK JavaScript Checkout.js
    // IMPORTANT: public_key doit être la clé publique Fedapay
    if (!this.publicKey) {
      throw new Error('Clé publique Fedapay manquante. Vérifiez la configuration dans l\'interface admin.');
    }
    
    // S'assurer que sandbox est un booléen explicite
    const sandboxValue = Boolean(this.sandbox);
    const environmentValue = sandboxValue ? 'sandbox' : 'live';
    
    console.log('[Fedapay] 📤 Envoi de la clé publique au frontend', {
      keyPrefix: this.publicKey ? this.publicKey.substring(0, 20) + '...' : 'null',
      keySuffix: this.publicKey ? '...' + this.publicKey.substring(this.publicKey.length - 10) : 'null',
      keyLength: this.publicKey ? this.publicKey.length : 0,
      sandbox: sandboxValue,
      environment: environmentValue,
      environmentType: typeof environmentValue,
    });
    
    return {
      raw: {
        public_key: this.publicKey,
        environment: environmentValue, // 'sandbox' ou 'live' en string
        sandbox: sandboxValue, // Booléen pour compatibilité
        amount: amount,
        currency: (transactionPayload.currency || this.defaultCurrency).toUpperCase(),
        description: transactionPayload.description || 'Paiement formation MdSC',
      },
      transaction_id: null, // Pas de transaction_id car le widget gère tout
      payment_url: null, // Pas de payment_url car le widget gère tout
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
      throw new Error('Identifiant de transaction Fedapay manquant');
    }

    console.log('[Fedapay] 🔍 getTransactionStatus', { transactionId });

    // S'assurer que l'URL de base est correcte (pas le CDN)
    const defaultUrl = this.getDefaultBaseUrl(this.sandbox);
    const finalBaseUrl = this.baseUrl && !this.baseUrl.includes('cdn.fedapay.com') && (this.baseUrl.includes('api.fedapay.com') || this.baseUrl.includes('sandbox-api.fedapay.com'))
      ? this.baseUrl 
      : defaultUrl;

    try {
      const response = await axios.get(
        `${finalBaseUrl}/v1/transactions/${transactionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.secretKey ? this.secretKey.trim() : this.secretKey}`,
            'FedaPay-Version': '1',
          },
          timeout: 15000,
        }
      );

      const data = response.data?.data || response.data || {};
      const transaction = data.transaction || data;
      
      console.log('[Fedapay] ✅ getTransactionStatus response', {
        transactionId,
        status: transaction.status,
        amount: transaction.amount,
      });

      return {
        raw: response.data,
        transaction_id: transaction.id || transactionId,
        status: this.normalizeStatus(transaction.status) || 'pending',
        amount: transaction.amount || null,
        currency: transaction.currency?.iso || transaction.currency || null,
        payment_method: transaction.payment_method || null,
        created_at: transaction.created_at || transaction.createdAt || null,
        updated_at: transaction.updated_at || transaction.updatedAt || null,
      };
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Erreur inconnue lors de la vérification Fedapay';
      
      console.error('[Fedapay] ❌ getTransactionStatus failed', {
        message: errMsg,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      
      throw new Error(`Fedapay getTransactionStatus: ${errMsg}`);
    }
  }

  /**
   * Normaliser le statut Fedapay vers notre format
   */
  normalizeStatus(status) {
    if (!status) return 'pending';
    
    const statusMap = {
      'pending': 'pending',
      'approved': 'completed',
      'approved': 'completed',
      'completed': 'completed',
      'failed': 'failed',
      'canceled': 'cancelled',
      'cancelled': 'cancelled',
    };
    
    return statusMap[status.toLowerCase()] || 'pending';
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
      throw new Error('Identifiant de transaction Fedapay manquant');
    }

    console.log('[Fedapay] 🚫 cancelTransaction', { transactionId });

    // S'assurer que l'URL de base est correcte (pas le CDN)
    const defaultUrl = this.getDefaultBaseUrl(this.sandbox);
    const finalBaseUrl = this.baseUrl && !this.baseUrl.includes('cdn.fedapay.com') && (this.baseUrl.includes('api.fedapay.com') || this.baseUrl.includes('sandbox-api.fedapay.com'))
      ? this.baseUrl 
      : defaultUrl;

    try {
      const response = await axios.delete(
        `${finalBaseUrl}/v1/transactions/${transactionId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.secretKey ? this.secretKey.trim() : this.secretKey}`,
            'FedaPay-Version': '1',
          },
          timeout: 15000,
        }
      );

      const data = response.data?.data || response.data || {};
      console.log('[Fedapay] ✅ cancelTransaction response', {
        transactionId,
        status: data.status,
      });

      return {
        raw: response.data,
        transaction_id: data.id || transactionId,
        status: 'cancelled',
      };
    } catch (error) {
      const errMsg =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Erreur inconnue lors de l\'annulation Fedapay';
      
      console.error('[Fedapay] ❌ cancelTransaction failed', {
        message: errMsg,
        status: error?.response?.status,
        data: error?.response?.data,
      });
      
      throw new Error(`Fedapay cancelTransaction: ${errMsg}`);
    }
  }

  /**
   * Vérifier la signature d'un webhook
   */
  verifyWebhookSignature(payload, signature) {
    if (!this.secretKey) {
      return false;
    }
    
    // TODO: Implémenter la vérification de signature selon la doc Fedapay
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
module.exports = FedapayService;
// Exporter aussi une instance par défaut pour compatibilité
module.exports.default = new FedapayService();

