const express = require('express');
const router = express.Router();
const professionalController = require('../controllers/professionalController');
const { authenticateToken, authorize } = require('../middleware/auth');

// ========================================
// ROUTES DOMAINES (Secteurs professionnels)
// ========================================

// Routes publiques
router.get('/domains', professionalController.getAllDomains);
router.get('/domains/:id', professionalController.getDomainById);

// Routes admin
router.post('/domains',
  authenticateToken,
  authorize(['admin']),
  professionalController.createDomain
);
router.put('/domains/:id',
  authenticateToken,
  authorize(['admin']),
  professionalController.updateDomain
);
router.delete('/domains/:id',
  authenticateToken,
  authorize(['admin']),
  professionalController.deleteDomain
);

// ========================================
// ROUTES MODULES (Regroupement de cours)
// ========================================

// Routes publiques
router.get('/domains/:domainId/modules', professionalController.getModulesByDomain);
router.get('/modules/:id', professionalController.getModuleById);

// Routes instructeur/admin
router.post('/modules', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  professionalController.createModule
);

// ========================================
// ROUTES SÉQUENCES - SUPPRIMÉES
// ========================================
// NOTE: Les routes séquences et contenus ont été supprimées car les tables
// correspondantes (sequences, contents, mini_controls) ont été supprimées
// de la base de données. Le système utilise maintenant uniquement 
// l'architecture Modules/Lessons.

module.exports = router;
