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
// ROUTES SÉQUENCES (Structure du contenu)
// ========================================

// Routes publiques (pour les étudiants inscrits)
router.get('/courses/:courseId/sequences', 
  authenticateToken, 
  professionalController.getCourseSequences
);

// Routes instructeur/admin
router.post('/courses/:courseId/sequences', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  professionalController.createSequence
);

// ========================================
// ROUTES CONTENUS (PDF, Vidéos, Live)
// ========================================

// Routes publiques (pour les étudiants inscrits)
router.get('/sequences/:sequenceId/contents', 
  authenticateToken, 
  professionalController.getSequenceContents
);

// Routes instructeur/admin
router.post('/sequences/:sequenceId/contents', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  professionalController.createContent
);

module.exports = router;
