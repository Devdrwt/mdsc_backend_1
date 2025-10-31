const express = require('express');
const router = express.Router();
const badgeController = require('../controllers/badgeController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes publiques
router.get('/', badgeController.getAllBadges);

// Routes utilisateur authentifié (AVANT les routes avec :id pour éviter les conflits)
router.get('/user', authenticateToken, badgeController.getUserBadges);
router.get('/user/my-badges', authenticateToken, badgeController.getUserBadges);
router.post('/check-and-award', authenticateToken, badgeController.checkAndAwardBadges);

// Routes avec paramètres (après les routes spécifiques)
router.get('/:id', badgeController.getBadgeById);
router.get('/:id/check-eligibility', authenticateToken, badgeController.checkBadgeEligibility);

// Route admin
router.post('/award',
  authenticateToken,
  authorize(['admin']),
  badgeController.awardBadge
);

module.exports = router;

