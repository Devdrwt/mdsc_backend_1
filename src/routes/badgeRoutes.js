const express = require('express');
const router = express.Router();
const badgeController = require('../controllers/badgeController');
const { authenticateToken, authorize } = require('../middleware/auth');

// Routes publiques
router.get('/', badgeController.getAllBadges);
router.get('/:id', badgeController.getBadgeById);

// Routes utilisateur authentifié
router.get('/user/my-badges', authenticateToken, badgeController.getUserBadges);
router.get('/:id/check-eligibility', authenticateToken, badgeController.checkBadgeEligibility);
router.post('/check-and-award', authenticateToken, badgeController.checkAndAwardBadges);

// Route admin
router.post('/award',
  authenticateToken,
  authorize(['admin']),
  badgeController.awardBadge
);

module.exports = router;

