const crypto = require('crypto');
const { pool } = require('../config/database');

// Clé de chiffrement - utiliser une variable d'environnement ou générer une clé fixe
// IMPORTANT: En production, cette clé doit être stockée de manière sécurisée
const ENCRYPTION_KEY = process.env.PAYMENT_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-cbc';

/**
 * Chiffrer une valeur sensible
 */
function encrypt(text) {
  if (!text) return null;
  
  try {
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Retourner IV + données chiffrées (format: iv:encrypted)
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    console.error('Erreur lors du chiffrement:', error);
    throw new Error('Erreur lors du chiffrement des données');
  }
}

/**
 * Déchiffrer une valeur
 */
function decrypt(encryptedText) {
  if (!encryptedText) return null;
  
  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Format de données chiffrées invalide');
    }
    
    const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32), 'utf8');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Erreur lors du déchiffrement:', error);
    throw new Error('Erreur lors du déchiffrement des données');
  }
}

/**
 * Masquer partiellement une clé pour l'affichage (montre seulement les 4 premiers et 4 derniers caractères)
 */
function maskKey(key) {
  if (!key) return null;
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

/**
 * Valider qu'un provider name est valide
 */
function validateProviderName(providerName) {
  const validProviders = ['kkiapay', 'fedapay'];
  if (!validProviders.includes(providerName)) {
    throw new Error(`Provider invalide. Doit être l'un de: ${validProviders.join(', ')}`);
  }
}

/**
 * Récupérer tous les providers
 */
async function getAllProviders() {
  try {
    const [providers] = await pool.execute(
      'SELECT * FROM payment_providers ORDER BY provider_name ASC'
    );
    
    // Masquer les clés sensibles dans la réponse
    return providers.map(provider => ({
      ...provider,
      public_key: maskKey(provider.public_key),
      secret_key: maskKey(provider.secret_key),
      private_key: provider.private_key ? maskKey(provider.private_key) : null,
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des providers:', error);
    throw error;
  }
}

/**
 * Récupérer un provider par ID
 * @param {number} id - ID du provider
 * @param {boolean} forEdit - Si true, retourne les clés complètes (non masquées) pour l'édition
 */
async function getProviderById(id, forEdit = false) {
  try {
    const [providers] = await pool.execute(
      'SELECT * FROM payment_providers WHERE id = ?',
      [id]
    );
    
    if (providers.length === 0) {
      return null;
    }
    
    const provider = providers[0];
    
    // Si c'est pour l'édition, retourner les clés complètes
    if (forEdit) {
      return {
        ...provider,
        public_key: provider.public_key || null,
        secret_key: provider.secret_key || null,
        private_key: provider.private_key || null,
        metadata: provider.metadata ? JSON.parse(provider.metadata) : null,
      };
    }
    
    // Sinon, masquer les clés pour la sécurité
    return {
      ...provider,
      public_key: maskKey(provider.public_key),
      secret_key: maskKey(provider.secret_key),
      private_key: provider.private_key ? maskKey(provider.private_key) : null,
    };
  } catch (error) {
    console.error('Erreur lors de la récupération du provider:', error);
    throw error;
  }
}

/**
 * Récupérer un provider par nom (pour usage interne avec clés complètes)
 * Retourne null si le provider n'existe pas (pour permettre le fallback)
 * Les clés sont stockées en clair dans la DB, pas de déchiffrement nécessaire
 */
async function getProviderConfigByName(providerName) {
  try {
    validateProviderName(providerName);
    
    const [providers] = await pool.execute(
      'SELECT * FROM payment_providers WHERE provider_name = ? AND is_active = TRUE',
      [providerName]
    );
    
    if (providers.length === 0) {
      return null;
    }
    
    const provider = providers[0];
    
    // Les clés sont stockées en clair, les retourner directement
    return {
      ...provider,
      public_key: provider.public_key, // Clé en clair
      secret_key: provider.secret_key, // Clé en clair
      private_key: provider.private_key || null, // Clé en clair si présente
      metadata: provider.metadata ? JSON.parse(provider.metadata) : null,
    };
  } catch (error) {
    console.error('Erreur lors de la récupération de la config du provider:', error);
    // Retourner null au lieu de lancer une erreur pour permettre le fallback
    return null;
  }
}

/**
 * Récupérer tous les providers actifs (pour usage interne)
 */
async function getActiveProviders() {
  try {
    const [providers] = await pool.execute(
      'SELECT * FROM payment_providers WHERE is_active = TRUE ORDER BY provider_name ASC'
    );
    
    return providers.map(provider => ({
      ...provider,
      public_key: provider.public_key, // Clé en clair
      secret_key: provider.secret_key, // Clé en clair
      private_key: provider.private_key || null, // Clé en clair si présente
      metadata: provider.metadata ? JSON.parse(provider.metadata) : null,
    }));
  } catch (error) {
    console.error('Erreur lors de la récupération des providers actifs:', error);
    throw error;
  }
}

/**
 * Créer ou mettre à jour un provider
 */
async function createOrUpdateProvider(providerData) {
  try {
    validateProviderName(providerData.provider_name);
    
    // Vérifier si le provider existe déjà
    const [existing] = await pool.execute(
      'SELECT id FROM payment_providers WHERE provider_name = ?',
      [providerData.provider_name]
    );
    
    // Stocker les clés exactement telles qu'elles sont fournies (déjà nettoyées par le contrôleur)
    const publicKey = providerData.public_key || null;
    const secretKey = providerData.secret_key || null;
    const privateKey = providerData.private_key || null;
    
    const metadata = providerData.metadata ? JSON.stringify(providerData.metadata) : null;
    
    if (existing.length > 0) {
      // Mettre à jour
      const providerId = existing[0].id;
      
      // Générer automatiquement l'URL si elle n'est pas fournie ou si l'environnement change
      let finalBaseUrl = providerData.base_url;
      if (!finalBaseUrl || providerData.is_sandbox !== undefined) {
        // Re-générer l'URL selon le nouvel environnement
        const isSandbox = providerData.is_sandbox !== undefined ? providerData.is_sandbox : existing[0].is_sandbox;
        if (providerData.provider_name === 'kkiapay') {
          // Kkiapay utilise toujours https://cdn.kkiapay.me comme base URL
          finalBaseUrl = 'https://cdn.kkiapay.me';
        } else if (providerData.provider_name === 'fedapay') {
          const FedapayService = require('./paymentProviders/fedapayService');
          const fedapayService = new FedapayService();
          finalBaseUrl = fedapayService.getDefaultBaseUrl(isSandbox);
        }
      }
      
      await pool.execute(
        `UPDATE payment_providers 
         SET public_key = ?, 
             secret_key = ?, 
             private_key = ?,
             is_active = ?,
             is_sandbox = ?,
             base_url = ?,
             metadata = ?,
             updated_at = NOW()
         WHERE id = ?`,
        [
          publicKey,
          secretKey,
          privateKey,
          providerData.is_active !== undefined ? providerData.is_active : existing[0].is_active,
          providerData.is_sandbox !== undefined ? providerData.is_sandbox : existing[0].is_sandbox,
          finalBaseUrl,
          metadata,
          providerId,
        ]
      );
      
      return providerId;
    } else {
      // Créer
      const [result] = await pool.execute(
        `INSERT INTO payment_providers 
         (provider_name, public_key, secret_key, private_key, is_active, is_sandbox, base_url, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          providerData.provider_name,
          publicKey,
          secretKey,
          privateKey,
          providerData.is_active !== undefined ? providerData.is_active : true,
          providerData.is_sandbox !== undefined ? providerData.is_sandbox : true,
          providerData.base_url || null,
          metadata,
        ]
      );
      
      return result.insertId;
    }
  } catch (error) {
    console.error('Erreur lors de la création/mise à jour du provider:', error);
    throw error;
  }
}

/**
 * Supprimer un provider
 */
async function deleteProvider(id) {
  try {
    const [result] = await pool.execute(
      'DELETE FROM payment_providers WHERE id = ?',
      [id]
    );
    
    return result.affectedRows > 0;
  } catch (error) {
    console.error('Erreur lors de la suppression du provider:', error);
    throw error;
  }
}

/**
 * Activer/désactiver un provider
 */
async function toggleProviderStatus(id) {
  try {
    const [providers] = await pool.execute(
      'SELECT is_active FROM payment_providers WHERE id = ?',
      [id]
    );
    
    if (providers.length === 0) {
      throw new Error('Provider non trouvé');
    }
    
    const newStatus = !providers[0].is_active;
    
    await pool.execute(
      'UPDATE payment_providers SET is_active = ?, updated_at = NOW() WHERE id = ?',
      [newStatus, id]
    );
    
    return newStatus;
  } catch (error) {
    console.error('Erreur lors du changement de statut du provider:', error);
    throw error;
  }
}

/**
 * Vérifier si un provider est actif et configuré
 */
async function isProviderActive(providerName) {
  try {
    const [providers] = await pool.execute(
      'SELECT id FROM payment_providers WHERE provider_name = ? AND is_active = TRUE',
      [providerName]
    );
    
    return providers.length > 0;
  } catch (error) {
    console.error('Erreur lors de la vérification du provider:', error);
    return false;
  }
}

module.exports = {
  getAllProviders,
  getProviderById,
  getProviderConfigByName,
  getActiveProviders,
  createOrUpdateProvider,
  deleteProvider,
  toggleProviderStatus,
  isProviderActive,
  encrypt,
  decrypt,
  maskKey,
  validateProviderName,
};

