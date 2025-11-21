const paymentConfigService = require('../services/paymentConfigService');

/**
 * Récupérer tous les providers de paiement
 */
const getProviders = async (req, res) => {
  try {
    const providers = await paymentConfigService.getAllProviders();
    
    res.json({
      success: true,
      data: providers
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des providers:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des providers de paiement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Récupérer un provider par ID
 * Si le paramètre ?forEdit=true est présent, retourne les clés complètes pour l'édition
 */
const getProvider = async (req, res) => {
  try {
    const { id } = req.params;
    const forEdit = req.query.forEdit === 'true' || req.query.forEdit === true;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID du provider requis'
      });
    }
    
    // Récupérer le provider avec les clés complètes si c'est pour l'édition
    const provider = await paymentConfigService.getProviderById(id, forEdit);
    
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: provider
    });
  } catch (error) {
    console.error('Erreur lors de la récupération du provider:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du provider',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Créer ou mettre à jour un provider
 */
const createOrUpdateProvider = async (req, res) => {
  try {
    const {
      provider_name,
      public_key,
      secret_key,
      private_key,
      is_active,
      is_sandbox,
      base_url,
      metadata
    } = req.body;
    
    // Validation
    if (!provider_name) {
      return res.status(400).json({
        success: false,
        message: 'Le nom du provider est requis'
      });
    }
    
    try {
      paymentConfigService.validateProviderName(provider_name);
    } catch (validationError) {
      return res.status(400).json({
        success: false,
        message: validationError.message
      });
    }
    
    if (!public_key || !secret_key) {
      return res.status(400).json({
        success: false,
        message: 'La clé publique et la clé secrète sont requises'
      });
    }
    
    // Générer automatiquement l'URL selon le provider et l'environnement
    let autoBaseUrl = null;
    const isSandbox = is_sandbox !== undefined ? Boolean(is_sandbox) : true;
    
    if (provider_name === 'kkiapay') {
      // Kkiapay utilise toujours https://cdn.kkiapay.me comme base URL
      autoBaseUrl = 'https://cdn.kkiapay.me';
    } else if (provider_name === 'fedapay') {
      const FedapayService = require('../services/paymentProviders/fedapayService');
      const fedapayService = new FedapayService();
      autoBaseUrl = fedapayService.getDefaultBaseUrl(isSandbox);
    }
    
    // Créer ou mettre à jour (URL générée automatiquement, pas celle du body)
    const providerId = await paymentConfigService.createOrUpdateProvider({
      provider_name,
      public_key: public_key.trim(), // Nettoyer les espaces mais garder le contenu exact
      secret_key: secret_key.trim(), // Nettoyer les espaces mais garder le contenu exact
      private_key: private_key ? private_key.trim() : null,
      is_active: is_active !== undefined ? Boolean(is_active) : true,
      is_sandbox: isSandbox,
      base_url: autoBaseUrl, // URL générée automatiquement
      metadata: metadata || null
    });
    
    // Récupérer le provider créé/mis à jour
    const provider = await paymentConfigService.getProviderById(providerId);
    
    res.status(provider.id === parseInt(req.params?.id) ? 200 : 201).json({
      success: true,
      message: provider.id === parseInt(req.params?.id) 
        ? 'Provider mis à jour avec succès' 
        : 'Provider créé avec succès',
      data: provider
    });
  } catch (error) {
    console.error('Erreur lors de la création/mise à jour du provider:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création/mise à jour du provider',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Supprimer un provider
 */
const deleteProvider = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID du provider requis'
      });
    }
    
    // Vérifier que le provider existe
    const provider = await paymentConfigService.getProviderById(id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider non trouvé'
      });
    }
    
    const deleted = await paymentConfigService.deleteProvider(id);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Provider non trouvé ou déjà supprimé'
      });
    }
    
    res.json({
      success: true,
      message: 'Provider supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du provider:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du provider',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Activer/désactiver un provider
 */
const toggleProviderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID du provider requis'
      });
    }
    
    // Vérifier que le provider existe
    const provider = await paymentConfigService.getProviderById(id);
    if (!provider) {
      return res.status(404).json({
        success: false,
        message: 'Provider non trouvé'
      });
    }
    
    const newStatus = await paymentConfigService.toggleProviderStatus(id);
    
    res.json({
      success: true,
      message: `Provider ${newStatus ? 'activé' : 'désactivé'} avec succès`,
      data: {
        id: parseInt(id),
        is_active: newStatus
      }
    });
  } catch (error) {
    console.error('Erreur lors du changement de statut du provider:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut du provider',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Récupérer les providers actifs (pour usage public/API)
 */
const getActiveProviders = async (req, res) => {
  try {
    const providers = await paymentConfigService.getAllProviders();
    
    // Filtrer seulement les actifs et masquer les clés
    const activeProviders = providers
      .filter(p => p.is_active)
      .map(p => ({
        id: p.id,
        provider_name: p.provider_name,
        is_sandbox: p.is_sandbox,
        // Ne pas exposer les clés même masquées dans l'API publique
      }));
    
    res.json({
      success: true,
      data: activeProviders
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des providers actifs:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des providers actifs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

module.exports = {
  getProviders,
  getProvider,
  createOrUpdateProvider,
  deleteProvider,
  toggleProviderStatus,
  getActiveProviders
};

