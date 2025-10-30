const express = require('express');
const router = express.Router();
const moduleController = require('../controllers/moduleController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes publiques
router.get('/courses/:courseId/modules', moduleController.getCourseModules);
router.get('/:id', moduleController.getModuleById);
router.get('/courses/:courseId/unlock-status', authenticateToken, moduleController.getModulesUnlockStatus);

// Routes protégées (instructeur/admin)
router.post('/courses/:courseId/modules', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleController.createModule
);

router.put('/:id', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleController.updateModule
);

router.delete('/:id', 
  authenticateToken, 
  authorize(['instructor', 'admin']), 
  moduleController.deleteModule
);

// Route pour déverrouiller un module
router.post('/:id/unlock', authenticateToken, moduleController.unlockModule);

// Réordonner les modules d'un cours (DnD persistence)
router.put('/courses/:courseId/reorder', 
  authenticateToken,
  authorize(['instructor', 'admin']),
  moduleController.reorderModules
);

module.exports = router;

