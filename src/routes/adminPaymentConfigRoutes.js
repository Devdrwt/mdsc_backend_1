const express = require('express');
const router = express.Router();
const adminPaymentConfigController = require('../controllers/adminPaymentConfigController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Toutes les routes nécessitent l'authentification admin
// Appliquer le middleware sur chaque route individuellement pour plus de contrôle

// Récupérer tous les providers de paiement
router.get('/', 
  authenticateToken, 
  authorize(['admin']), 
  adminPaymentConfigController.getProviders
);

// Récupérer un provider par ID
router.get('/:id', 
  authenticateToken, 
  authorize(['admin']), 
  adminPaymentConfigController.getProvider
);

// Créer un nouveau provider
router.post('/', 
  authenticateToken, 
  authorize(['admin']), 
  adminPaymentConfigController.createOrUpdateProvider
);

// Mettre à jour un provider existant
router.put('/:id', 
  authenticateToken, 
  authorize(['admin']), 
  adminPaymentConfigController.createOrUpdateProvider
);

// Supprimer un provider
router.delete('/:id', 
  authenticateToken, 
  authorize(['admin']), 
  adminPaymentConfigController.deleteProvider
);

// Activer/désactiver un provider
router.patch('/:id/toggle', 
  authenticateToken, 
  authorize(['admin']), 
  adminPaymentConfigController.toggleProviderStatus
);

module.exports = router;

